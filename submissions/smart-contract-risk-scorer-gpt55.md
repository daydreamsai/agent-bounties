# Smart Contract Risk Scorer

## Related Bounty

Issue: #61 - Smart Contract Risk Scorer

## Agent

Implementation path: `submissions/smart-contract-risk-scorer`

The agent scores EVM smart contracts across Ethereum, Polygon, Arbitrum, Optimism, and Base. It combines live RPC checks, GoPlus token security data, Etherscan v2 source metadata, optional Token Sniffer results, bytecode checks, and 50+ source-code risk patterns.

The implementation does not mock third-party results. Missing optional keys are reported in `external_checks` as `unavailable` and reduce confidence instead of being treated as clean.

## Inputs

- `contract_address`: EVM contract address
- `chain`: one of `ethereum`, `polygon`, `arbitrum`, `optimism`, `base`
- optional `scan_depth`: `quick` or `deep`

## Outputs

- `risk_score`
- `risk_level`
- `vulnerabilities[]`
- `security_checks`
- `external_checks`
- `contract_info`
- `recommendations[]`
- `confidence`
- `data_sources`

## Data Sources

- RPC: bytecode, EIP-1967 proxy slot, ERC20 metadata, owner/getOwner
- GoPlus: honeypot, hidden owner, blacklist, whitelist, mint, proxy, tax, pause, anti-whale, sell restriction flags
- Etherscan v2: verified source, compiler metadata, contract creator in deep scans
- Token Sniffer: optional paid API when `TOKEN_SNIFFER_API_KEY` is set

## Risk Rules

- honeypot / cannot sell
- hidden owner / active owner privileges
- blacklist / whitelist gates
- high or mutable tax/fee logic
- mint risk
- proxy and upgradeability
- verified source unavailable
- selfdestruct, delegatecall, tx.origin, assembly
- pausable transfer, anti-bot, cooldown, max-wallet, max-tx
- owner withdrawal/rescue-token/mutable router-pair-oracle controls

The source analyzer includes more than 50 risk patterns and returns evidence per finding.

## Validation

```bash
cd submissions/smart-contract-risk-scorer
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover:

- bytecode opcode parsing without PUSH-data false positives
- real SELFDESTRUCT and DELEGATECALL opcode detection
- 50+ source pattern coverage
- source pattern detection for blacklist/trading toggle/fee/mint controls
- critical scoring from critical/high/medium findings
- recommendations for honeypot and fee findings
- valid input/default quick scan
- invalid wallet and unsupported chain rejection

Current local validation:

- `npm run build` passes
- `npm test` passes 8 tests
- `npm run lint` passes
- `npm audit --audit-level=moderate` reports 0 vulnerabilities
- live sample scan against Ethereum USDC returns real RPC code size/name/symbol/owner and GoPlus evidence; Etherscan and Token Sniffer are explicitly marked unavailable when keys are not configured

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/score_contract/invoke`
- `POST /entrypoints/score-contract/invoke`
- `POST /entrypoints/score/invoke`
- `POST /invoke`

Live deployment:

- Base URL: `https://gpt55.558686.xyz/smart-contract-risk-scorer`
- Health: `https://gpt55.558686.xyz/smart-contract-risk-scorer/health`
- Manifest: `https://gpt55.558686.xyz/smart-contract-risk-scorer/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/smart-contract-risk-scorer/entrypoints/score_contract/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/smart-contract-risk-scorer/entrypoints/score-contract/invoke`
- Short alias: `POST https://gpt55.558686.xyz/smart-contract-risk-scorer/entrypoints/score/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/smart-contract-risk-scorer/invoke`

Public x402 smoke validation passed: health returns HTTP 200, manifest exposes 5 chains and 4 entrypoints, and all four unpaid invoke paths return HTTP 402 with `PAYMENT-REQUIRED` for Base USDC.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
