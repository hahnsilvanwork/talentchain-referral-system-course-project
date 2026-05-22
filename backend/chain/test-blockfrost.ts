import { blockfrost } from "./blockfrost";
import { calculateFees, calculateRewards } from "./referral-traversal";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  try {
    // Blockfrost Verbindung testen
    const health = await blockfrost.health();
    console.log("Blockfrost Status:", health);

    // Netzwerk Info
    const network = await blockfrost.network();
    console.log("Netzwerk:", network.stake);

    // Gebühren testen
    const fees = calculateFees(90000, "CH_LEHRE_WITH_TRAINING");
    console.log("Gebühren für CHF 90'000:", fees);

    // Rewards testen — 3 aktive Layer
    const mockChain = [
      { walletPkh: "pkh_l3", inviterPkh: "pkh_l2", layer: 0 },
      { walletPkh: "pkh_l2", inviterPkh: "pkh_l1", layer: 1 },
      { walletPkh: "pkh_l1", inviterPkh: null, layer: 2 },
    ];
    const rewards = calculateRewards(fees.referrerPool, mockChain);
    console.log("Reward-Verteilung:", rewards);

  } catch (error) {
    console.error("Fehler:", error);
  }
}

test();