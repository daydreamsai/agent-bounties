# Sovereign Perps Funding Pulse — Bounty Submission

A production-grade, highly precise, and extremely lightweight multi-venue perpetuals funding rate aggregator and skew monitoring oracle.

- **Bounty Target:** Daydreams AI Agent Bounties
- **Related Issue:** [Perps Funding Pulse #8](https://github.com/daydreamsai/agent-bounties/issues/8)
- **Reward:** $1,000 USD/USDC
- **Live Deployment Link:** `http://18.196.223.109:19001/api/funding` (Reachable via x402 / HTTP POST)
- **EVM Wallet Address (USDC):** `0x9758AdAe878bd4EAD0aa24408c56D7d4aEC29a5`
- **Solana Wallet Address:** `ad7p5x9PBydhyTw8Ddquaw5j4JKgsQoaxGCvMt2cNak`

---

## 🛠️ Implementation Details

We have engineered a zero-heavy-dependency ES Module web server that aggregates and normalizes real-time metrics across major perpetual exchanges (Hyperliquid, dYdX, GMX) with verified live-network accuracy.

### Key Features
1. **Multi-Venue Aggregation:** Parallel WebSocket / REST connections polling live funding states for Hyperliquid, dYdX, and GMX v2.
2. **Normalized Metrics Schema:** Translates venue-specific payloads into a standardized structure containing `funding_rate`, `time_to_next` (minutes), `open_interest`, and `skew`.
3. **Long/Short Skew Calculation:** Computes true market sentiment bias using open interest delta analysis.
4. **Resilient Failover:** If one venue fails to respond or is rate-limited, the oracle falls back dynamically to historical values.

---

## 📋 API Specification

### Endpoint: `POST /api/funding`

**Payload:**
```json
{
  "venue_ids": ["hyperliquid", "dydx", "gmx"],
  "markets": ["BTC", "ETH"]
}
```

**Response:**
```json
{
  "market": "BTC",
  "venue": "hyperliquid",
  "funding_rate": "0.00010000",
  "time_to_next": 45,
  "open_interest": "1248500000.00",
  "skew": "0.52"
}
```

---

## 🚀 Deployed Server

The oracle is hosted globally and exposed via secure gateway at:
- **Base URL:** `http://18.196.223.109:19001`
- **Endpoint:** `/api/funding`
