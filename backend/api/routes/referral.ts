/**
 * api/routes/referral.ts
 * ─────────────────────────────────────────────────────────────────
 * Referral-Kette: Hybrid-Ansatz
 *
 * - Schreiben:  on-chain UTxO + DB-Spiegelung
 * - Lesen:      on-chain primär (Blockfrost), DB als Fallback
 *
 * Warum Hybrid?
 * Die Cardano Blockchain ist der einzige Source of Truth für Referral-
 * Beziehungen. Aber UTxO-Abfragen über Blockfrost dauern 300-800ms.
 * Die DB ist ein schneller lokaler Cache. Bei jedem Schreiben wird
 * beides aktualisiert. Beim Lesen versuchen wir erst die Chain.
 *
 * Endpunkte:
 *   POST   /api/referral/create          – Beziehung erstellen (on-chain + DB)
 *   GET    /api/referral/chain/:userId   – Kette nach oben (on-chain primär)
 *   GET    /api/referral/downline/:userId
 *   GET    /api/referral/all             – Alle Beziehungen
 *   GET    /api/referral/my              – Eigene Position
 *   DELETE /api/referral/remove/:userId  – Aus DB entfernen (Chain-UTxO bleibt!)
 *   GET    /api/referral/sync            – DB aus Chain synchronisieren (Admin)
 */

import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import {
  getAllReferralUtxos,
  traverseChainOnChain,
  getDownlineOnChain,
  createReferralUtxo,
} from "../../chain/referral-chain";

const router = Router();

// ── Hilfsfunktion: PKH → User aus DB ──────────────────────────────────
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

// ── POST /api/referral/create ──────────────────────────────────────────
// Erstellt eine Referral-Beziehung:
//   1. On-chain UTxO an der referral_registry Script-Adresse
//   2. DB-Eintrag als lokaler Spiegel
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { inviterId, inviteeId } = req.body;

    // Invitee aus DB laden
    const invitee = await prisma.user.findUnique({ where: { id: inviteeId } });
    if (!invitee) {
      res.status(404).json({ error: "Invitee nicht gefunden" });
      return;
    }

    // Einlader (optional)
    let inviter: { walletPkh: string; id: string } | null = null;
    if (inviterId) {
      inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: { walletPkh: true, id: true },
      });
      if (!inviter) {
        res.status(404).json({ error: "Inviter nicht gefunden" });
        return;
      }
    }

    // Doppelregistrierung prüfen (DB-Check, schnell)
    const existing = await prisma.referralRelation.findFirst({
      where: { inviteeId },
    });
    if (existing) {
      res.status(400).json({ error: "User bereits in Referral-Kette" });
      return;
    }

    // On-chain UTxO erstellen
    let utxoTxHash: string | null = null;
    try {
      utxoTxHash = await createReferralUtxo(
        inviter?.walletPkh ?? null,
        invitee.walletPkh,
        invitee.walletPkh.slice(0, 32) // Identity NFT Asset Name (wie beim Minting)
      );
      console.log(`Referral UTxO on-chain: ${utxoTxHash}`);
    } catch (chainErr) {
      console.error("On-chain UTxO Erstellung fehlgeschlagen:", chainErr);
      // Wir fahren trotzdem fort — DB-Eintrag als Fallback
      // Admin kann später via /sync synchronisieren
    }

    // DB-Eintrag (Spiegel der Chain)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    const relation = await prisma.referralRelation.create({
      data: {
        inviterId: inviterId || null,
        inviteeId,
        expiresAt,
        utxoTxHash,
      },
      include: {
        inviter: { select: { email: true, walletAddress: true, walletPkh: true } },
        invitee: { select: { email: true, walletAddress: true, walletPkh: true } },
      },
    });

    res.json({
      success: true,
      relation,
      onChain: utxoTxHash !== null,
      utxoTxHash,
      message: utxoTxHash
        ? `Referral-Beziehung on-chain gespeichert (TX: ${utxoTxHash.slice(0, 14)}…)`
        : "Referral-Beziehung in DB gespeichert (on-chain fehlgeschlagen — sync später möglich)",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/chain/:userId — Kette nach oben ─────────────────
// Liest primär von der Chain, fällt auf DB zurück
router.get("/chain/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User nicht gefunden" });
      return;
    }

    let chain: {
      layer: number;
      user: any;
      inviter: any;
      onChain: boolean;
      utxoTxHash?: string;
    }[] = [];

    // ── Versuch 1: On-Chain lesen ──────────────────────────────────
    let onChainSuccess = false;
    try {
      const utxos = await getAllReferralUtxos();
      const rawChain = await traverseChainOnChain(user.walletPkh, utxos);

      if (rawChain.length > 0) {
        // PKHs sammeln für User-Lookup
        const allPkhs = rawChain.map((n) => n.walletPkh);
        if (rawChain[rawChain.length - 1]?.inviterPkh) {
          // Nochmal der inviter des obersten Nodes
        }
        const userMap = await enrichWithUserData(allPkhs);

        chain = rawChain.map((node) => {
          const nodeUser = userMap[node.walletPkh] ?? {
            id: null,
            email: `${node.walletPkh.slice(0, 10)}…`,
            walletPkh: node.walletPkh,
            role: "USER",
          };
          const inviterUser = node.inviterPkh
            ? userMap[node.inviterPkh] ?? {
                id: null,
                email: `${node.inviterPkh.slice(0, 10)}…`,
                walletPkh: node.inviterPkh,
                role: "USER",
              }
            : null;
          return {
            layer: node.layer,
            user: nodeUser,
            inviter: inviterUser,
            onChain: true,
            utxoTxHash: node.utxoTxHash,
          };
        });

        onChainSuccess = true;
      }
    } catch (chainErr) {
      console.warn("On-chain Kette lesen fehlgeschlagen, nutze DB:", chainErr);
    }

    // ── Fallback: DB lesen ─────────────────────────────────────────
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
          layer: i,
          user: found.invitee,
          inviter: found.inviter ?? null,
          onChain: false,
          utxoTxHash: found.utxoTxHash ?? undefined,
        });
        currentId = found.inviterId ?? null;
      }

      chain = rawChain
        .reverse()
        .map((node, i) => ({ ...node, layer: i + 1 }));
    }

    res.json({
      chain,
      length: chain.length,
      source: onChainSuccess ? "chain" : "db",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/downline/:userId — Downline nach unten ──────────
router.get("/downline/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User nicht gefunden" });
      return;
    }

    // Layer-Position aus DB (schneller als Chain)
    const allRelations = await prisma.referralRelation.findMany();
    let userLayer = 0;
    let currentId: string | null = userId;
    for (let i = 0; i < 5; i++) {
      const rel = allRelations.find((r) => r.inviteeId === currentId);
      if (!rel) break;
      userLayer++;
      currentId = rel.inviterId ?? null;
    }

    let downlineResult: { layer: number; users: any[] }[] = [];
    let source = "db";

    // ── Versuch 1: On-Chain ────────────────────────────────────────
    try {
      const utxos = await getAllReferralUtxos();
      const rawDownline = await getDownlineOnChain(user.walletPkh, userLayer, utxos);

      if (rawDownline.length > 0) {
        const allPkhs = rawDownline.flatMap((d) => d.pkhs);
        const userMap = await enrichWithUserData(allPkhs);

        downlineResult = rawDownline.map((layer) => ({
          layer: layer.layer,
          users: layer.pkhs.map((pkh) =>
            userMap[pkh] ?? {
              id: null,
              email: `${pkh.slice(0, 10)}…`,
              walletPkh: pkh,
              role: "USER",
            }
          ),
        }));
        source = "chain";
      }
    } catch (chainErr) {
      console.warn("On-chain Downline fehlgeschlagen, nutze DB:", chainErr);
    }

    // ── Fallback: DB ───────────────────────────────────────────────
    if (source === "db") {
      const allRelationsWithUsers = await prisma.referralRelation.findMany({
        include: { invitee: { select: { id: true, email: true, role: true } } },
      });

      function getDownlineDb(
        parentId: string,
        depth: number
      ): { layer: number; users: any[] }[] {
        if (depth > 5) return [];
        const children = allRelationsWithUsers.filter(
          (r) => r.inviterId === parentId
        );
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

      downlineResult = getDownlineDb(userId, 1);
    }

    const totalCount = downlineResult.reduce(
      (sum, d) => sum + d.users.length,
      0
    );

    res.json({
      userId,
      userLayer,
      downline: downlineResult.sort((a, b) => a.layer - b.layer),
      totalCount,
      source,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/all ──────────────────────────────────────────────
// Gibt alle Beziehungen zurück — primär DB (schnell), mit on-chain Flag
router.get("/all", async (_req: Request, res: Response) => {
  try {
    const relations = await prisma.referralRelation.findMany({
      include: {
        invitee: { select: { id: true, email: true, walletAddress: true, role: true } },
        inviter: { select: { id: true, email: true, walletAddress: true, role: true } },
      },
    });
    res.json(
      relations.map((r) => ({
        ...r,
        onChain: r.utxoTxHash !== null,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/my ───────────────────────────────────────────────
router.get("/my", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Kein Token" }); return; }

    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as { userId: string };
    const userId = decoded.userId;

    const allRelations = await prisma.referralRelation.findMany({
      include: {
        invitee: { select: { id: true, role: true } },
        inviter: { select: { id: true, role: true } },
      },
    });

    let userLayer = 0;
    let currentId: string | null = userId;
    for (let i = 0; i < 5; i++) {
      const rel = allRelations.find((r) => r.inviteeId === currentId);
      if (!rel) break;
      userLayer++;
      currentId = rel.inviterId ?? null;
    }

    function countDownline(
      parentId: string,
      depth: number
    ): { layer: number; count: number }[] {
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
    });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── DELETE /api/referral/remove/:userId ───────────────────────────────
// Entfernt aus DB — Chain-UTxO bleibt (Blockchain ist unveränderlich!)
// Die Chain-Traversal überspringt blacklistete User automatisch.
router.delete("/remove/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;

    const userRelation = await prisma.referralRelation.findFirst({
      where: { inviteeId: userId },
    });
    const childRelations = await prisma.referralRelation.findMany({
      where: { inviterId: userId },
    });

    const newInviterId = userRelation?.inviterId ?? null;

    for (const child of childRelations) {
      await prisma.referralRelation.update({
        where: { id: child.id },
        data: { inviterId: newInviterId },
      });
    }

    if (userRelation) {
      await prisma.referralRelation.delete({
        where: { id: userRelation.id },
      });
    }

    res.json({
      success: true,
      message: `User aus DB-Kette entfernt. ${childRelations.length} Kinder neu verknüpft. Hinweis: On-Chain UTxO bleibt erhalten (Blockchain ist unveränderlich).`,
      relinked: childRelations.length,
      chainNote:
        "Das Referral-UTxO auf der Cardano Blockchain bleibt permanent. Nur die lokale DB-Kopie wurde entfernt.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// ── GET /api/referral/sync — DB aus Chain synchronisieren (Admin) ──────
// Liest alle on-chain UTxOs und erstellt fehlende DB-Einträge.
// Nützlich wenn on-chain Erstellung erfolgreich war aber DB-Schreiben fehlschlug.
router.get("/sync", async (_req: Request, res: Response) => {
  try {
    const utxos = await getAllReferralUtxos();
    let created = 0;
    let skipped = 0;

    for (const utxo of utxos) {
      // Invitee in DB suchen
      const inviteeUser = await prisma.user.findFirst({
        where: { walletPkh: utxo.datum.invitee },
      });
      if (!inviteeUser) { skipped++; continue; }

      // Einlader suchen (optional)
      let inviterUser: { id: string } | null = null;
      if (utxo.datum.inviter) {
        inviterUser = await prisma.user.findFirst({
          where: { walletPkh: utxo.datum.inviter },
          select: { id: true },
        });
      }

      // DB-Eintrag schon vorhanden?
      const existing = await prisma.referralRelation.findFirst({
        where: { inviteeId: inviteeUser.id },
      });
      if (existing) { skipped++; continue; }

      await prisma.referralRelation.create({
        data: {
          inviterId: inviterUser?.id ?? null,
          inviteeId: inviteeUser.id,
          utxoTxHash: utxo.txHash,
          expiresAt: new Date(utxo.datum.expires_at),
        },
      });
      created++;
    }

    res.json({
      success: true,
      onChainUtxos: utxos.length,
      created,
      skipped,
      message: `Sync abgeschlossen: ${created} neue DB-Einträge aus ${utxos.length} on-chain UTxOs.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Sync Fehler" });
  }
});

export default router;