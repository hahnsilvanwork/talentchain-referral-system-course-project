/**
 * api/routes/admin.ts
 */

import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { createReferralUtxo, getReferralScriptAddress } from "../../chain/referral-chain";
import { cascadeRemoveFromChain, addToChainWithCode, createUniqueInviteCode } from "../../chain/chain-utils";

const router = Router();

// GET /api/admin/users
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        walletAddress: true,
        walletPkh: true,
        role: true,
        isBlacklisted: true,
        inviteCode: true,
        usedInviteCode: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// PUT /api/admin/user/:id
router.put("/user/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const { walletPkh, role, isBlacklisted } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(walletPkh && { walletPkh }),
        ...(role && { role }),
        ...(isBlacklisted !== undefined && { isBlacklisted }),
      },
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/admin/pkh
router.post("/pkh", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    const addr = CSL.Address.from_bech32(address);
    const baseAddr = CSL.BaseAddress.from_address(addr);
    const pkh = baseAddr?.payment_cred().to_keyhash()?.to_hex();
    if (!pkh) {
      res.status(400).json({ error: "PKH nicht gefunden" });
      return;
    }
    res.json({ pkh });
  } catch {
    res.status(400).json({ error: "Ungueltige Adresse" });
  }
});

// POST /api/admin/make-l1/:id
// ─────────────────────────────────────────────────────────────────
// Setzt User als L1 Ambassador:
//   1. User-Rolle in DB auf L1_AMBASSADOR setzen
//   2. On-Chain UTxO mit inviter=None erstellen (= Root)
//   3. DB ReferralRelation als Spiegel erstellen
//   4. Invite-Code zuweisen
router.post("/make-l1/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User nicht gefunden" });
      return;
    }

    // Rolle setzen
    await prisma.user.update({
      where: { id },
      data: { role: "L1_AMBASSADOR" },
    });

    // Prüfen ob schon in Kette
    const existing = await prisma.referralRelation.findFirst({
      where: { inviteeId: id },
    });

    let utxoTxHash: string | null = null;
    let onChainStatus = "skipped";
    let inviteCode = user.inviteCode;

    if (!existing) {
      // On-chain UTxO erstellen (inviter = None = L1 Root)
      try {
        utxoTxHash = await createReferralUtxo(
          null,
          user.walletPkh,
          user.walletPkh.slice(0, 32)
        );
        onChainStatus = "created";
        console.log(`L1 Root UTxO on-chain: ${utxoTxHash} für ${user.email}`);
      } catch (chainErr) {
        console.error("On-chain L1 UTxO fehlgeschlagen:", chainErr);
        onChainStatus = "failed";
      }

      // DB-Eintrag + Invite-Code
      const result = await addToChainWithCode(id, null, utxoTxHash);
      inviteCode = result.inviteCode;
    } else {
      // Schon in Kette — Invite-Code generieren falls noch keiner vorhanden
      if (!inviteCode) {
        inviteCode = await createUniqueInviteCode();
        await prisma.user.update({
          where: { id },
          data: { inviteCode },
        });
      }
    }

    res.json({
      success: true,
      message: `${user.email} ist jetzt L1 Ambassador`,
      onChain: onChainStatus,
      utxoTxHash,
      inviteCode,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/admin/remove-l1/:id
router.post("/remove-l1/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const user = await prisma.user.update({
      where: { id },
      data: { role: "USER" },
    });
    res.json({ success: true, message: `${user.email} ist jetzt USER` });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/admin/blacklist/:id
// ─────────────────────────────────────────────────────────────────
// Sperrt User UND entfernt ihn automatisch aus der Referral-Kette.
// Kinder werden kaskadenartig zum Parent des gesperrten Users verknüpft.
router.post("/blacklist/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, isBlacklisted: true },
    });

    if (!user) {
      res.status(404).json({ error: "User nicht gefunden" });
      return;
    }

    // User sperren
    await prisma.user.update({
      where: { id },
      data: { isBlacklisted: true },
    });

    // Automatisch aus der Referral-Kette entfernen (Kaskade)
    const { relinked, hadRelation } = await cascadeRemoveFromChain(id);

    res.json({
      success: true,
      message: `${user.email} gesperrt und aus Referral-Kette entfernt`,
      chainRemoved: hadRelation,
      relinked,
      note: hadRelation
        ? `${relinked} Kinder wurden zum nächsten Parent verknüpft`
        : "War nicht in der Referral-Kette",
    });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/admin/unblacklist/:id
// Entsperrt User — fügt ihn NICHT automatisch zur Kette hinzu.
// Muss manuell via setInviter / make-l1 wieder eingetragen werden.
router.post("/unblacklist/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const user = await prisma.user.update({
      where: { id },
      data: { isBlacklisted: false },
    });
    res.json({
      success: true,
      message: `${user.email} entsperrt. Kette muss manuell neu gesetzt werden.`,
    });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/admin/referral-script-address
router.get("/referral-script-address", async (_req: Request, res: Response) => {
  try {
    const address = await getReferralScriptAddress();
    res.json({
      address,
      network: process.env.CARDANO_NETWORK || "preprod",
      explorer: `https://preprod.cardanoscan.io/address/${address}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Script-Adresse konnte nicht berechnet werden" });
  }
});

export default router;