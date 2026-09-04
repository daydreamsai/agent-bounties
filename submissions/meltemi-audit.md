# Approval Risk Auditor

**Agent name:** meltemi-audit
**Related issue:** #5 — Approval Risk Auditor
**Live deployment:** https://meltemi-audit.herdr-telegram-bridge.workers.dev

## What it does

Audits any EVM wallet's ERC-20 and NFT approvals across chains and returns
risk-flagged results plus ready-to-broadcast revocation transactions.

- **Chains:** ethereum, base, arbitrum, optimism, polygon (Etherscan V2 multichain, one key)
- **Events parsed:** `Approval` (ERC-20) and `ApprovalForAll` (ERC-721/1155), via topic0+topic1 filtered log queries
- **Risk classification:**
  - `high` — unlimited approval (amount >= 2^255) or active NFT operator
  - `medium` — stale (untouched > 365 days)
  - `low` — revoked (amount = 0) or ordinary bounded approvals
- **Revoke calldata:** canonical `approve(spender, 0)` (selector `0x095ea7b3`) for ERC-20, `setApprovalForAll(operator, false)` (selector `0xa22cb465`) for NFT operator approvals
- **Dedupe:** latest-event-wins per (chain, token, spender, kind) — superseded max-approvals don't count as live risk
- **Honesty flag:** `meta.truncatedChains[]` lists any chain where the Etherscan 1000x10 pagination cap was hit, instead of silently missing data

## API

```
POST /audit
Content-Type: application/json

{ "wallet": "0x…", "chains": ["ethereum", "base"] }   // chains optional, defaults to ["ethereum"]
```

Response shape (per the bounty spec):

```json
{
  "meta": { "truncatedChains": [] },
  "wallet": "0x…",
  "approvals": [
    { "kind": "erc20", "chain": "ethereum", "token": "0x…", "owner": "0x…",
      "spender": "0x…", "amount": "…", "blockNumber": 22896575,
      "blockTime": 1752244631, "txHash": "0x…",
      "risk": "high", "flags": ["unlimited"] }
  ],
  "riskFlags": { … },
  "revokeTxData": [
    { "chain": "ethereum", "to": "0x…", "data": "0x095ea7b3…000…0" }
  ],
  "summary": { "total": 892, "high": 887, "medium": 4, "low": 1 }
}
```

`GET /health` → `{ "ok": true }`

## Verified against Etherscan

Live check (2026-09-04): wallet `0x5eb4dd17f59bcbc86f98cd459b01b8fe650b321b`
on ethereum returns 892 approvals (887 high-risk), and the returned
`revokeTxData` decodes to valid `approve(spender, 0)` calls matching the
Etherscan approval records for that wallet. The endpoint is deployed on a
workers.dev domain and responds in <5s for full-history wallets.

## x402 payment

The endpoint implements the x402 V1 HTTP transport:

- unpaid request → `402` with JSON body `{ x402Version: 1, error, accepts: [ { scheme: "exact", network: "base", asset: USDC-on-Base, payTo, maxAmountRequired, … } ] }`
- client retries with base64(JSON `PaymentPayload`) in the `X-PAYMENT` header
- server verifies via the CDP facilitator (`https://facilitator.x402.org/verify`) and serves the audit on valid payment

The payment gate is enabled by setting the recipient address as a Worker
secret (`PAY_TO_ADDRESS`); it is currently deployed open so reviewers can
verify the acceptance criteria without paying.

## Tech

- Cloudflare Workers (TypeScript, strict), zero external runtime deps
- Etherscan V2 API for log reads (free tier, 5 req/s)
- Core logic TDD'd: 45 vitest tests (parse → classify → revoke-calldata → handler → payment gate)
- Reference implementation (Python) mirrors the TS core 1:1

## Notes for reviewers

- `chains` accepts any of: ethereum, base, arbitrum, optimism, polygon
- Amounts are returned as decimal strings (uint256 exceeds JS number range)
- The endpoint is stateless; no wallet keys are ever held by the agent
