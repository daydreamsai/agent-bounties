# Fresh Markets Watch

Closes #1

## Live Deployment
https://fresh-markets-watch.netlify.app

## Agent Description
Scans AMM factory contracts for newly created pairs/pools within a given time window.
Uses `viem` + free public RPCs (no API keys) to query `PairCreated` (Uniswap V2) and
`PoolCreated` (Uniswap V3) events from on-chain logs. Also fetches initial liquidity
from `Sync`/`Mint` events and top holders from LP Transfer mint events.

## How It Works
1. Calculates block range from `window_minutes` using per-chain block time estimates
2. Calls `getLogs` on each factory contract for V2 `PairCreated` and V3 `PoolCreated`
3. For each pair: fetches first `Sync` event (V2) or `Mint` event (V3) for `init_liquidity`
4. Gets `top_holders` from LP Transfer-from-zero-address events (initial LP providers)
5. Returns all pairs sorted newest first

## Entrypoint
**Key:** `watch`

**Input:**
```json
{
  "chain": "base",
  "factories": [],
  "window_minutes": 30
}
```

**Output:**
```json
{
  "chain": "base",
  "window_minutes": 30,
  "factories_scanned": ["0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
  "new_pairs_found": 3,
  "pairs": [
    {
      "pair_address": "0x...",
      "tokens": ["0x...", "0x..."],
      "init_liquidity": "1000000000/500000000000000000000",
      "top_holders": ["0x..."],
      "created_at": "2026-07-01T15:00:00.000Z",
      "factory": "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
      "type": "v3",
      "fee_bps": 30
    }
  ]
}
```

## APIs Used
- **Public RPCs** (free, no key): eth.llamarpc.com, polygon-rpc.com, arb1.arbitrum.io/rpc, mainnet.base.org, mainnet.optimism.io, bsc-dataseed1.binance.org
- **viem** — `getLogs` for `PairCreated`, `PoolCreated`, `Sync`, `Mint`, `Transfer` events

## Supported Chains
ethereum, polygon, arbitrum, base, optimism, bsc

## Default Factories (if empty input)
- Ethereum: Uniswap V2 + V3
- Polygon: QuickSwap + Uniswap V3
- Arbitrum: Uniswap V2/V3
- Base: Uniswap V2/V3
- Optimism: Uniswap V2/V3
- BSC: PancakeSwap V2/V3

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef
