# Slippage Sentinel

**Bounty:** [#3 — Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3)  
**Amount:** $1,000  
**Submitted by:** xuhongchen521-debug  
**Framework:** `@lucid-dreams/agent-kit`

---

## Description

Slippage Sentinel is an autonomous agent that estimates safe slippage parameters for any token swap route on Ethereum. It queries on-chain Uniswap V2 pool reserves via `viem`, computes pool depth in USD terms, estimates volatility from reserve imbalance, and returns a recommended slippage tolerance in basis points (bps).

The agent is designed to **prevent transaction reversion for ~95% of test swaps** by accounting for:

- **Pool depth** — deep pools (high liquidity) require lower slippage; shallow pools need higher tolerance
- **Reserve imbalance** — imbalanced reserves signal recent price movement and higher volatility
- **Conservative caps** — max recommended slippage is 50 bps (0.5%), with a 1 bps floor

## Entrypoint

| Field       | Value              |
|-------------|--------------------|
| Name        | `estimate-slippage` |
| Description | Estimate safe slippage for a given swap route |

### Input Schema

```typescript
{
  token_in: string;    // 0x-prefixed ERC-20 address (the token being sold)
  token_out: string;   // 0x-prefixed ERC-20 address (the token being bought)
  amount_in: string;   // Decimal string representing the input amount (e.g. "1000.5")
  route_hint?: string; // Optional: hint for which DEX to query (e.g. "UniswapV2")
}
```

### Output Schema

```typescript
{
  min_safe_slip_bps: number;      // Minimum safe slippage in basis points
  pool_depths: Array<{             // Array of pools analyzed
    dex: string;                    //   DEX name
    token_pair: string;            //   Shortened token pair identifier
    reserve_usd: number;           //   Total reserve value in USD
    depth_score: number;           //   Depth score (0 = shallow, 1 = deep)
  }>;
  recent_trade_size_p95: number;  // Estimated 95th percentile trade size in USD
  volatility_factor: number;       // Volatility multiplier (1.0 = low, 4.0 = high)
  recommended_slip_bps: number;   // Recommended slippage in basis points
}
```

## Implementation

### Architecture

```
User Request (estimate-slippage)
        │
        ▼
  ┌─────────────────┐
  │  createAgentApp  │  ← @lucid-dreams/agent-kit
  │  (entrypoint)    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Zod validation  │  ← input schema enforcement
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────┐
  │  estimateSlippage()                 │
  │  • Connect to RPC (viem)            │
  │  • Derive pair address (CREATE2)    │
  │  • Call getReserves() on pair       │
  │  • Map reserves to tokens           │
  │  • Compute USD depth                │
  │  • Calculate volatility factor      │
  │  • Derive recommended slippage bps  │
  └─────────────────────────────────────┘
```

### Key Calculations

**Depth Score:** `log10(reserve_usd / 1000 + 1) / 3`, clamped to [0, 1]  
- $10K → ~0.09, $100K → ~0.50, $1M → ~0.91, $5M+ → ~0.99

**Volatility Factor:** `1.0 + (max_ratio - 0.5) × 6.0`  
- Balanced (50/50) → 1.0 (low volatility)  
- Imbalanced (90/10) → 3.4 (high volatility)

**Recommended Slippage:** `(1 - depthScore) × 50bps × (volFactor / 2.0)`, clamped to [1, 50]  
- Shallow/volatile pools → up to 50 bps  
- Deep/stable pools → as low as 1 bps

### Error Handling

- Failed RPC calls or missing pairs return conservative defaults (50 bps slippage)
- Each DEX attempt is independently try/caught so one failure doesn't block results from other DEXes
- Empty pool arrays still return a valid estimate with safe defaults

## Files

```
submissions/slippage-sentinel/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
submissions/slippage-sentinel.md
```

## Deployment

The agent is designed to be deployed as a serverless function or container with a single environment variable:

| Variable  | Default                                   | Description          |
|-----------|-------------------------------------------|----------------------|
| `RPC_URL` | `https://eth-mainnet.g.alchemy.com/v2/demo` | Ethereum RPC endpoint |

Once deployed, it is reachable via **x402** at the entrypoint endpoint.

## Wallet

`0x...` (Solana wallet address — TBD on submission)

---

*Built with ❤️ for daydreamsai agent bounties*
