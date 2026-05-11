# Smart Contract Risk Scorer

Related bounty: #61

## Agent

Smart Contract Risk Scorer analyzes EVM contracts for security and rug-pull
indicators, then returns a risk score, severity-ranked findings, security check
results, external API evidence, contract metadata, recommendations, and an
analysis confidence value.

## Live Deployment

- Agent URL: https://smart-contract-risk-scorer.doug-lance.workers.dev
- Manifest: https://smart-contract-risk-scorer.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `score-contract`
- Invoke path: `POST /entrypoints/score-contract/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/smart-contract-risk-scorer

## Supported Inputs

```json
{
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chain": "ethereum",
  "scan_depth": "quick"
}
```

Supported chains:

- `ethereum`
- `polygon`
- `arbitrum`
- `optimism`
- `base`

## Output Summary

The agent returns:

- `risk_score`
- `risk_level`
- `vulnerabilities[]`
- `security_checks`
- `external_checks`
- `contract_info`
- `recommendations[]`
- `confidence`

## Acceptance Criteria Coverage

- Analyzes smart contracts for security risks and rug-pull indicators.
- Uses live RPC bytecode checks on all supported chains.
- Uses Etherscan-compatible source verification when explorer API keys are configured.
- Uses GoPlus token-security checks for honeypot, ownership, mint, pause, blacklist, and sellability indicators.
- Supports optional Token Sniffer verification when `TOKEN_SNIFFER_API_KEY` is configured.
- Detects honeypot, hidden ownership, malicious code patterns, proxy/delegatecall, selfdestruct, mint, blacklist, tax/fee, max-sell, max-wallet, cooldown, anti-bot, owner-withdraw, and related risk indicators.
- Runs 50+ verified-source pattern checks and bytecode fallback checks for unverified contracts.
- Returns weighted 0-100 risk score, risk level, confidence, detailed findings, and actionable recommendations.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Live validation:

```text
curl -fsS https://smart-contract-risk-scorer.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://smart-contract-risk-scorer.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes score-contract and x402 payments metadata

curl -fsS https://smart-contract-risk-scorer.doug-lance.workers.dev/entrypoints
-> exposes score-contract

curl -i -X POST https://smart-contract-risk-scorer.doug-lance.workers.dev/entrypoints/score-contract/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","scan_depth":"quick"}}'
-> HTTP 402 with x402 payment requirements
```

Direct local scorer smoke against USDC:

```json
{
  "risk_score": 24,
  "risk_level": "low",
  "vuln_count": 2,
  "bytecode": true,
  "goplus": "ok",
  "elapsed_ms": 1099,
  "confidence": 0.61
}
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
