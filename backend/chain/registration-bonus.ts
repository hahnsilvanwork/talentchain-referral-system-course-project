/**
 * chain/registration-bonus.ts
 *
 * Registrierungsbonus laut Doku UC-04:
 *   CHF 60 total
 *   75% (CHF 45) → direkter Einlader
 *   17% (CHF 10) → Layer darüber
 *    8% (CHF  5) → L1 Ambassador
 */

import prisma from "../prisma/client";
import { buildAndSubmitTx } from "./cardano-tx";

// FIX: CHF 60 laut Doku UC-04 (war fälschlicherweise 75)
const BONUS_TOTAL_CHF = 60;
const DIRECT_SHARE    = 0.75;  // 75% = CHF 45
const UPPER_SHARE     = 0.25;  // 25% = CHF 15 aufgeteilt auf obere Layer

// Prozentsätze für obere Layer (von den 25%)
// 1 Layer oben:  100% von 25% = CHF 15
// 2 Layer oben:  67/33 = CHF 10 / CHF 5
// 3+ Layer oben: 55/30/15 usw.
const UPPER_PERCENTAGES: Record<number, number[]> = {
  1: [100],
  2: [67, 33],
  3: [55, 30, 15],
  4: [50, 28, 15, 7],
};

export interface BonusPayment {
  address: string;
  lovelace: number;
  chf: number;
  description: string;
  email: string;
}

export interface BonusResult {
  txHash: string;
  payments: BonusPayment[];
  totalChf: number;
  totalLovelace: number;
}

// Einheitliche CHF → Lovelace Konvertierung
// Testnet: 1 CHF = 0.01 ADA, mindestens 1.5 ADA (Cardano minUTxO)
function chfToLovelace(chf: number): number {
  const CHF_TO_ADA = 0.01;
  const lovelace = Math.floor(chf * CHF_TO_ADA * 1_000_000);
  return Math.max(lovelace, 1_500_000);
}

/**
 * Sendet den Registrierungsbonus (CHF 60) an den Einlader und obere Layer.
 *
 * @param inviteeId   DB-ID des neu registrierten Users
 * @param lastTxHash  TX-Hash der letzten Admin-TX (Referral UTxO TX) —
 *                    wird als UTxO-Hint weitergegeben
 */
export async function sendRegistrationBonus(
  inviteeId: string,
  lastTxHash?: string
): Promise<BonusResult | null> {

  // Direkten Einlader laden
  const directRelation = await prisma.referralRelation.findFirst({
    where: { inviteeId },
    include: {
      inviter: {
        select: {
          id: true,
          email: true,
          walletAddress: true,
          isBlacklisted: true,
        },
      },
    },
  });

  if (!directRelation || !directRelation.inviter) {
    console.log(`Registrierungsbonus: kein Einlader für ${inviteeId} → kein Bonus`);
    return null;
  }

  const directInviter = directRelation.inviter;

  if (directInviter.isBlacklisted) {
    console.log(`Registrierungsbonus: Einlader ${directInviter.email} ist gesperrt → kein Bonus`);
    return null;
  }

  // Alle Relationen für obere Layer laden
  const allRelations = await prisma.referralRelation.findMany({
    include: {
      inviter: {
        select: {
          id: true,
          email: true,
          walletAddress: true,
          isBlacklisted: true,
        },
      },
    },
  });

  // Obere Layer sammeln (bis zu 4 Layer über dem direkten Einlader)
  const upperLayers: { email: string; walletAddress: string }[] = [];
  let currentId: string | null = directRelation.inviterId;

  for (let i = 0; i < 4; i++) {
    if (!currentId) break;
    const rel = allRelations.find((r) => r.inviteeId === currentId);
    if (!rel || !rel.inviter) break;
    if (!rel.inviter.isBlacklisted) {
      upperLayers.push({
        email: rel.inviter.email,
        walletAddress: rel.inviter.walletAddress,
      });
    }
    currentId = rel.inviterId ?? null;
  }

  const payments: BonusPayment[] = [];

  // Direkter Einlader: 75% = CHF 45
  const directAmount = BONUS_TOTAL_CHF * DIRECT_SHARE;
  payments.push({
    address: directInviter.walletAddress,
    lovelace: chfToLovelace(directAmount),
    chf: directAmount,
    description: "Direkt-Einlader (75% = CHF 45)",
    email: directInviter.email,
  });

  // Obere Layer: 25% = CHF 15 aufgeteilt
  if (upperLayers.length > 0) {
    const upperAmount = BONUS_TOTAL_CHF * UPPER_SHARE;
    const count = Math.min(upperLayers.length, 4);
    const percentages = UPPER_PERCENTAGES[count] || UPPER_PERCENTAGES[4];

    upperLayers.slice(0, count).forEach((layer, i) => {
      const pct = (percentages[i] ?? 0) / 100;
      const amount = upperAmount * pct;
      if (amount <= 0) return;

      payments.push({
        address: layer.walletAddress,
        lovelace: chfToLovelace(amount),
        chf: amount,
        description: `+${i + 1} Layer oben (${percentages[i]}% von 25%)`,
        email: layer.email,
      });
    });
  }

  // Nur gültige Testnet-Adressen
  const validPayments = payments.filter((p) => {
    if (!p.address) return false;
    if (!p.address.startsWith("addr_test1")) return false;
    if (p.address.length < 50) return false;
    if (p.lovelace <= 0) return false;
    return true;
  });

  if (validPayments.length === 0) {
    console.warn("Registrierungsbonus: keine gültigen Wallet-Adressen gefunden");
    return null;
  }

  console.log(`Registrierungsbonus CHF ${BONUS_TOTAL_CHF}: sende ${validPayments.length} Zahlungen...`);
  validPayments.forEach((p) => {
    console.log(`  ${p.email.padEnd(35)} ${p.description}: CHF ${p.chf.toFixed(2)} (${p.lovelace} lovelace)`);
  });

  const txHash = await buildAndSubmitTx(
    validPayments.map((p) => ({ address: p.address, lovelace: p.lovelace })),
    lastTxHash
  );

  const totalLovelace = validPayments.reduce((s, p) => s + p.lovelace, 0);
  console.log(`Registrierungsbonus TX: ${txHash}`);

  return {
    txHash,
    payments: validPayments,
    totalChf: BONUS_TOTAL_CHF,
    totalLovelace,
  };
}