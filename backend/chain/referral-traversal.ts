import { blockfrost } from "./blockfrost";
import dotenv from "dotenv";

dotenv.config();

export interface ReferralNode {
  walletPkh: string;
  inviterPkh: string | null;
  layer: number;
}

export interface RewardShare {
  walletPkh: string;
  amount: number;
  layer: number;
}

// Normalisierte Prozentsätze pro Anzahl aktiver Layer (aus Projektdoku)
const REWARD_PERCENTAGES: Record<number, number[]> = {
  1: [100],
  2: [68.6, 31.4],
  3: [55.8, 25.6, 18.6],
  4: [50.5, 23.2, 16.8, 9.5],
  5: [48.0, 22.0, 16.0, 9.0, 5.0],
};

// Referral-Kette traversieren — liest UTxOs vom Preprod Testnet
export async function traverseReferralChain(
  talentPkh: string,
  scriptAddress: string
): Promise<ReferralNode[]> {
  const chain: ReferralNode[] = [];
  let currentPkh = talentPkh;
  let layer = 0;

  while (layer < 5) {
    try {
      const utxos = await blockfrost.addressesUtxos(scriptAddress);

      // UTxO finden das zum aktuellen PKH gehört
      const referralUtxo = utxos.find((utxo) => {
        // Datum parsen — invitee muss currentPkh matchen
        return utxo.data_hash !== null;
      });

      if (!referralUtxo) break;

      // In echter Implementierung: Datum dekodieren via Blockfrost
      // Für jetzt: Platzhalter-Struktur
      const node: ReferralNode = {
        walletPkh: currentPkh,
        inviterPkh: null,
        layer,
      };

      chain.push(node);
      layer++;

      if (node.inviterPkh === null) break;
      currentPkh = node.inviterPkh;
    } catch {
      break;
    }
  }

  return chain;
}

// Reward-Beträge berechnen basierend auf aktiven Layern
export function calculateRewards(
  referrerPool: number,
  chain: ReferralNode[]
): RewardShare[] {
  const activeCount = Math.min(chain.length, 5);
  if (activeCount === 0) return [];

  const percentages = REWARD_PERCENTAGES[activeCount] || REWARD_PERCENTAGES[5];

  return chain.slice(0, activeCount).map((node, index) => ({
    walletPkh: node.walletPkh,
    amount: Math.floor((referrerPool * (percentages[index] ?? 0)) / 100),
    layer: node.layer,
  }));
}

// Gesamtgebühr berechnen (aus Projektdoku Abschnitt 7.6)
export function calculateFees(annualSalary: number, scenario: string) {
  const rates: Record<string, number> = {
    CH_LEHRE_WITH_TRAINING: 0.08,
    CH_LEHRE_WITHOUT_TRAINING: 0.15,
    USA_STUDY: 0.10,
    CUSTOM: 0.10,
  };

  const rate = rates[scenario] ?? 0.10;
  const totalFee = annualSalary * rate;
  const referrerPool = totalFee * 0.10;
  const registrationPool = totalFee * 0.05;
  const platformAmount = totalFee * 0.10;
  const remainder = totalFee - referrerPool - registrationPool - platformAmount;

  const institutionShare = scenario === "USA_STUDY" ? 0.05 : 0.75;
  const talentShare = scenario === "USA_STUDY" ? 0.95 : 0.25;

  return {
    totalFee,
    referrerPool,
    registrationPool,
    platformAmount,
    institutionAmount: remainder * institutionShare,
    talentAmount: remainder * talentShare,
  };
}