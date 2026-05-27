/**
 * api/routes/referral.ts
 * ─────────────────────────────────────────────────────────────────
 * Endpunkte:
 *   POST   /api/referral/create
 *   GET    /api/referral/chain/:userId     on-chain primär, DB fallback
 *   GET    /api/referral/downline/:userId  immer DB (zuverlässiger/vollständig)
 *   GET    /api/referral/all
 *   GET    /api/referral/my
 *   GET    /api/referral/my-code
 *   DELETE /api/referral/remove/:userId
 *   GET    /api/referral/sync
 */

import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import {
  getAllReferralUtxos,
  traverseChainOnChain,
  createReferralUtxo,
} from "../../chain/referral-chain";
import { cascadeRemoveFromChain, addToChainWithCode } from "../../chain/chain-utils";

const router = Router();

// ── Hilfsfunktionen ────────────────────────────────────────────────────

async function enrichWithUserData(pkhs: string[]) {
  if (pkhs.length === 0) return {};
  const users = await prisma.user.findMany({
    where: { walletPkh: { in: pkhs } },
    select: { id: true, email: true, walletAddress: true, walletPkh: true, role: true },
  });
  const map: Record<string, (typeof users)[0]> = {};
  for (const u of users) map[u.walletPkh] = u;
  return map;
}

async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// ── POST /api/referral/create ──────────────────────────────────────────
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { inviterId, inviteeId } = req.body;

    const invitee = await prisma.user.findUnique({ where: { id: inviteeId } });
    if (!invitee) { res.status(404).json({ error: "Invitee nicht gefunden" }); return; }

    let inviter: { walletPkh: string; id: string } | null = null;
    if (inviterId) {
      inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: { walletPkh: true, id: true },
      });
      if (!inviter) { res.status(404).json({ error: "Inviter nicht gefunden" }); return; }
    }

    const existing = await prisma.referralRelation.findFirst({ where: { inviteeId } });
    if (existing) { res.status(400).json({ error: "User bereits in Referral-Kette" }); return; }

    // On-chain UTxO
    let utxoTxHash: string | null = null;
    try {
      utxoTxHash = await createReferralUtxo(
        inviter?.walletPkh ?? null,
        invitee.walletPkh,
        invitee.walletPkh.slice(0, 32)
      );
    } catch (chainErr) {
      console.error("On-chain UTxO fehlgeschlagen:", chainErr);
    }

    const { inviteCode, relation } = await addToChainWithCode(
      inviteeId,
      inviterId || null,
      utxoTxHash
    );

    res.json({
      success: true,
      relation,
      onChain: utxoTxHash !== null,
      utxoTxHash,
      inviteCode,
      message: utxoTxHash
        ? `On-chain gespeichert (TX: ${utxoTxHash.slice(0, 14)}…)`
        : "In DB gespeichert (on-chain fehlgeschlagen)",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/my-code ──────────────────────────────────────────
router.get("/my-code", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Nicht autorisiert" }); return; }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true, usedInviteCode: true, role: true, email: true },
    });
    if (!user) { res.status(404).json({ error: "User nicht gefunden" }); return; }

    const relation = await prisma.referralRelation.findFirst({
      where: { inviteeId: userId },
      include: { inviter: { select: { email: true } } },
    });

    const isInChain = relation !== null || user.role === "L1_AMBASSADOR";

    if (!isInChain || !user.inviteCode) {
      res.json({
        hasCode: false,
        inviteCode: null,
        message: "Du bist nicht im Referral-Netzwerk.",
      });
      return;
    }

    const invitedCount = await prisma.user.count({
      where: { usedInviteCode: user.inviteCode },
    });

    res.json({
      hasCode: true,
      inviteCode: user.inviteCode,
      invitedCount,
      invitedBy: relation?.inviter?.email ?? null,
      shareLink: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?ref=${user.inviteCode}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/chain/:userId — Upline (on-chain primär) ─────────
router.get("/chain/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: "User nicht gefunden" }); return; }

    let chain: {
      layer: number; user: any; inviter: any; onChain: boolean; utxoTxHash?: string;
    }[] = [];
    let onChainSuccess = false;

    // Versuch 1: On-chain
    try {
      const utxos = await getAllReferralUtxos();
      const rawChain = await traverseChainOnChain(user.walletPkh, utxos);

      if (rawChain.length > 0) {
        const allPkhs = rawChain.map((n) => n.walletPkh);
        const userMap = await enrichWithUserData(allPkhs);

        chain = rawChain.map((node) => ({
          layer: node.layer,
          user: userMap[node.walletPkh] ?? { id: null, email: `${node.walletPkh.slice(0, 10)}…`, walletPkh: node.walletPkh, role: "USER" },
          inviter: node.inviterPkh
            ? userMap[node.inviterPkh] ?? { id: null, email: `${node.inviterPkh.slice(0, 10)}…`, walletPkh: node.inviterPkh, role: "USER" }
            : null,
          onChain: true,
          utxoTxHash: node.utxoTxHash,
        }));
        onChainSuccess = true;
      }
    } catch (chainErr) {
      console.warn("On-chain Kette fehlgeschlagen, nutze DB:", chainErr);
    }

    // Fallback: DB
    if (!onChainSuccess) {
      const allRelations = await prisma.referralRelation.findMany({
        include: {
          invitee: { select: { id: true, email: true, walletAddress: true, walletPkh: true, role: true } },
          inviter: { select: { id: true, email: true, walletAddress: true, walletPkh: true, role: true } },
        },
      });

      const rawChain: typeof chain = [];
      let currentId: string | null = userId;
      for (let i = 0; i < 5; i++) {
        if (!currentId) break;
        const found = allRelations.find((r) => r.inviteeId === currentId);
        if (!found) break;
        rawChain.push({
          layer: i, user: found.invitee, inviter: found.inviter ?? null,
          onChain: false, utxoTxHash: found.utxoTxHash ?? undefined,
        });
        currentId = found.inviterId ?? null;
      }
      chain = rawChain.reverse().map((node, i) => ({ ...node, layer: i + 1 }));
    }

    res.json({ chain, length: chain.length, source: onChainSuccess ? "chain" : "db" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/downline/:userId — Downline (immer DB) ───────────
//
// WICHTIG: Downline liest IMMER aus der DB, nie on-chain.
//
// Grund: On-chain UTxOs existieren nur für User die NACH der Migration
// erstellt wurden. Ältere User haben nur DB-Einträge. Wenn on-chain
// nur Layer 2 findet (weil nur L2-UTxOs existieren) und dann stoppt,
// werden L3/L4/L5 nicht angezeigt — obwohl sie in der DB sind.
// Die DB ist für Downline-Abfragen vollständiger und schneller.
router.get("/downline/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: "User nicht gefunden" }); return; }

    // Alle Relationen einmal laden
    const allRelations = await prisma.referralRelation.findMany({
      include: {
        invitee: { select: { id: true, email: true, role: true } },
      },
    });

    // Layer-Position des Users berechnen
    let userLayer = 0;
    let currentId: string | null = userId;
    for (let i = 0; i < 5; i++) {
      const rel = allRelations.find((r) => r.inviteeId === currentId);
      if (!rel) break;
      userLayer++;
      currentId = rel.inviterId ?? null;
    }

    // Rekursive DB-Traversal nach unten
    function getDownlineDb(
      parentId: string,
      depth: number
    ): { layer: number; users: any[] }[] {
      if (depth > 5) return [];
      const children = allRelations.filter((r) => r.inviterId === parentId);
      if (children.length === 0) return [];

      const result: { layer: number; users: any[] }[] = [];
      const layerNum = userLayer + depth;
      result.push({ layer: layerNum, users: children.map((c) => c.invitee) });

      for (const child of children) {
        const sub = getDownlineDb(child.inviteeId, depth + 1);
        for (const s of sub) {
          const ex = result.find((r) => r.layer === s.layer);
          if (ex) ex.users.push(...s.users);
          else result.push(s);
        }
      }
      return result;
    }

    const downlineResult = getDownlineDb(userId, 1);
    const totalCount = downlineResult.reduce((sum, d) => sum + d.users.length, 0);

    res.json({
      userId,
      userLayer,
      downline: downlineResult.sort((a, b) => a.layer - b.layer),
      totalCount,
      source: "db",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/all ──────────────────────────────────────────────
router.get("/all", async (_req: Request, res: Response) => {
  try {
    const relations = await prisma.referralRelation.findMany({
      include: {
        invitee: { select: { id: true, email: true, walletAddress: true, role: true } },
        inviter: { select: { id: true, email: true, walletAddress: true, role: true } },
      },
    });
    res.json(relations.map((r) => ({ ...r, onChain: r.utxoTxHash !== null })));
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/my ───────────────────────────────────────────────
router.get("/my", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) { res.status(401).json({ error: "Kein Token" }); return; }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    const allRelations = await prisma.referralRelation.findMany({
      include: {
        invitee: { select: { id: true, role: true } },
        inviter: { select: { id: true, role: true } },
      },
    });

    // Layer + eigenes UTxO bestimmen
    let userLayer = 0;
    let currentId: string | null = userId;
    let myUtxoTxHash: string | null = null;
    for (let i = 0; i < 5; i++) {
      const rel = allRelations.find((r) => r.inviteeId === currentId);
      if (!rel) break;
      if (currentId === userId) myUtxoTxHash = rel.utxoTxHash ?? null;
      userLayer++;
      currentId = rel.inviterId ?? null;
    }

    // Downline zählen
    function countDownline(parentId: string, depth: number): { layer: number; count: number }[] {
      if (depth > 5) return [];
      const children = allRelations.filter((r) => r.inviterId === parentId);
      if (children.length === 0) return [];
      const result: { layer: number; count: number }[] = [];
      result.push({ layer: userLayer + depth, count: children.length });
      for (const child of children) {
        const sub = countDownline(child.inviteeId, depth + 1);
        for (const s of sub) {
          const ex = result.find((r) => r.layer === s.layer);
          if (ex) ex.count += s.count;
          else result.push({ ...s });
        }
      }
      return result;
    }

    const downlineCounts = countDownline(userId, 1);
    const totalDownline = downlineCounts.reduce((s, d) => s + d.count, 0);

    res.json({
      userId,
      userLayer,
      downlineCounts: downlineCounts.sort((a, b) => a.layer - b.layer),
      totalDownline,
      isInChain: userLayer > 0,
      utxoTxHash: myUtxoTxHash,
      walletAddress: user?.walletAddress,
    });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── DELETE /api/referral/remove/:userId ────────────────────────────────
router.delete("/remove/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const { relinked, hadRelation } = await cascadeRemoveFromChain(userId);
    res.json({
      success: true,
      message: `User aus Kette entfernt. ${relinked} Kinder neu verknüpft.`,
      relinked,
      hadRelation,
      chainNote: "On-chain UTxO bleibt permanent erhalten.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/sync ─────────────────────────────────────────────
router.get("/sync", async (_req: Request, res: Response) => {
  try {
    const utxos = await getAllReferralUtxos();
    let created = 0;
    let skipped = 0;

    for (const utxo of utxos) {
      const inviteeUser = await prisma.user.findFirst({
        where: { walletPkh: utxo.datum.invitee },
      });
      if (!inviteeUser) { skipped++; continue; }

      let inviterUser: { id: string } | null = null;
      if (utxo.datum.inviter) {
        inviterUser = await prisma.user.findFirst({
          where: { walletPkh: utxo.datum.inviter },
          select: { id: true },
        });
      }

      const existing = await prisma.referralRelation.findFirst({
        where: { inviteeId: inviteeUser.id },
      });
      if (existing) {
        // UTxO Hash aktualisieren falls noch nicht gesetzt
        if (!existing.utxoTxHash) {
          await prisma.referralRelation.update({
            where: { id: existing.id },
            data: { utxoTxHash: utxo.txHash },
          });
          created++;
        } else {
          skipped++;
        }
        continue;
      }

      await addToChainWithCode(inviteeUser.id, inviterUser?.id ?? null, utxo.txHash);
      created++;
    }

    res.json({
      success: true,
      onChainUtxos: utxos.length,
      updated: created,
      skipped,
      message: `Sync abgeschlossen: ${created} Einträge aktualisiert.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Sync Fehler" });
  }
});

export default router;