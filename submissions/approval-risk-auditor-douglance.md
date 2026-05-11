# Approval Risk Auditor

Related issue: https://github.com/daydreamsai/agent-bounties/issues/5

## Agent

Approval Risk Auditor scans EVM wallets for ERC-20 and NFT/operator approvals,
flags risky approvals, and returns unsigned revocation transaction data.

Live deployment:
https://approval-risk-auditor.doug-lance.workers.dev

Agent manifest:
https://approval-risk-auditor.doug-lance.workers.dev/.well-known/agent.json

Source:
https://github.com/douglance/approval-risk-auditor

Entrypoint:

```text
POST /entrypoints/audit-approvals/invoke
```

## Inputs

```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chains": ["ethereum", "base"],
  "token_addresses": [],
  "nft_addresses": [],
  "stale_days": 180
}
```

## Outputs

The agent returns:

- `approvals[]`
- `risk_flags[]`
- `revoke_tx_data[]`
- `summary`

Revocation data is unsigned transaction calldata:

- ERC-20: `approve(spender, 0)`
- ERC-721 single-token approvals: `approve(address(0), tokenId)`
- ERC-721/ERC-1155 operator approvals: `setApprovalForAll(operator, false)`

## x402 Reachability

Unauthenticated invocation returns the expected x402 payment challenge:

```bash
curl -i -X POST \
  https://approval-risk-auditor.doug-lance.workers.dev/entrypoints/audit-approvals/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chains":["ethereum"],"token_addresses":[],"nft_addresses":[],"stale_days":180}}'
```

Expected response: HTTP `402` with `X-PAYMENT header is required` and an
`accepts[]` payment requirement for `base-sepolia`.

## Acceptance Criteria

- [x] Matches Etherscan-style approval log data for configured top tokens.
- [x] Identifies unlimited ERC-20 approvals.
- [x] Identifies stale approvals using `stale_days`.
- [x] Identifies ERC-721 single-token and NFT/operator approvals.
- [x] Provides valid unsigned revocation transaction data.
- [x] Deployed on a public HTTPS domain.
- [x] Reachable via x402.

## Validation

Local implementation checks:

```bash
npm run build
npm test
npm audit --audit-level=moderate
wrangler deploy --dry-run
```

Public endpoint checks:

```bash
curl -fsS https://approval-risk-auditor.doug-lance.workers.dev/health
curl -fsS https://approval-risk-auditor.doug-lance.workers.dev/.well-known/agent.json
curl -fsS https://approval-risk-auditor.doug-lance.workers.dev/entrypoints
```

## Payment Wallet

Solana wallet:

```text
EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX
```
