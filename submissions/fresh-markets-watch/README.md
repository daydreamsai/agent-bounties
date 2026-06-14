# Fresh Markets Watch

`fresh-markets-watch` scans AMM factory logs for new V2 pairs and V3 pools in a recent block window. It uses public RPC `eth_getLogs` and decodes factory events directly instead of relying on mock data.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "chain": "base",
  "factories": [],
  "window_minutes": 10,
  "to_block": "latest"
}
```

Supported default chains: `base`, `arbitrum`.

If `factories` is empty, the service scans configured V2/V3 factories for the chain. If `factories` is supplied, it scans matching configured factory addresses.

## Output

```json
{
  "markets": [],
  "warnings": [],
  "scanned": {},
  "scan_evidence": {
    "requested_window_minutes": 10,
    "requested_blocks": 300,
    "scanned_blocks": 301,
    "raw_log_count": 0,
    "decoded_market_count": 0,
    "decode_failure_count": 0,
    "observed_false_positive_rate_pct": 0
  },
  "data_sources": [],
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

Each market includes `pair_address`, `tokens`, `factory`, `protocol`, `event_type`, `fee`, `created_at`, `block_number`, `transaction_hash`, and `log_index`.

`scan_evidence` records the exact block span, configured factories, event topics, raw log count, decoded market count, decode failures, and observed false-positive rate for the current invocation. The scanner requests logs only from configured factory addresses and exact `PairCreated` / `PoolCreated` topics, then counts malformed decodes as failures instead of silently accepting them.

`init_liquidity` is enriched with read-only on-chain evidence when possible:

- V2 pairs: `eth_call getReserves()` at the creation block.
- V3 pools: `eth_call slot0()` and `liquidity()` at the creation block.

`top_holders` is populated for V2 pairs from LP token `Transfer` mint logs in the creation transaction receipt. V3 pools do not issue ERC20 LP tokens from the pool contract, so the response includes `top_holders_unavailable_reason` instead of fabricating holders.

## Data Sources

- EVM RPC `eth_blockNumber`
- EVM RPC `eth_getLogs`
- EVM RPC `eth_getBlockByNumber`
- EVM RPC `eth_call`
- EVM RPC `eth_getTransactionReceipt`

Decoded events:

- V2 `PairCreated(address indexed token0,address indexed token1,address pair,uint256)`
- V3 `PoolCreated(address indexed token0,address indexed token1,uint24 fee,int24 tickSpacing,address pool)`

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live scan:

```bash
FRESH_CHAIN=base \
FRESH_WINDOW_MINUTES=10 \
npm run fresh:sample
```

Historical Base validation sample:

```bash
FRESH_CHAIN=base \
FRESH_FROM_BLOCK=47264078 \
FRESH_TO_BLOCK=47264078 \
npm run fresh:sample
```

The sample decodes a real SushiSwap V2 `PairCreated` event and returns non-null `init_liquidity` from `getReserves()` plus an LP mint holder from the creation transaction receipt.

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/fresh-markets-watch`
- Health: `https://gpt55.558686.xyz/fresh-markets-watch/health`
- Agent manifest: `https://gpt55.558686.xyz/fresh-markets-watch/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/fresh-markets-watch/entrypoints/watch_fresh_markets/invoke`

Protected invoke aliases:

- `POST /entrypoints/watch_fresh_markets/invoke`
- `POST /entrypoints/fresh-markets/invoke`
- `POST /entrypoints/markets/invoke`
- `POST /invoke`
