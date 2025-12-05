// api-server.js
// Twisted Soul factory API (devnet/mainnet via TSOUL_NETWORK env)

const fs = require("fs");
const express = require("express");
const cors = require("cors");
const web3 = require("@solana/web3.js");
const { Token, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

// NETWORK is chosen by env var, default devnet
const NETWORK = process.env.TSOUL_NETWORK || "devnet";
const PORT = process.env.PORT || 8080;

// ---------- helpers ----------

function loadWallet() {
  if (!fs.existsSync("wallet.json")) {
    throw new Error("wallet.json missing. Run `node generate-wallet.js` first.");
  }
  const raw = fs.readFileSync("wallet.json", "utf8");
  const arr = JSON.parse(raw);
  const bytes = Uint8Array.from(arr);
  return web3.Keypair.fromSecretKey(bytes);
}

function parseSupplyString(rawSupply) {
  if (!rawSupply || typeof rawSupply !== "string" || !/^\d+$/.test(rawSupply)) {
    throw new Error("supply must be a string of digits only, e.g. \"1000000000\".");
  }
  return rawSupply;
}

function toRawUnits(supplyStr, decimals) {
  const human = BigInt(supplyStr);
  const factor = BigInt(10) ** BigInt(decimals);
  return human * factor;
}

async function ensureAirdropIfDevnet(connection, wallet) {
  const balance = await connection.getBalance(wallet.publicKey);
  const oneSol = web3.LAMPORTS_PER_SOL;

  if (NETWORK !== "devnet") {
    console.log(
      `Network ${NETWORK}. No airdrops. Balance: ${(balance / oneSol).toFixed(4)} SOL`
    );
    return;
  }

  if (balance >= 0.5 * oneSol) {
    console.log(`Wallet balance OK: ${(balance / oneSol).toFixed(3)} SOL`);
    return;
  }

  console.log("Requesting devnet airdrop for factory wallet...");
  const sig = await connection.requestAirdrop(wallet.publicKey, oneSol);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Devnet airdrop complete:", sig);
}

// core mint function: uses manifest-style config
async function createSoulToken(config) {
  const rpcUrl =
    NETWORK === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : web3.clusterApiUrl(NETWORK);

  const connection = new web3.Connection(rpcUrl, "confirmed");
  const wallet = loadWallet();

  await ensureAirdropIfDevnet(connection, wallet);

  const name = (config.token && config.token.name) || "Unnamed Soul";
  const symbol = (config.token && config.token.symbol) || "SOUL";
  const supplyStr = parseSupplyString(config.token && config.token.supply);
  const bindings = config.bindings || {};

  const decimals = 9;
  const rawSupply = toRawUnits(supplyStr, decimals);

  console.log("\n[Factory] Creating token:");
  console.log("  Network:", NETWORK);
  console.log("  Name   :", name);
  console.log("  Symbol :", symbol);
  console.log("  Supply :", supplyStr);

  // 1. create mint
  const token = await Token.createMint(
    connection,
    wallet,
    wallet.publicKey, // mint authority (temporary)
    null, // freeze authority none
    decimals,
    TOKEN_PROGRAM_ID
  );

  // 2. ATA for factory wallet
  const ataInfo = await token.getOrCreateAssociatedAccountInfo(wallet.publicKey);

  // 3. mint full supply to factory wallet
  const mintTx = await token.mintTo(
    ataInfo.address,
    wallet.publicKey,
    [],
    rawSupply
  );

  console.log("[Factory] Mint TX:", mintTx);

  // 4. try renounce mint if requested
  if (bindings.renounceMint) {
    console.log("[Factory] RenounceMint: TRUE → attempt to remove mint authority...");
    try {
      const sig = await token.setAuthority(
        token.publicKey,
        wallet.publicKey,
        "MintTokens",
        null,
        []
      );
      console.log("[Factory] Mint authority renounced. Tx:", sig);
    } catch (err) {
      console.log(
        "[Factory] RenounceMint FAILED (lib limitation):",
        err.message || err
      );
    }
  } else {
    console.log("[Factory] RenounceMint: FALSE → mint authority kept.");
  }

  console.log("[Factory] Bindings:", bindings);

  return {
    network: NETWORK,
    name,
    symbol,
    supply: supplyStr,
    mint: token.publicKey.toBase58(),
    ata: ataInfo.address.toBase58(),
    mintTx,
  };
}

// ---------- Express app ----------

const app = express();
app.use(express.json());
app.use(cors()); // allow calls from your Vercel frontend

app.get("/", (_req, res) => {
  res.json({
    protocol: "Twisted Soul",
    network: NETWORK,
    status: "online",
    message: "Factory API ready. POST /api/mint to create a token.",
  });
});

app.post("/api/mint", async (req, res) => {
  try {
    const body = req.body;

    if (!body || !body.token || !body.token.name || !body.token.symbol || !body.token.supply) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: token.name, token.symbol, token.supply",
      });
    }

    const result = await createSoulToken(body);

    return res.status(200).json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("Error in /api/mint:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Twisted Soul factory API listening on port ${PORT}`);
  console.log(`Network: ${NETWORK}`);
});
