const fs = require("fs");
const web3 = require("@solana/web3.js");
const { Token, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

// Network: devnet by default. Set TSOUL_NETWORK=mainnet-beta for mainnet later.
const NETWORK = process.env.TSOUL_NETWORK || "devnet";

function requireFile(path, msg) {
  if (!fs.existsSync(path)) {
    console.error(msg);
    process.exit(1);
  }
}

function loadWallet() {
  requireFile("wallet.json", "wallet.json missing.");
  const raw = fs.readFileSync("wallet.json", "utf8");
  const arr = JSON.parse(raw);
  const bytes = Uint8Array.from(arr);
  return web3.Keypair.fromSecretKey(bytes);
}

function loadManifest() {
  requireFile("manifest.json", "manifest.json missing.");
  const raw = fs.readFileSync("manifest.json", "utf8");
  return JSON.parse(raw);
}

function parseSupply(manifest, decimals) {
  const raw = manifest && manifest.token && manifest.token.supply;
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("token.supply must be digits only.");
  }
  const human = BigInt(raw);
  const factor = BigInt(10) ** BigInt(decimals);
  return human * factor;
}

async function ensureAirdrop(conn, wallet) {
  const balance = await conn.getBalance(wallet.publicKey);
  const oneSol = web3.LAMPORTS_PER_SOL;

  if (NETWORK !== "devnet") {
    console.log(
      `Network ${NETWORK}. No airdrop. Balance: ${(balance / oneSol).toFixed(4)} SOL`
    );
    return;
  }

  if (balance >= 0.5 * oneSol) {
    console.log(`Wallet balance OK: ${(balance / oneSol).toFixed(3)} SOL`);
    return;
  }

  console.log("Requesting devnet airdrop...");
  const sig = await conn.requestAirdrop(wallet.publicKey, oneSol);
  await conn.confirmTransaction(sig, "confirmed");
  console.log("Devnet airdrop complete.");
}

async function main() {
  const conn = new web3.Connection(web3.clusterApiUrl(NETWORK), "confirmed");
  console.log(`Connected to ${NETWORK}`);

  const wallet = loadWallet();
  console.log("Wallet:", wallet.publicKey.toBase58());

  await ensureAirdrop(conn, wallet);

  const manifest = loadManifest();
  const name = manifest.token && manifest.token.name ? manifest.token.name : "";
  const symbol = manifest.token && manifest.token.symbol ? manifest.token.symbol : "";
  const supplyHuman =
    manifest.token && typeof manifest.token.supply === "string"
      ? manifest.token.supply
      : "";
  const bindings = manifest.bindings || {};
  const decimals = 9;

  console.log("\n=== Twisted Soul Manifest ===");
  console.log("Token:", `${name} (${symbol})`);
  console.log("Supply:", supplyHuman);
  console.log("Bindings:", bindings);

  const supply = parseSupply(manifest, decimals);
  console.log(`Converted supply (raw units): ${supply.toString()}`);

  console.log("\nCreating SPL mint...");
  const token = await Token.createMint(
    conn,
    wallet,
    wallet.publicKey,
    null,
    decimals,
    TOKEN_PROGRAM_ID
  );
  console.log("Mint Address:", token.publicKey.toBase58());

  console.log("Creating associated token account...");
  const ataInfo = await token.getOrCreateAssociatedAccountInfo(wallet.publicKey);
  console.log("Token Account:", ataInfo.address.toBase58());

  console.log(`Minting ${supplyHuman} tokens to wallet...`);
  const mintTx = await token.mintTo(
    ataInfo.address,
    wallet.publicKey,
    [],
    supply
  );
  console.log("Minted. TX:", mintTx);

  if (bindings.renounceMint) {
    console.log("RenounceMint: TRUE ? attempt to remove mint authority...");
    try {
      const sig = await token.setAuthority(
        token.publicKey,
        wallet.publicKey,
        "MintTokens",
        null,
        []
      );
      console.log("Mint authority renounced. Tx:", sig);
    } catch (err) {
      console.log(
        "RenounceMint: FAILED to renounce authority (old spl-token lib):",
        err.message || err
      );
    }
  } else {
    console.log("RenounceMint: FALSE ? mint authority NOT removed.");
  }

  if (bindings.lockLiquidity) {
    console.log("LockLiquidity: TRUE (LP lock to be enforced in DEX layer).");
  } else {
    console.log("LockLiquidity: FALSE (LP can be pulled).");
  }

  if (bindings.noGodWallet) {
    console.log("NoGodWallet: TRUE (future logic avoids god wallets).");
  } else {
    console.log("NoGodWallet: FALSE (admin wallet allowed).");
  }

  if (bindings.openSource) {
    console.log("OpenSource: TRUE (code transparency expected).");
  } else {
    console.log("OpenSource: FALSE (closed-source, trust hit).");
  }

  console.log("\n=== Twisted Soul CP2 Complete ===");
  console.log("Network:", NETWORK);
  console.log("Mint:", token.publicKey.toBase58());
  console.log("ATA :", ataInfo.address.toBase58());
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
