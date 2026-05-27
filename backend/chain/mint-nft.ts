import {
  Lucid,
  Blockfrost,
  fromText,
  MintingPolicy,
  Data,
  mintingPolicyToId,
  applyParamsToScript,
} from "@lucid-evolution/lucid";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import * as bip39lib from "bip39";
import * as blake from "blakejs";
import { blockfrost } from "./blockfrost";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// FIX: ADMIN_ADDRESS kommt aus der .env, nicht hardcoded
// Setzt voraus: ADMIN_ADDRESS=addr_test1... in .env
function getAdminAddress(): string {
  const addr = process.env.ADMIN_ADDRESS;
  if (!addr) throw new Error("ADMIN_ADDRESS nicht in .env gesetzt");
  return addr;
}

async function getLucid() {
  const lucid = await Lucid(
    new Blockfrost(
      "https://cardano-preprod.blockfrost.io/api/v0",
      process.env.BLOCKFROST_API_KEY || ""
    ),
    "Preprod"
  );
  lucid.selectWallet.fromSeed(process.env.ADMIN_SEED_PHRASE || "");
  return lucid;
}

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

function getMintingPolicy(): MintingPolicy {
  const plutusPath = path.join(__dirname, "../../contracts/plutus.json");
  const plutus = JSON.parse(fs.readFileSync(plutusPath, "utf-8"));
  const mintingValidator = plutus.validators.find(
    (v: any) =>
      v.title === "identity_minting_policy.identity_minting_policy.mint"
  );
  if (!mintingValidator)
    throw new Error("identity_minting_policy nicht gefunden");

  const adminPkh = process.env.ADMIN_WALLET_PKH || "";
  const scriptWithParams = applyParamsToScript(mintingValidator.compiledCode, [
    adminPkh,
  ]);

  return { type: "PlutusV3", script: scriptWithParams };
}

async function signAndSubmit(unsignedCbor: string): Promise<string> {
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

export async function mintIdentityNft(
  recipientAddress: string,
  recipientPkh: string
): Promise<string> {
  const lucid = await getLucid();
  const mintingPolicy = getMintingPolicy();
  const policyId = mintingPolicyToId(mintingPolicy);
  const adminAddress = getAdminAddress();

  console.log("Policy ID:", policyId);
  console.log("Minting NFT fuer:", recipientAddress);

  const assetName = recipientPkh.slice(0, 32);
  const unit = policyId + fromText(assetName);
  const redeemer = Data.void();

  const tx = await lucid
    .newTx()
    .mintAssets({ [unit]: 1n }, redeemer)
    .attach.MintingPolicy(mintingPolicy)
    .pay.ToAddress(recipientAddress, { [unit]: 1n })
    .addSigner(adminAddress)
    .complete();

  const txHash = await signAndSubmit(tx.toCBOR());
  console.log("NFT Mint TX Hash:", txHash);
  return txHash;
}

export async function hasIdentityNft(walletAddress: string): Promise<boolean> {
  try {
    const mintingPolicy = getMintingPolicy();
    const policyId = mintingPolicyToId(mintingPolicy);
    const lucid = await getLucid();
    const utxos = await lucid.utxosAt(walletAddress);
    return utxos.some((utxo) =>
      Object.keys(utxo.assets).some((k) => k.startsWith(policyId))
    );
  } catch {
    return false;
  }
}