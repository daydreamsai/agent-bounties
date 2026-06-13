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
  "data_sources": [],
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

Each market includes `pair_address`, `tokens`, `factory`, `protocol`, `event_type`, `fee`, `created_at`, `block_number`, `transaction_hash`, and `log_index`.

`init_liquidity` and `top_holders` are returned as `null` and `[]` unless a reliable token-specific enrichment source is added. The service does not fabricate liquidity or holder data from creation events alone.

## Data Sources

- EVM RPC `eth_blockNumber`
- EVM RPC `eth_getLogs`
- EVM RPC `eth_getBlockByNumber`

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
