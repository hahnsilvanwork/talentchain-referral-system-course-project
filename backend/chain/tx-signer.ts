/**
 * tx-signer.ts
 * ─────────────────────────────────────────────────────────────────
 * Gemeinsamer Helper zum Signieren + Submitten von Lucid Evolution
 * Transaktionen via CSL (Cardano Serialization Library).
 *
 * Pattern aus mint-nft.ts extrahiert damit es überall nutzbar ist.
 */

import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import * as bip39lib from "bip39";
import * as blake from "blakejs";
import { blockfrost } from "./blockfrost";
import dotenv from "dotenv";

dotenv.config();

function getPaymentKey(): CSL.PrivateKey {
  const entropy = bip39lib.mnemonicToEntropy(
    process.env.ADMIN_SEED_PHRASE || ""
  );
  const rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from("")
  );
  return rootKey
    .derive(0x80000000 + 1852)
    .derive(0x80000000 + 1815)
    .derive(0x80000000 + 0)
    .derive(0)
    .derive(0)
    .to_raw_key();
}

/**
 * Signiert eine Lucid-Transaktion (CBOR hex) mit dem Admin-Payment-Key
 * und submitted sie via Blockfrost.
 *
 * Gleiche Logik wie in mint-nft.ts → signAndSubmit()
 */
export async function signAndSubmitWithCsl(unsignedCbor: string): Promise<string> {
  const paymentKey = getPaymentKey();
  const txBody = CSL.Transaction.from_hex(unsignedCbor).body();
  const txHash = CSL.TransactionHash.from_bytes(
    blake.blake2b(txBody.to_bytes(), undefined, 32)
  );
  const vkeyWitness = CSL.make_vkey_witness(txHash, paymentKey);
  const witnesses = CSL.Transaction.from_hex(unsignedCbor).witness_set();
  const vkeys = CSL.Vkeywitnesses.new();
  vkeys.add(vkeyWitness);
  witnesses.set_vkeys(vkeys);
  const signedTx = CSL.Transaction.new(txBody, witnesses, undefined);
  const signedCbor = Buffer.from(signedTx.to_bytes()).toString("hex");
  return await blockfrost.txSubmit(signedCbor);
}