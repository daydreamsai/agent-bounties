# Approval Risk Auditor

## Related Bounty

Issue: #5 - Approval Risk Auditor

## Agent

Implementation path: `submissions/approval-risk-auditor`

The agent audits EVM wallet approvals across Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, Gnosis, and Fantom. It indexes Approval and ApprovalForAll logs, validates current on-chain state with `allowance`, `getApproved`, and `isApprovedForAll`, then returns active approvals with risk flags and unsigned revoke transaction calldata.

Data collection uses Etherscan v2 logs when `ETHERSCAN_API_KEY` is available. Without an explorer key, the fallback public RPC path limits default historical scanning to the latest 750,000 blocks to avoid unreliable broad `eth_getLogs` calls; callers can still pass explicit `from_block` values.

## Inputs

- `wallet`: EVM wallet address
- `chains`: supported chain names, for example `["ethereum", "base", "polygon", "arbitrum", "bsc"]`
- optional `stale_days`
- optional `token_addresses` filter

## Outputs

- `approvals[]`
- `risk_flags`
- `revoke_tx_data[]`
- `warnings`
- `data_sources`

## Revoke Calldata

- ERC20 unlimited or finite allowance: `approve(spender, 0)`
- ERC721 token approval: `approve(address(0), tokenId)`
- ERC721/ERC1155 operator approval: `setApprovalForAll(operator, false)`

## Risk Rules

- unlimited / max uint allowance
- stale approval at 90 and 180 day thresholds
- unknown spender
- non-verified spender when explorer verification is available
- EOA spender
- high-value token approval
- operator approval

## Validation

```bash
cd submissions/approval-risk-auditor
npm install
npm run build
npm test
npm run lint
```

Tests cover:

- ERC20 unlimited allowance revoke calldata
- ERC20 finite allowance revoke calldata
- ERC721 token approval revoke calldata
- ERC721/ERC1155 operator approval revoke calldata
- ERC721 token `Approval(owner, approved, tokenId)` event decoding
- Etherscan log topic array normalization
- stale approval risk flags
- invalid wallet and unsupported chain rejection
- manifest x402 metadata
- entrypoint alias publication

Current local validation:

- `npm run build` passes
- `npm test` passes 12 tests
- `npm run lint` passes
- local unpaid x402 invoke returns HTTP 402 with a decodable `PAYMENT-REQUIRED` header for Base USDC, amount `10000` atomic units, and payout wallet `0x1f0130669ca6fd02e025a984cc038f139df19a2f`
- public unpaid x402 invoke against the deployment URL returns HTTP 402 with a decodable `PAYMENT-REQUIRED` header whose resource URL is `https://gpt55.558686.xyz/approval-risk-auditor/entrypoints/audit_approvals/invoke`

## Deployment / x402

Live deployment:

- Base URL: `https://gpt55.558686.xyz/approval-risk-auditor`
- Health: `https://gpt55.558686.xyz/approval-risk-auditor/health`
- Manifest: `https://gpt55.558686.xyz/approval-risk-auditor/.well-known/agent.json`
- Invoke: `POST https://gpt55.558686.xyz/approval-risk-auditor/entrypoints/audit_approvals/invoke`

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/audit_approvals/invoke`
- `POST /entrypoints/audit-approvals/invoke`
- `POST /entrypoints/audit/invoke`
- `POST /invoke`

The current deployment uses a Cloudflare Tunnel hostname and has been verified reachable via HTTPS and x402. A stable custom hostname can point at the same server by setting `PUBLIC_BASE_URL` and restarting the service.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
