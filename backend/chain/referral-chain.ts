/**
 * referral-chain.ts
 * ─────────────────────────────────────────────────────────────────
 * On-Chain Linked List für TalentChain Referral-Beziehungen.
 *
 * Die Referral-Registry ist ein Spend-Validator auf dem Preprod Testnet.
 * Jede Beziehung ist ein UTxO an der Script-Adresse mit folgendem Datum:
 *
 *   ReferralDatum {
 *     inviter:        Option<ByteArray>   -- None = L1 Root
 *     invitee:        ByteArray           -- PKH des eingeladenen Users
 *     identity_nft:   ByteArray           -- Asset Name des Identity NFT
 *     registered_at:  Int                 -- POSIX ms
 *     expires_at:     Int                 -- POSIX ms
 *   }
 *
 * Datum-Encoding auf Cardano (Plutus Data / CBOR):
 *   Constructor 0 {
 *     field[0]: Option<ByteArray>   → Constructor 0 { bytes } | Constructor 1 {}
 *     field[1]: ByteArray
 *     field[2]: ByteArray
 *     field[3]: Int
 *     field[4]: Int
 *   }
 *
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Lucid,
  Blockfrost,
  applyParamsToScript,
  mintingPolicyToId,
  Constr,
  Data,
  validatorToAddress,
} from "@lucid-evolution/lucid";
import { blockfrost } from "./blockfrost";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// ── Typen ────────────────────────────────────────────────────────────

export interface ReferralDatum {
  inviter: string | null; // PKH hex oder null (= L1 Root)
  invitee: string;        // PKH hex
  identity_nft: string;   // Asset Name hex
  registered_at: number;  // POSIX ms
  expires_at: number;     // POSIX ms
}

export interface ReferralNode {
  walletPkh: string;
  walletAddress: string;
  inviterPkh: string | null;
  layer: number;
  utxoTxHash?: string;
  expiresAt?: number;
}

// ── Script-Adresse berechnen ─────────────────────────────────────────

function getPlutusJson() {
  const p = path.join(__dirname, "../../contracts/plutus.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function getReferralScript() {
  const plutus = getPlutusJson();
  const v = plutus.validators.find(
    (x: any) => x.title === "referral_registry.referral_registry.spend"
  );
  if (!v) throw new Error("referral_registry validator nicht gefunden in plutus.json");
  return v;
}

/**
 * Berechnet die Script-Adresse des referral_registry Validators
 * mit dem gesetzten Admin-PKH Parameter.
 */
export async function getReferralScriptAddress(): Promise<string> {
  const lucid = await Lucid(
    new Blockfrost(
      "https://cardano-preprod.blockfrost.io/api/v0",
      process.env.BLOCKFROST_API_KEY || ""
    ),
    "Preprod"
  );

  const validator = getReferralScript();
  const adminPkh = process.env.ADMIN_WALLET_PKH || "";
  const scriptWithParams = applyParamsToScript(validator.compiledCode, [adminPkh]);

  const script = { type: "PlutusV3" as const, script: scriptWithParams };

  return validatorToAddress("Preprod", script);
}

// ── CBOR / Plutus Datum Parsing ───────────────────────────────────────

/**
 * Parst Plutus Data JSON (Blockfrost Format) zu ReferralDatum.
 *
 * Blockfrost liefert Plutus Data als:
 *   { constructor: N, fields: [...] }
 *   { bytes: "hex" }
 *   { int: N }
 */
function parseDatumJson(datumJson: any): ReferralDatum | null {
  try {
    if (datumJson?.constructor !== 0 || !Array.isArray(datumJson.fields)) {
      return null;
    }

    const fields = datumJson.fields;
    if (fields.length < 5) return null;

    // Feld 0: Option<ByteArray>
    // { constructor: 0, fields: [{ bytes: "..." }] }  = Some(pkh)
    // { constructor: 1, fields: [] }                  = None
    let inviter: string | null = null;
    const inviterField = fields[0];
    if (inviterField?.constructor === 0 && inviterField.fields?.[0]?.bytes) {
      inviter = inviterField.fields[0].bytes;
    }
    // constructor 1 = None → inviter bleibt null

    // Feld 1: invitee ByteArray
    const invitee: string = fields[1]?.bytes ?? "";
    if (!invitee) return null;

    // Feld 2: identity_nft ByteArray
    const identity_nft: string = fields[2]?.bytes ?? "";

    // Feld 3-4: Int (POSIX Timestamps)
    const registered_at: number = Number(fields[3]?.int ?? 0);
    const expires_at: number = Number(fields[4]?.int ?? 0);

    return { inviter, invitee, identity_nft, registered_at, expires_at };
  } catch (e) {
    console.error("Datum Parse Fehler:", e);
    return null;
  }
}

// ── UTxO Abfragen ─────────────────────────────────────────────────────

/** Alle Referral-UTxOs von der Script-Adresse lesen */
export async function getAllReferralUtxos(): Promise<
  { datum: ReferralDatum; txHash: string; outputIndex: number }[]
> {
  const scriptAddress = await getReferralScriptAddress();
  const results: { datum: ReferralDatum; txHash: string; outputIndex: number }[] = [];

  try {
    let page = 1;
    while (true) {
      const utxos = await blockfrost.addressesUtxos(scriptAddress, {
        page,
        count: 100,
        order: "asc",
      });
      if (utxos.length === 0) break;

      for (const utxo of utxos) {
        const datumHash = utxo.data_hash;
        const inlineDatum = (utxo as any).inline_datum;

        let datumJson: any = null;

        if (inlineDatum) {
          // Inline Datum direkt verfügbar (Babbage+ UTxO Format)
          try {
            const { decodeDatum } = await import("./datum-decoder");
            datumJson = decodeDatum(inlineDatum);
          } catch {
            // Fallback: Blockfrost Datum-Endpoint nutzen
            if (datumHash) {
              try {
                const d = await blockfrost.scriptsDatum(datumHash);
                datumJson = (d as any).json_value;
              } catch {}
            }
          }
        } else if (datumHash) {
          try {
            const d = await blockfrost.scriptsDatum(datumHash);
            datumJson = (d as any).json_value;
          } catch {}
        }

        if (!datumJson) continue;

        const datum = parseDatumJson(datumJson);
        if (datum) {
          results.push({
            datum,
            txHash: utxo.tx_hash,
            outputIndex: utxo.output_index,
          });
        }
      }

      if (utxos.length < 100) break;
      page++;
    }
  } catch (e) {
    console.error("Fehler beim Laden der Referral UTxOs:", e);
  }

  return results;
}

/** Referral-Datum für einen bestimmten Invitee (PKH) suchen */
export async function getReferralDatumForInvitee(
  inviteePkh: string
): Promise<{ datum: ReferralDatum; txHash: string } | null> {
  const all = await getAllReferralUtxos();
  const found = all.find((r) => r.datum.invitee === inviteePkh);
  if (!found) return null;
  return { datum: found.datum, txHash: found.txHash };
}

// ── Chain-Traversal ───────────────────────────────────────────────────

/**
 * Traversiert die Referral-Kette on-chain nach OBEN.
 * Startet beim Talent-PKH, folgt inviter-Feldern bis L1 (inviter=None).
 * Maximal 5 Layer tief.
 *
 * Gibt die Kette von OBEN nach UNTEN zurück (L1 zuerst).
 */
export async function traverseChainOnChain(
  talentPkh: string,
  allUtxos?: { datum: ReferralDatum; txHash: string; outputIndex: number }[]
): Promise<ReferralNode[]> {
  const utxos = allUtxos ?? (await getAllReferralUtxos());

  const chain: ReferralNode[] = [];
  let currentPkh: string | null = talentPkh;

  for (let i = 0; i < 5; i++) {
    if (!currentPkh) break;

    const found = utxos.find((u) => u.datum.invitee === currentPkh);
    if (!found) break;

    chain.push({
      walletPkh: found.datum.invitee,
      walletAddress: "", // wird in rewards.ts mit User-Daten angereichert
      inviterPkh: found.datum.inviter,
      layer: i,
      utxoTxHash: found.txHash,
      expiresAt: found.datum.expires_at,
    });

    currentPkh = found.datum.inviter;
  }

  // Kette umkehren: L1 an Index 0
  return chain.reverse().map((node, idx) => ({ ...node, layer: idx + 1 }));
}

/**
 * Downline eines Users: alle Nodes die ihn als inviter haben (rekursiv).
 * Gibt eine flache Liste nach Layer gruppiert zurück.
 */
export async function getDownlineOnChain(
  userPkh: string,
  userLayer: number,
  allUtxos?: { datum: ReferralDatum; txHash: string; outputIndex: number }[]
): Promise<{ layer: number; pkhs: string[] }[]> {
  const utxos = allUtxos ?? (await getAllReferralUtxos());

  function recurse(
    parentPkh: string,
    depth: number
  ): { layer: number; pkhs: string[] }[] {
    if (depth > 5) return [];
    const children = utxos.filter((u) => u.datum.inviter === parentPkh);
    if (children.length === 0) return [];

    const result: { layer: number; pkhs: string[] }[] = [];
    const layerNum = userLayer + depth;
    result.push({ layer: layerNum, pkhs: children.map((c) => c.datum.invitee) });

    for (const child of children) {
      const sub = recurse(child.datum.invitee, depth + 1);
      for (const s of sub) {
        const existing = result.find((r) => r.layer === s.layer);
        if (existing) existing.pkhs.push(...s.pkhs);
        else result.push(s);
      }
    }
    return result;
  }

  return recurse(userPkh, 1).sort((a, b) => a.layer - b.layer);
}

// ── On-Chain UTxO erstellen ───────────────────────────────────────────

/**
 * Erstellt ein Referral-UTxO on-chain.
 * Sendet 2 ADA (minUTxO) an die Script-Adresse mit dem ReferralDatum.
 *
 * Muss vom Admin-Wallet signiert werden.
 * In der Produktion: beide Parteien (inviter + invitee) müssen signieren.
 * Für den Admin-Flow: Admin signiert stellvertretend.
 */
export async function createReferralUtxo(
  inviterPkh: string | null,
  inviteePkh: string,
  identityNft: string
): Promise<string> {
  const lucid = await Lucid(
    new Blockfrost(
      "https://cardano-preprod.blockfrost.io/api/v0",
      process.env.BLOCKFROST_API_KEY || ""
    ),
    "Preprod"
  );
  lucid.selectWallet.fromSeed(process.env.ADMIN_SEED_PHRASE || "");

  const scriptAddress = await getReferralScriptAddress();
  const now = Date.now();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;

  // ReferralDatum als Plutus Data bauen
  // Schema: Constr 0 [ Option<Bytes>, Bytes, Bytes, Int, Int ]
  // Option<Bytes>: Constr 0 [pkh] = Some(pkh) | Constr 1 [] = None
  const datum = Data.to(
    new Constr(0, [
      inviterPkh !== null
        ? new Constr(0, [inviterPkh])
        : new Constr(1, []),
      inviteePkh,
      identityNft,
      BigInt(now),
      BigInt(now + twoYearsMs),
    ])
  );

  const adminAddress = await lucid.wallet().address();

  const tx = await lucid
    .newTx()
    .pay.ToAddressWithData(
      scriptAddress,
      { kind: "inline", value: datum },
      { lovelace: 2_000_000n }
    )
    .addSigner(adminAddress)
    .complete();

  const { signAndSubmitWithCsl } = await import("./tx-signer");
  const txHash = await signAndSubmitWithCsl(tx.toCBOR());

  console.log(`Referral UTxO erstellt: ${txHash}`);
  console.log(
    `  inviter: ${inviterPkh ?? "null (L1 Root)"} → invitee: ${inviteePkh}`
  );
  return txHash;
}