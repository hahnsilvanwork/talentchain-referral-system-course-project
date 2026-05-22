import { blockfrost } from "./blockfrost";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function deployContracts() {
  // plutus.json lesen
  const plutusPath = path.join(__dirname, "../../contracts/plutus.json");
  const plutus = JSON.parse(fs.readFileSync(plutusPath, "utf-8"));

  console.log("Validators gefunden:");
  plutus.validators.forEach((v: any) => {
    console.log(`- ${v.title}: ${v.compiledCode.slice(0, 20)}...`);
  });

  console.log("\nAdmin PKH:", process.env.ADMIN_WALLET_PKH);
  console.log("\nContracts bereit zum Deployen!");
}

deployContracts();