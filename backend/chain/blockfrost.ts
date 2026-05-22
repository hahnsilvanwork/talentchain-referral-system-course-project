import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import dotenv from "dotenv";

dotenv.config();

export const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_API_KEY || "",
  network: "preprod",
});

// Wallet UTxOs abfragen
export async function getWalletUtxos(address: string) {
  try {
    const utxos = await blockfrost.addressesUtxos(address);
    return utxos;
  } catch (error) {
    console.error("Fehler beim Abrufen der UTxOs:", error);
    return [];
  }
}

// Prüfen ob Wallet einen Identity NFT hat
export async function hasIdentityNft(
  address: string,
  policyId: string
): Promise<boolean> {
  try {
    const utxos = await blockfrost.addressesUtxos(address);
    return utxos.some((utxo) =>
      Object.keys(utxo.amount).some((unit) => unit.startsWith(policyId))
    );
  } catch (error) {
    console.error("Fehler beim NFT-Check:", error);
    return false;
  }
}

// Transaktion History abrufen
export async function getTxHistory(address: string) {
  try {
    const txs = await blockfrost.addressesTransactions(address);
    return txs;
  } catch (error) {
    console.error("Fehler beim Abrufen der Tx-History:", error);
    return [];
  }
}