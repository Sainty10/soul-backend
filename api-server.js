// api-server.js
// Twisted Soul backend – stubbed mint API returning clean JSON

const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get("/", (req, res) => {
  res.send("Twisted Soul backend is alive.");
});

// POST /api/mint – stub implementation
app.post("/api/mint", async (req, res) => {
  try {
    console.log("Mint request body:", req.body);

    // You can inspect req.body.token / req.body.bindings here if needed
    // For now, we just return a fake but well-formed response

    const fakeMint = "DEMO_MINT_ADDRESS_TWISTED_SOUL";
    const fakeSig = "DEMO_TRANSACTION_SIGNATURE_TWISTED_SOUL";

    return res.json({
      ok: true,
      mintAddress: fakeMint,
      signature: fakeSig,
    });
  } catch (err) {
    console.error("Mint error:", err);
    return res.status(500).json({
      ok: false,
      error:
        err instanceof Error ? err.message : "Unknown server error in backend.",
    });
  }
});

// Port binding (Render uses process.env.PORT)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Twisted Soul backend listening on port ${PORT}`);
});
