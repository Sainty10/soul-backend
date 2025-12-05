const fs = require("fs");
const web3 = require("@solana/web3.js");

function main() {
  const keypair = web3.Keypair.generate();
  const secret = Array.from(keypair.secretKey);

  fs.writeFileSync("wallet.json", JSON.stringify(secret));
  console.log("New devnet wallet created.");
  console.log("Public key:", keypair.publicKey.toBase58());
  console.log("Secret key saved to wallet.json");
}

main();
