# Lending Liquidation Sentinel

`lending-liquidation-sentinel` reads Aave V3 account health data directly from the Pool contract and emits early liquidation-risk alerts.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "wallet": "0x0000000000000000000000000000000000000001",
  "protocol_ids": ["aave-v3-base"],
  "positions": [],
  "alert_threshold": 1.2
}
```

Supported protocol IDs: `aave-v3-base`, `aave-v3-arbitrum`.

## Output

```json
{
  "positions": [],
  "warnings": [],
  "data_sources": [],
  "calculation_evidence": {
    "case_count": 5,
    "pass_count": 5,
    "pass_rate_pct": 100,
    "max_absolute_error_usd": 0,
    "pre_liquidation_alert_case_count": 2,
    "pre_liquidation_alert_pass_count": 2
  },
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

Each position includes `health_factor`, `buffer_percent`, `alert_threshold_hit`, total collateral/debt USD, available borrow USD, liquidation threshold bps, LTV bps, and source notes.

`liq_price` is returned only when the caller supplies single-position collateral/debt details. Aave's aggregate account health factor alone is not enough to produce a reliable single liquidation price for multi-asset positions, so the service does not fabricate one.

`calculation_evidence` is a deterministic fixture summary for the liquidation-price formula and early-alert behavior. It covers ETH, WBTC, and stable-collateral examples plus a missing-parameter case that must return `null`. It also simulates collateral price paths and verifies the first alert fires while `health_factor > 1.0` and before the collateral price reaches the liquidation price.

## Data Sources

- Aave V3 Pool `getUserAccountData(address)` via public EVM RPC.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover:

- Aave `getUserAccountData(address)` calldata encoding
- account data word decoding, health factor conversion, and buffer percentage
- liquidation price calculation for multiple supplied single-position fixtures
- price-path simulation proving alerts fire before health factor crosses 1.0
- null `liq_price` when a single-position liquidation threshold is missing
- `calculation_evidence` 100% pass rate and max absolute error at or below `$0.0001`

Optional live scan:

```bash
SENTINEL_WALLET=0x0000000000000000000000000000000000000001 \
SENTINEL_PROTOCOL_IDS=aave-v3-base \
npm run sentinel:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/lending-liquidation-sentinel`
- Health: `https://gpt55.558686.xyz/lending-liquidation-sentinel/health`
- Agent manifest: `https://gpt55.558686.xyz/lending-liquidation-sentinel/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/lending-liquidation-sentinel/entrypoints/monitor_liquidation/invoke`

Protected invoke aliases:

- `POST /entrypoints/monitor_liquidation/invoke`
- `POST /entrypoints/liquidation/invoke`
- `POST /entrypoints/monitor/invoke`
- `POST /invoke`
