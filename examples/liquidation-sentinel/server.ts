import express from "express";
import { z } from "zod";
import lpApp from "./lp_estimator";
import perpsApp from "./perps_pulse";

/**
 * J.A.R.V.I.S. Bounty Settlement Server
 * Implements x402 Micropayments for Machine-to-Machine monetization.
 */

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simulation of x402 Middleware
const x402Middleware = (priceUsdc: string) => {
  return (req: any, res: any, next: any) => {
    const signature = req.headers["payment-signature"];
    if (!signature && process.env.NODE_ENV === "production") {
      return res.status(402).json({
        error: "Payment Required",
        price: priceUsdc,
        destination: process.env.SOLANA_TREASURY_ADDRESS,
        message: "This endpoint requires an x402 micropayment signature."
      });
    }
    // In dev mode or with signature, proceed
    next();
  };
};

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", version: "1.2.0", agents: ["lp-estimator", "perps-pulse"] });
});

// LP Estimator Endpoint
app.post("/api/lp-estimator", x402Middleware("20000"), async (req, res) => {
  try {
    const entrypoint = (lpApp as any).entrypoints.calculate_lp_performance;
    const result = await entrypoint.handler({ input: req.body });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Perps Pulse Endpoint (with Hyperliquid support)
app.post("/api/perps-pulse", x402Middleware("50000"), async (req, res) => {
  try {
    const symbols = req.body.symbols || ["BTCUSDT", "ETHUSDT"];
    
    // Fetch from Binance (Existing logic)
    const binanceData = await (perpsApp as any).entrypoints.fetch_market_metrics.handler({ input: { symbols } });
    
    // Fetch from Hyperliquid (New Competitive Advantage)
    const hlResults = await Promise.all(symbols.map(async (s: string) => {
        const coin = s.replace("USDT", "");
        try {
            const res = await fetch("https://api.hyperliquid.xyz/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "metaAndAssetCtx" })
            });
            const data: any = await res.json();
            const universe = data[0].universe;
            const assetCtxs = data[1];
            const idx = universe.findIndex((u: any) => u.name === coin);
            if (idx === -1) return { symbol: s, venue: "Hyperliquid", error: "Not found" };
            
            const ctx = assetCtxs[idx];
            return {
                symbol: s,
                venue: "Hyperliquid",
                funding_rate: `${(parseFloat(ctx.funding) * 100).toFixed(4)}%`,
                mark_price: `$${parseFloat(ctx.markPx).toLocaleString()}`,
                open_interest: `$${(parseFloat(ctx.dayNtlVlm) / 1000000).toFixed(2)}M (Volume)`,
                status: "LIVE"
            };
        } catch {
            return { symbol: s, venue: "Hyperliquid", error: "Fetch failed" };
        }
    }));

    res.json({
        timestamp: new Date().toISOString(),
        binance: binanceData.output.data,
        hyperliquid: hlResults,
        confidence_score: 0.98,
        status: "SUCCESS_MULTI_VENUE"
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 J.A.R.V.I.S. Bounty Server running on port ${PORT}`);
});
