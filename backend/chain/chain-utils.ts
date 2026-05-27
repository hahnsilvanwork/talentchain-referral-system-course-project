/**
 * chain-utils.ts
 * ─────────────────────────────────────────────────────────────────
 * Gemeinsame Hilfsfunktionen für Referral-Ketten-Management.
 *
 * Genutzt von: auth.ts, referral.ts (routes), admin.ts
 */

import prisma from "../prisma/client";

// ── Invite-Code Generierung ───────────────────────────────────────────

// Format: TC-XXXXXX (6 Zeichen, keine verwechselbaren Buchstaben)
// Später erweiterbar zu: https://talentchain.ch/join?ref=TC-XXXXXX
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "TC-";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Erstellt einen einzigartigen Invite-Code (mit Kollisions-Check).
 */
export async function createUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = await prisma.user.findUnique({
      where: { inviteCode: code },
    });
    if (!existing) return code;
  }
  // Sehr unwahrscheinlich — 32^6 = ~1 Mrd. mögliche Codes
  throw new Error("Konnte keinen einzigartigen Invite-Code generieren");
}

// ── Kaskaden-Entfernung aus der Kette ────────────────────────────────

/**
 * Entfernt einen User aus der Referral-Kette (DB) und verknüpft
 * seine direkten Kinder mit seinem Parent.
 *
 * Beispiel:
 *   Vorher: L1 → L2(X) → L3 → L4
 *   X wird entfernt
 *   Nachher: L1 → L3 → L4   (L3 rückt auf L2, L4 auf L3)
 *
 * Hinweis: On-Chain UTxOs bleiben bestehen (Blockchain ist unveränderlich).
 * Die DB ist der operative Stand. Bei reward/distribute wird DB als
 * Fallback genutzt wenn on-chain Traversal fehlschlägt.
 *
 * @returns Anzahl der neu verknüpften Kinder
 */
export async function cascadeRemoveFromChain(
  userId: string
): Promise<{ relinked: number; hadRelation: boolean }> {
  // Eigene Relation (als Invitee) → gibt uns den Parent
  const ownRelation = await prisma.referralRelation.findFirst({
    where: { inviteeId: userId },
  });

  // Direkte Kinder (alle die diesen User als Inviter haben)
  const childRelations = await prisma.referralRelation.findMany({
    where: { inviterId: userId },
  });

  // Parent des entfernten Users (null = wird zu L1-Root-Kindern)
  const newInviterId = ownRelation?.inviterId ?? null;

  // Alle Kinder auf den neuen Parent umlenken
  for (const child of childRelations) {
    await prisma.referralRelation.update({
      where: { id: child.id },
      data: { inviterId: newInviterId },
    });
  }

  // Eigene Relation löschen
  if (ownRelation) {
    await prisma.referralRelation.delete({
      where: { id: ownRelation.id },
    });
  }

  // Invite-Code entfernen — User ist nicht mehr in der Kette
  // und darf niemanden mehr einladen
  await prisma.user.update({
    where: { id: userId },
    data: { inviteCode: null },
  });

  return {
    relinked: childRelations.length,
    hadRelation: ownRelation !== null,
  };
}

/**
 * Erstellt eine Referral-Relation in der DB und weist dem Invitee
 * einen Invite-Code zu (falls noch keiner vorhanden).
 *
 * Wird genutzt von: auth.ts (Register), admin.ts (make-l1, setInviter)
 */
export async function addToChainWithCode(
  inviteeId: string,
  inviterId: string | null,
  utxoTxHash: string | null
): Promise<{ inviteCode: string; relation: any }> {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  // Relation erstellen
  const relation = await prisma.referralRelation.create({
    data: {
      inviterId,
      inviteeId,
      expiresAt,
      utxoTxHash,
    },
  });

  // Invite-Code zuweisen wenn noch keiner vorhanden
  const user = await prisma.user.findUnique({ where: { id: inviteeId } });
  let inviteCode = user?.inviteCode ?? null;

  if (!inviteCode) {
    inviteCode = await createUniqueInviteCode();
    await prisma.user.update({
      where: { id: inviteeId },
      data: { inviteCode },
    });
  }

  return { inviteCode, relation };
}