/**
 * api/routes/admin.ts (updated)
 * ─────────────────────────────────────────────────────────────────
 * Admin-Endpunkte.
 *
 * Änderungen gegenüber der alten Version:
 *   - make-l1: erstellt jetzt on-chain UTxO + DB-Eintrag synchron
 *   - Neuer Endpunkt: GET /api/admin/referral-script-address
 *     → gibt die Script-Adresse des referral_registry Validators zurück
 */

import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { createReferralUtxo, getReferralScriptAddress } from "../../chain/referral-chain";

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

    if (!existing) {
      // On-chain UTxO erstellen (inviter = None = L1 Root)
      try {
        utxoTxHash = await createReferralUtxo(
          null, // inviter = None → L1 Root
          user.walletPkh,
          user.walletPkh.slice(0, 32) // Identity NFT Asset Name
        );
        onChainStatus = "created";
        console.log(
          `L1 Root UTxO on-chain: ${utxoTxHash} für ${user.email}`
        );
      } catch (chainErr) {
        console.error("On-chain L1 UTxO fehlgeschlagen:", chainErr);
        onChainStatus = "failed";
        // Weiter — DB-Fallback
      }

      // DB-Eintrag
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);
      await prisma.referralRelation.create({
        data: {
          inviterId: null,
          inviteeId: id,
          expiresAt,
          utxoTxHash,
        },
      });
    }

    res.json({
      success: true,
      message: `${user.email} ist jetzt L1 Ambassador`,
      onChain: onChainStatus,
      utxoTxHash,
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
router.post("/blacklist/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const user = await prisma.user.update({
      where: { id },
      data: { isBlacklisted: true },
    });
    res.json({ success: true, message: `${user.email} gesperrt` });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/admin/unblacklist/:id
router.post("/unblacklist/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const user = await prisma.user.update({
      where: { id },
      data: { isBlacklisted: false },
    });
    res.json({ success: true, message: `${user.email} entsperrt` });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/admin/referral-script-address
// Gibt die Script-Adresse des referral_registry Validators zurück
// → nützlich für Blockfrost-Abfragen und Debugging
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