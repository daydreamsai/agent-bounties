# Bridge Route Pinger

**Bounty:** [Daydreams Agent Bounties #10](https://github.com/daydreamsai/agent-bounties/issues/10)

## Purpose

Queries Li.Fi, Socket (Bungee), and Rango APIs for live bridge routes. Returns sorted routes with fees, ETAs, and requirements for any supported chain pair.

## Features

- **Li.Fi:** Full route aggregator — 30+ bridges and DEXs, multi-step routes with per-step fee breakdown
- **Socket (Bungee):** Bridge aggregator — output-sorted routes, gas fees, service time
- **Rango:** Cross-chain + cross-ecosystem (supports Solana via SOL chain)
- **Multi-source:** Queries all 3 in parallel, deduplicates, sorts by fee/eta/output
- **Fee comparison:** Compare cost efficiency across multiple amounts for a route
- **20+ chains:** ETH, ARB, OP, BASE, SOL, BSC, POLYGON, AVAX, ZKSYNC, LINEA, SCROLL, and more

## Actions

| Action | Description |
|--------|-------------|
| `find_routes` | Fetch bridge routes from Li.Fi, Socket, Rango |
| `compare_fees` | Compare fee % across amounts for a route |
| `get_supported_chains` | List all supported chain IDs |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8096** by default.

### Example — Find Best Route

```bash
curl -X POST http://localhost:8096/invoke/find_routes \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "token": "USDC",
      "amount": 1000,
      "from_chain": "ETH",
      "to_chain": "ARB",
      "sources": ["lifi", "socket", "rango"],
      "sort_by": "output"
    }
  }'
```

### Example — Compare Fee Efficiency

```bash
curl -X POST http://localhost:8096/invoke/compare_fees \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "token": "USDC",
      "amounts": [100, 500, 1000, 5000],
      "from_chain": "ETH",
      "to_chain": "BASE",
      "sources": ["lifi"]
    }
  }'
```

## Response Format (find_routes)

```json
{
  "from_chain": "ETH",
  "to_chain": "ARB",
  "token": "USDC",
  "amount": 1000,
  "routes": [
    {
      "source": "lifi",
      "bridge_name": "across",
      "amount_in": 1000,
      "amount_out": 999.42,
      "fee_usd": 0.58,
      "gas_cost_usd": 1.20,
      "total_cost_usd": 1.78,
      "eta_minutes": 3,
      "eta_label": "~3 min",
      "steps": 1,
      "requirements": ["recommended"],
      "approval_required": true
    }
  ],
  "best_route": {
    "source": "lifi",
    "bridge": "across",
    "amount_out": 999.42,
    "fee_usd": 1.78,
    "eta": "~3 min",
    "requirements": ["recommended"]
  },
  "total_routes": 8
}
```

## Supported Chains

| Chain | ID | Rango |
|-------|----|-------|
| ETH / Ethereum | 1 | ETH |
| ARB / Arbitrum | 42161 | ARBITRUM |
| OP / Optimism | 10 | OPTIMISM |
| BASE | 8453 | BASE |
| BSC / BNB | 56 | BSC |
| POLYGON | 137 | POLYGON |
| AVAX / Avalanche | 43114 | AVAX_CCHAIN |
| SOL / Solana | — | SOLANA (Rango only) |
| ZKSYNC | 324 | — |
| LINEA | 59144 | — |
| SCROLL | 534352 | — |

## Data Sources

| Source | API | Key Required |
|--------|-----|-------------|
| Li.Fi | `https://li.quest/v1/routes` | No (higher limits with key) |
| Socket | `https://api.socket.tech/v2/quote` | Demo key included |
| Rango | `https://api.rango.exchange/routing/best` | Demo key included |

## Tech Stack

- TypeScript + Node.js
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)

## Solana Wallet

`HtCYXQBT2EVMqVrkz3a7M9EFQqg6tKnqe9bDJgQ7sXdZ`
