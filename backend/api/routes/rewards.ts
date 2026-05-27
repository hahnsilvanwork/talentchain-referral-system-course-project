/**
 * api/routes/rewards.ts (updated)
 * ─────────────────────────────────────────────────────────────────
 * Reward-Verteilung mit on-chain Ketten-Traversal.
 *
 * Änderungen:
 *   - distribute: liest Referral-Kette primär on-chain via Blockfrost
 *   - Wallet-Adressen werden aus DB nachgeladen (PKH → address)
 *   - Fallback auf DB-Kette wenn Chain-Traversal fehlschlägt
 */

import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import { calculateFees, calculateRewards } from "../../chain/referral-traversal";
import { sendRewards, chfToLovelace } from "../../chain/send-rewards";
import { getAllReferralUtxos, traverseChainOnChain } from "../../chain/referral-chain";

const router = Router();

// POST /api/rewards/distribute
router.post("/distribute", async (req: Request, res: Response) => {
  try {
    const { matchEventId } = req.body;

    const matchEvent = await prisma.matchEvent.findUnique({
      where: { id: matchEventId },
      include: { talent: true },
    });

    if (!matchEvent) {
      res.status(404).json({ error: "Match-Event nicht gefunden" });
      return;
    }
    if (matchEvent.status === "DISTRIBUTED") {
      res.status(400).json({ error: "Rewards bereits verteilt" });
      return;
    }
    if (matchEvent.status === "CANCELLED") {
      res.status(400).json({ error: "Event wurde storniert" });
      return;
    }

    // ── Referral-Kette ermitteln ─────────────────────────────────
    // Alle User aus DB für PKH → walletAddress Mapping
    const allUsers = await prisma.user.findMany({
      select: { walletPkh: true, walletAddress: true, isBlacklisted: true },
    });
    const pkhToAddress: Record<string, string> = {};
    const pkhBlacklisted: Record<string, boolean> = {};
    for (const u of allUsers) {
      pkhToAddress[u.walletPkh] = u.walletAddress;
      pkhBlacklisted[u.walletPkh] = u.isBlacklisted;
    }

    interface ChainEntry {
      walletPkh: string;
      walletAddress: string;
      inviterPkh: string | null;
      layer: number;
    }

    let chain: ChainEntry[] = [];
    let chainSource = "db";

    // ── Versuch 1: On-Chain Traversal ─────────────────────────────
    try {
      const utxos = await getAllReferralUtxos();
      const rawChain = await traverseChainOnChain(
        matchEvent.talent.walletPkh,
        utxos
      );

      if (rawChain.length > 0) {
        chain = rawChain
          .map((node) => ({
            walletPkh: node.walletPkh,
            walletAddress: pkhToAddress[node.walletPkh] ?? "",
            inviterPkh: node.inviterPkh,
            layer: node.layer,
          }))
          // Blacklistete User überspringen
          .filter((node) => !pkhBlacklisted[node.walletPkh]);
        chainSource = "chain";
      }
    } catch (chainErr) {
      console.warn("On-chain Traversal fehlgeschlagen, nutze DB:", chainErr);
    }

    // ── Fallback: DB Traversal ────────────────────────────────────
    if (chain.length === 0) {
      const allRelations = await prisma.referralRelation.findMany({
        include: {
          invitee: { select: { id: true, walletAddress: true, walletPkh: true, isBlacklisted: true } },
          inviter: { select: { id: true, walletAddress: true, walletPkh: true } },
        },
      });

      let currentId: string | null = matchEvent.talentId;
      for (let i = 0; i < 5; i++) {
        if (!currentId) break;
        const found = allRelations.find((r) => r.inviteeId === currentId);
        if (!found) break;
        if (!found.invitee.isBlacklisted) {
          chain.push({
            walletPkh: found.invitee.walletPkh,
            walletAddress: found.invitee.walletAddress,
            inviterPkh: found.inviter?.walletPkh ?? null,
            layer: i,
          });
        }
        currentId = found.inviterId ?? null;
      }
    }

    if (chain.length === 0) {
      res.status(400).json({
        error: "Keine Referral-Kette gefunden für dieses Talent",
        hint: `Talent PKH: ${matchEvent.talent.walletPkh}`,
      });
      return;
    }

    // ── Rewards berechnen ─────────────────────────────────────────
    const rewards = calculateRewards(matchEvent.referrerPool, chain);

    // ── Payments aufbauen ─────────────────────────────────────────
    const payments = rewards
      .map((r, index) => ({
        address: chain[index]?.walletAddress || "",
        lovelace: Number(chfToLovelace(r.amount)),
        ada: r.amount,
      }))
      .filter((p) => {
        if (!p.address || p.lovelace <= 0) return false;
        if (!p.address.startsWith("addr_test1q")) return false;
        if (p.address.length < 50) return false;
        return true;
      });

    if (payments.length === 0) {
      res.status(400).json({ error: "Keine gültigen Zahlungsadressen in der Kette" });
      return;
    }

    // ── Transaktion senden ─────────────────────────────────────────
    const txHash = await sendRewards(payments, matchEventId);

    await prisma.matchEvent.update({
      where: { id: matchEventId },
      data: { status: "DISTRIBUTED", txHash },
    });

    res.json({
      success: true,
      txHash,
      chainSource,
      payments,
      chain: chain.map((c) => ({ layer: c.layer, walletAddress: c.walletAddress })),
      message: `Rewards verteilt (Kette: ${chainSource})! TX: ${txHash}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/rewards/history — Eigene Reward History aus Blockchain
router.get("/history", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Kein Token" }); return; }

    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) { res.status(404).json({ error: "User nicht gefunden" }); return; }

    const { blockfrost } = await import("../../chain/blockfrost");
    let txHistory: any[] = [];
    try {
      txHistory = await blockfrost.addressesTransactions(
        user.walletAddress,
        { order: "desc", count: 20 }
      );
    } catch {
      txHistory = [];
    }

    const distributedEvents = await prisma.matchEvent.findMany({
      where: { status: "DISTRIBUTED", txHash: { not: null } },
      include: { talent: { select: { email: true } } },
    });

    const history = txHistory.map((tx: any) => {
      const matchEvent = distributedEvents.find((e) => e.txHash === tx.tx_hash);
      return {
        txHash: tx.tx_hash,
        blockTime: tx.block_time,
        matchEvent: matchEvent
          ? {
              id: matchEvent.id,
              totalFee: matchEvent.totalFee,
              scenario: matchEvent.scenario,
              talent: matchEvent.talent.email,
            }
          : null,
      };
    });

    res.json({ walletAddress: user.walletAddress, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

export default router;