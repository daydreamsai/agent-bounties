# Token Holder Monitor

`token-holder-monitor` analyzes ERC20 holder concentration from live Transfer logs and current `balanceOf` checks. It identifies whale wallets, calculates centralization metrics, reports recent large transfers, and returns alerts for concentration and sampling limitations.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chain": "ethereum",
  "min_holders": 100,
  "lookback_blocks": 120000,
  "top_n": 25
}
```

Supported chains: `ethereum`, `polygon`, `arbitrum`, `optimism`, `base`.

## Output

```json
{
  "holder_count": 120,
  "holder_count_is_sampled": true,
  "whale_wallets": [],
  "concentration_metrics": {},
  "centralization_risk": "low",
  "alerts": [],
  "large_transfers": [],
  "token_info": {},
  "external_checks": [],
  "data_sources": [],
  "warnings": [],
  "calculation_evidence": {
    "case_count": 6,
    "pass_count": 6,
    "pass_rate_pct": 100
  }
}
```

## Data Sources

- RPC: ERC20 `Transfer` logs, `balanceOf`, `totalSupply`, `decimals`, `symbol`, and `name`.
- Etherscan v2 logs: used first when `ETHERSCAN_API_KEY` is configured.

The monitor never fabricates full holder counts. Without a privileged holder-index API, `holder_count` is the number of current non-zero holders observed from the scan window candidate set, and `holder_count_is_sampled` is `true`. Candidate holders are current-balance verified with `balanceOf` before being returned.

## Metrics

- Gini coefficient over current observed holder balances
- HHI index using total supply when available
- top 1 / top 5 / top 10 / top 100 holder share in basis points
- sample balance coverage in basis points when total supply is available
- centralization risk: `low`, `medium`, `high`, `critical`

`calculation_evidence` verifies deterministic concentration fixtures for Gini, HHI, top-holder share, sample coverage, critical concentration risk, and sampled-distribution alerts.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover input validation, concentration metrics, centralization alerts, sampled-distribution warnings, and calculation evidence.

Optional live scan:

```bash
MONITOR_CONTRACT_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
MONITOR_CHAIN=ethereum \
MONITOR_MIN_HOLDERS=10 \
MONITOR_LOOKBACK_BLOCKS=50 \
npm run monitor:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/token-holder-monitor`
- Health: `https://gpt55.558686.xyz/token-holder-monitor/health`
- Agent manifest: `https://gpt55.558686.xyz/token-holder-monitor/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/token-holder-monitor/entrypoints/monitor_token/invoke`

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/monitor_token/invoke`
- `POST /entrypoints/monitor-token/invoke`
- `POST /entrypoints/holders/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`.

Public x402 smoke validation on the deployed service confirmed that unpaid POST requests to all protected invoke paths return HTTP 402 with a `PAYMENT-REQUIRED` header:

- `/entrypoints/monitor_token/invoke`
- `/entrypoints/monitor-token/invoke`
- `/entrypoints/holders/invoke`
- `/invoke`

Local x402 smoke test:

```bash
PORT=8796 \
X402_PAY_TO=0x1f0130669ca6fd02e025a984cc038f139df19a2f \
X402_NETWORK=eip155:8453 \
X402_PRICE='$0.01' \
X402_FACILITATOR_URL=https://facilitator.openx402.ai \
PUBLIC_BASE_URL=http://127.0.0.1:8796 \
npm start
```

An unpaid protected POST should return HTTP 402 with a `PAYMENT-REQUIRED` header.
