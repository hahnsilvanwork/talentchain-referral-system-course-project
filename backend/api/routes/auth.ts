import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client";
import { mintIdentityNft, hasIdentityNft } from "../../chain/mint-nft";
import { createReferralUtxo } from "../../chain/referral-chain";
import { addToChainWithCode } from "../../chain/chain-utils";
import { sendRegistrationBonus } from "../../chain/registration-bonus";
import { blockfrost } from "../../chain/blockfrost";

const router = Router();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wartet bis eine TX von Blockfrost bestätigt wurde.
 * Prüft alle 5s, max. 120s.
 */
async function waitForTx(txHash: string, maxWaitMs = 120_000): Promise<void> {
  const start = Date.now();
  console.log(`Warte auf TX-Bestätigung: ${txHash.slice(0, 16)}...`);
  while (Date.now() - start < maxWaitMs) {
    try {
      await blockfrost.txs(txHash);
      console.log(`✓ TX bestätigt nach ${Math.round((Date.now() - start) / 1000)}s`);
      return;
    } catch {
      await sleep(5_000);
    }
  }
  console.warn(`⚠ TX ${txHash.slice(0, 16)}... nach ${maxWaitMs / 1000}s noch nicht bestätigt — fahre trotzdem fort`);
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, walletAddress, walletPkh, inviteCode } = req.body;

    if (!email || !password || !walletAddress || !walletPkh) {
      res.status(400).json({ error: "Alle Felder erforderlich" });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { walletAddress }] },
    });
    if (existing) {
      res.status(400).json({ error: "Account existiert bereits" });
      return;
    }

    const nftExists = await hasIdentityNft(walletAddress);
    if (nftExists) {
      res.status(400).json({ error: "Wallet hat bereits einen Identity NFT" });
      return;
    }

    let inviter: { id: string; walletPkh: string; email: string } | null = null;

    if (inviteCode && inviteCode.trim()) {
      const code = inviteCode.trim().toUpperCase();

      const inviterUser = await prisma.user.findUnique({
        where: { inviteCode: code },
        select: {
          id: true,
          walletPkh: true,
          email: true,
          isBlacklisted: true,
          role: true,
        },
      });

      if (!inviterUser) {
        res.status(400).json({ error: "Ungültiger Einladungscode" });
        return;
      }
      if (inviterUser.isBlacklisted) {
        res.status(400).json({ error: "Einladungscode nicht mehr gültig" });
        return;
      }

      const inviterRelation = await prisma.referralRelation.findFirst({
        where: { inviteeId: inviterUser.id },
      });
      const isInChain =
        inviterRelation !== null || inviterUser.role === "L1_AMBASSADOR";

      if (!isInChain) {
        res.status(400).json({ error: "Einladungscode nicht mehr gültig" });
        return;
      }

      inviter = inviterUser;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        walletAddress,
        walletPkh,
        role: "USER",
        usedInviteCode: inviter ? inviteCode.trim().toUpperCase() : null,
      },
    });

    // ── TX 1: Identity NFT minting ────────────────────────────────
    let nftTxHash: string | null = null;
    try {
      console.log(`[TX 1/3] Minting Identity NFT fuer ${email}...`);
      nftTxHash = await mintIdentityNft(walletAddress, walletPkh);
      console.log(`[TX 1/3] ✓ NFT Mint TX: ${nftTxHash}`);
    } catch (mintError) {
      console.error("[TX 1/3] NFT Minting fehlgeschlagen:", mintError);
    }

    let userInviteCode: string | null = null;
    let utxoTxHash: string | null = null;
    let bonusTxHash: string | null = null;
    let bonusPayments: any[] = [];

    if (inviter) {
      // Warten bis TX 1 bestätigt ist
      if (nftTxHash) {
        await waitForTx(nftTxHash);
      } else {
        await sleep(10_000);
      }

      // ── TX 2: Referral UTxO on-chain ──────────────────────────
      try {
        console.log(`[TX 2/3] Erstelle Referral UTxO on-chain...`);
        utxoTxHash = await createReferralUtxo(
          inviter.walletPkh,
          walletPkh,
          walletPkh.slice(0, 32),
          nftTxHash ?? undefined   // NFT Mint TX als UTxO-Hint für Lucid
        );
        console.log(`[TX 2/3] ✓ Referral UTxO TX: ${utxoTxHash}`);
      } catch (chainErr) {
        console.error("[TX 2/3] On-chain UTxO fehlgeschlagen:", chainErr);
      }

      const result = await addToChainWithCode(user.id, inviter.id, utxoTxHash);
      userInviteCode = result.inviteCode;
      console.log(`${email} in Kette. Invite-Code: ${userInviteCode}`);

      // Warten bis TX 2 bestätigt ist
      if (utxoTxHash) {
        await waitForTx(utxoTxHash);
      } else {
        await sleep(10_000);
      }

      // ── TX 3: Registrierungsbonus ─────────────────────────────
      // utxoTxHash als Hint mitgeben → Change-Output von TX 2 direkt nutzen
      try {
        console.log(`[TX 3/3] Sende Registrierungsbonus CHF 75...`);
        const bonus = await sendRegistrationBonus(user.id, utxoTxHash ?? undefined);
        if (bonus) {
          bonusTxHash = bonus.txHash;
          bonusPayments = bonus.payments;
          console.log(`[TX 3/3] ✓ Bonus TX: ${bonusTxHash}`);
          console.log(`  CHF ${bonus.totalChf} an ${bonus.payments.length} Personen verteilt`);
        }
      } catch (bonusErr) {
        console.error("[TX 3/3] Registrierungsbonus fehlgeschlagen:", bonusErr);
      }
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      userId: user.id,
      role: user.role,
      email: user.email,
      nftTxHash,
      inChain: inviter !== null,
      inviteCode: userInviteCode,
      utxoTxHash,
      bonus: bonusTxHash
        ? {
            txHash: bonusTxHash,
            totalChf: 75,
            payments: bonusPayments.map((p) => ({
              email: p.email,
              chf: p.chf,
              description: p.description,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, walletAddress, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(walletAddress ? [{ walletAddress }] : []),
        ],
      },
    });

    if (!user) {
      res.status(401).json({ error: "Ungültige Anmeldedaten" });
      return;
    }
    if (user.isBlacklisted) {
      res.status(403).json({ error: "Account gesperrt" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Ungültige Anmeldedaten" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ token, userId: user.id, role: user.role, email: user.email });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

export default router;