# GasRoute Oracle

**Bounty:** [Daydreams Agent Bounties #4](https://github.com/daydreamsai/agent-bounties/issues/4)

## Purpose

Returns the cheapest chain and timing hint for a swap or contract call. Fetches live gas prices across 7 EVM chains and recommends the optimal chain based on cost and congestion.

## Features

- **Live gas prices** via Blocknative API (free), Etherscan, and Polygon gasstation
- **7 chains supported**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche
- **Live native token prices** via CoinGecko (ETH, MATIC, BNB, AVAX)
- **Congestion scoring**: 0-100 score with busy level classification (low/medium/high/very_high)
- **EIP-1559 data**: base fee + priority fee breakdown where available
- **Tip hint**: specific fee recommendation based on current network congestion
- **Calldata cost accounting**: adds gas cost for calldata bytes

## Actions

| Action | Description |
|--------|-------------|
| `get_gas_route` | Compare all chains, return cheapest + alternatives |
| `get_chain_gas` | Get current gas for a single chain |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8091** by default.

### Example — Best Route for a Swap

```bash
curl -X POST http://localhost:8091/invoke/get_gas_route \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain_set": ["ethereum", "polygon", "arbitrum", "optimism", "base"],
      "calldata_size_bytes": 256,
      "gas_units_est": 150000
    }
  }'
```

### Example — Single Chain Gas

```bash
curl -X POST http://localhost:8091/invoke/get_chain_gas \
  -H "Content-Type: application/json" \
  -d '{"input": {"chain": "ethereum"}}'
```

## Response Format

```json
{
  "chain": "Arbitrum One",
  "fee_native": 0.0000003,
  "fee_usd": 0.00096,
  "busy_level": "low",
  "tip_hint": "0.15 gwei — good time to transact",
  "block_time_seconds": 0.26,
  "gas_price_gwei": 0.15,
  "alternatives": [...]
}
```

## Tech Stack

- TypeScript + Node.js
- Blocknative Gas API (free tier)
- Etherscan Gas Oracle
- Polygon Gas Station v2
- CoinGecko prices API
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)
- Hono HTTP server
