/**
 * scripts/assign-invite-codes.ts
 * Ausführen: npx ts-node scripts/assign-invite-codes.ts
 */

import prisma from "../prisma/client";
import { createUniqueInviteCode } from "../chain/chain-utils";
import { createReferralUtxo } from "../chain/referral-chain";

const BLOCK_TIME_MS = 22_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  TalentChain — Invite Code Migration");
  console.log("═══════════════════════════════════════════\n");

  // Schritt 1: Invite-Codes vergeben
  console.log("Schritt 1: Invite-Codes vergeben...\n");

  const usersNeedingCode = await prisma.user.findMany({
    where: {
      OR: [
        { role: "L1_AMBASSADOR" },
        { referralsReceived: { some: {} } },
      ],
      inviteCode: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`${usersNeedingCode.length} User ohne Code gefunden\n`);

  for (const user of usersNeedingCode) {
    const code = await createUniqueInviteCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { inviteCode: code },
    });
    console.log(`✓ ${user.email.padEnd(35)} → ${code}`);
  }

  console.log(`\n${usersNeedingCode.length} Codes vergeben.\n`);

  // Schritt 2: Fehlende on-chain UTxOs erstellen
  console.log("═══════════════════════════════════════════");
  console.log("Schritt 2: Fehlende on-chain UTxOs erstellen...");
  console.log(`(${BLOCK_TIME_MS / 1000}s Pause zwischen jeder TX)\n`);

  const relationsWithoutUtxo = await prisma.referralRelation.findMany({
    where: { utxoTxHash: null },
    include: {
      invitee: { select: { id: true, email: true, walletPkh: true } },
      inviter: { select: { id: true, email: true, walletPkh: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${relationsWithoutUtxo.length} Beziehungen ohne UTxO gefunden\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < relationsWithoutUtxo.length; i++) {
    const rel = relationsWithoutUtxo[i];
    const prefix = `[${i + 1}/${relationsWithoutUtxo.length}]`;

    console.log(`${prefix} ${rel.invitee.email}`);
    console.log(`         inviter: ${rel.inviter?.email ?? "null (L1 Root)"}`);

    try {
      const txHash = await createReferralUtxo(
        rel.inviter?.walletPkh ?? null,
        rel.invitee.walletPkh,
        rel.invitee.walletPkh.slice(0, 32)
      );

      await prisma.referralRelation.update({
        where: { id: rel.id },
        data: { utxoTxHash: txHash },
      });

      console.log(`         ✓ TX: ${txHash.slice(0, 20)}…`);
      successCount++;

      if (i < relationsWithoutUtxo.length - 1) {
        console.log(`         ⏳ Warte ${BLOCK_TIME_MS / 1000}s auf Block-Bestätigung...\n`);
        await sleep(BLOCK_TIME_MS);
      }
    } catch (err: any) {
      console.log(`         ✗ Fehlgeschlagen: ${err.message?.slice(0, 80)}`);
      console.log(`           → DB-Eintrag bleibt ohne UTxO (Fallback aktiv)\n`);
      failCount++;

      if (i < relationsWithoutUtxo.length - 1) {
        console.log(`         ⏳ Warte ${BLOCK_TIME_MS / 1000}s...\n`);
        await sleep(BLOCK_TIME_MS);
      }
    }
  }

  // Zusammenfassung
  console.log("\n═══════════════════════════════════════════");
  console.log("  Migration abgeschlossen");
  console.log("═══════════════════════════════════════════");
  console.log(`  Codes vergeben:    ${usersNeedingCode.length}`);
  console.log(`  UTxOs erstellt:    ${successCount}`);
  console.log(`  UTxOs fehlgeschl.: ${failCount}`);

  if (failCount > 0) {
    console.log("\n  Fehlgeschlagene UTxOs können später mit");
    console.log("  GET /api/referral/sync nachgeholt werden.");
  }

  console.log("═══════════════════════════════════════════\n");

  process.exit(0);
}

run().catch((err) => {
  console.error("Migration fehlgeschlagen:", err);
  process.exit(1);
});