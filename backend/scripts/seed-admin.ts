/**
 * scripts/seed-admin.ts
 * ─────────────────────────────────────────────────────────────────
 * Erstellt oder upgraded einen User zu ADMIN.
 *
 * Konfiguration in .env unter # SEED ADMIN:
 *   SEED_ADMIN_EMAIL=admin@talentchain.ch
 *   SEED_ADMIN_PASSWORD=sicherespasswort
 *   SEED_ADMIN_WALLET=addr_test1...
 *
 * Ausführen:
 *   npx ts-node scripts/seed-admin.ts
 */

import bcrypt from "bcrypt";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const EMAIL    = process.env.SEED_ADMIN_EMAIL    || "";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "";
const WALLET   = process.env.SEED_ADMIN_WALLET   || "";

async function main() {
  console.log("TalentChain — Admin Seed Script");
  console.log("─────────────────────────────────");

  if (!EMAIL || !PASSWORD || !WALLET) {
    console.error("❌ Fehlende Werte in .env:");
    if (!EMAIL)    console.error("   SEED_ADMIN_EMAIL fehlt");
    if (!PASSWORD) console.error("   SEED_ADMIN_PASSWORD fehlt");
    if (!WALLET)   console.error("   SEED_ADMIN_WALLET fehlt");
    console.error("\nFüge diese Zeilen zu deiner .env hinzu:");
    console.error("   SEED_ADMIN_EMAIL=admin@talentchain.ch");
    console.error("   SEED_ADMIN_PASSWORD=sicherespasswort");
    console.error("   SEED_ADMIN_WALLET=addr_test1...");
    process.exit(1);
  }

  // PKH aus Wallet ableiten
  let walletPkh: string;
  try {
    const addr = CSL.Address.from_bech32(WALLET);
    const baseAddr = CSL.BaseAddress.from_address(addr);
    const pkh = baseAddr?.payment_cred().to_keyhash()?.to_hex();
    if (!pkh) throw new Error("PKH nicht ableitbar");
    walletPkh = pkh;
  } catch (e) {
    console.error("❌ Ungültige SEED_ADMIN_WALLET:", e);
    process.exit(1);
  }

  // Prüfen ob User schon existiert (per Email oder Wallet)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: EMAIL }, { walletAddress: WALLET }] },
  });

  if (existing) {
    // Existiert → zu ADMIN upgraden
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN" },
    });
    console.log(`✓ ${existing.email} → Rolle auf ADMIN gesetzt`);
  } else {
    // Neu erstellen
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash,
        walletAddress: WALLET,
        walletPkh,
        role: "ADMIN",
      },
    });
    console.log(`✓ Neuer Admin erstellt: ${admin.email}`);
  }

  console.log("");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Passwort: ${PASSWORD}`);
  console.log(`  Wallet:   ${WALLET.slice(0, 20)}...`);
  console.log("");
  console.log("→ Einloggen auf http://localhost:3000/login");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Fehler:", e);
  process.exit(1);
});