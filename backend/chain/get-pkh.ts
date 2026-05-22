import dotenv from "dotenv";
dotenv.config();

async function getPkh() {
  const CardanoWasm = await import("@emurgo/cardano-serialization-lib-nodejs");

  const address = CardanoWasm.Address.from_bech32(
    "addr_test1qptplewuhhdzmjh08wt5qhqlkk3h77cqgh4gxwxguu0z8uj32j084fmnqfv6p7wl9gcre3lj39x63q0sx8a876r7ne0smhzn0s"
  );

  const baseAddress = CardanoWasm.BaseAddress.from_address(address);
  const pkh = baseAddress?.payment_cred().to_keyhash()?.to_hex();

  console.log("Payment Key Hash (PKH):", pkh);
}

getPkh();