# Approval Risk Auditor

Bounty [#5 — Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5):
flag unlimited or stale ERC-20 / NFT approvals and build revoke calls.

## Run

```sh
cd approval-risk-auditor
npm test          # offline unit tests
PORT=3000 npm start
```

## API

`POST /audit` with:

```json
{
  "wallet": "0x...",
  "chains": ["ethereum"],
  "approvals": [
    {
      "chain": "ethereum",
      "token": "0x...",
      "tokenType": "ERC20",
      "spender": "0x...",
      "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "lastActivityAt": "2025-06-01T00:00:00.000Z"
    }
  ]
}
```

Returns `{ wallet, chains, approvals, risk_flags, revoke_tx_data }`.

## Risk flags

- `UNLIMITED` — ERC-20 allowance equals `2^256 - 1`
- `STALE` — no activity for more than 180 days (configurable via `staleAfterDays`)
- `ALREADY_REVOKED` — zero allowance (no revoke tx emitted)
- `NFT_OPERATOR_GRANT` — active ERC-721/ERC-1155 operator approval
- `UNKNOWN_AGE` — no usable `lastActivityAt` timestamp

## Revocation data

- ERC-20: `approve(spender, 0)` (`0x095ea7b3…`) sent to the token contract
- ERC-721/1155: `setApprovalForAll(operator, false)` (`0xa22cb465…`) sent to the token contract

Approval/token lists are supplied by the caller (e.g. Etherscan token-approval
endpoints); this package performs the risk analysis and builds revocation
calldata offline.
