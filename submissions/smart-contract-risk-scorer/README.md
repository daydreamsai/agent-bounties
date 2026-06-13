# Smart Contract Risk Scorer

`smart-contract-risk-scorer` analyzes EVM contracts for scam, rug-pull, ownership, proxy, source-code, bytecode, and third-party security signals. It returns a normalized 0-100 risk score, findings with evidence, external check status, and actionable recommendations.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "contract_address": "0x0000000000000000000000000000000000000001",
  "chain": "base",
  "scan_depth": "quick"
}
```

Supported chains: `ethereum`, `polygon`, `arbitrum`, `optimism`, `base`.

`scan_depth` can be:

- `quick`: RPC, GoPlus, Etherscan source, optional Token Sniffer
- `deep`: quick checks plus Etherscan contract creation metadata when `ETHERSCAN_API_KEY` is configured

## Output

```json
{
  "risk_score": 42,
  "risk_level": "medium",
  "vulnerabilities": [],
  "security_checks": {},
  "external_checks": [],
  "contract_info": {},
  "recommendations": [],
  "confidence": 0.72
}
```

## Data Sources

- RPC: `eth_getCode`, EIP-1967 implementation slot, ERC20 `name`, `symbol`, `owner`, and `getOwner` reads.
- GoPlus: `GET /api/v1/token_security/{chain_id}` for honeypot, taxes, blacklist, hidden owner, mint, proxy, pause, and related token security flags.
- Etherscan v2: `getsourcecode` for verified source and compiler metadata; `getcontractcreation` in deep scans for creator metadata.
- Token Sniffer: optional paid API. If `TOKEN_SNIFFER_API_KEY` is not set, the response marks Token Sniffer as `unavailable`; it never fabricates Token Sniffer results.

## Risk Rules

The scorer combines third-party flags, RPC observations, bytecode checks, and more than 50 source-code patterns. Examples:

- honeypot or sell restrictions
- hidden ownership
- active owner privileges
- blacklist / whitelist transfer gates
- high or mutable buy/sell taxes
- mint controls
- proxy or upgradeability
- selfdestruct / delegatecall / tx.origin
- pausable transfers, anti-bot, cooldown, max-wallet, max-tx
- owner withdrawal, rescue-token, mutable router/pair/oracle controls

Findings are weighted by severity and converted to:

- `low`: 0-24
- `medium`: 25-54
- `high`: 55-79
- `critical`: 80-100

Confidence increases when live RPC, verified source, GoPlus, Token Sniffer, and deep metadata are available. Missing paid or unavailable data sources lower confidence instead of being treated as clean.

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
cp .env.example .env
SCORE_CONTRACT_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 SCORE_CHAIN=ethereum npm run score:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/smart-contract-risk-scorer`
- Health: `https://gpt55.558686.xyz/smart-contract-risk-scorer/health`
- Agent manifest: `https://gpt55.558686.xyz/smart-contract-risk-scorer/.well-known/agent.json`
- x402 invoke: `POST https://gpt55.558686.xyz/smart-contract-risk-scorer/entrypoints/score_contract/invoke`

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/score_contract/invoke`
- `POST /entrypoints/score-contract/invoke`
- `POST /entrypoints/score/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`.

Local x402 smoke test:

```bash
PORT=8795 \
X402_PAY_TO=0x1f0130669ca6fd02e025a984cc038f139df19a2f \
X402_NETWORK=eip155:8453 \
X402_PRICE='$0.01' \
X402_FACILITATOR_URL=https://facilitator.openx402.ai \
PUBLIC_BASE_URL=http://127.0.0.1:8795 \
npm start
```

An unpaid protected POST should return HTTP 402 with a `PAYMENT-REQUIRED` header.
