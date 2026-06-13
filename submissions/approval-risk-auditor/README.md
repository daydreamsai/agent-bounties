# Approval Risk Auditor

`approval-risk-auditor` scans EVM wallets for ERC20, ERC721, and ERC1155 approvals, validates that each approval is still active, assigns risk flags, and returns unsigned revoke transaction calldata.

It does not request private keys, does not sign transactions, and does not broadcast revokes.

## Input

```json
{
  "wallet": "0x0000000000000000000000000000000000000001",
  "chains": ["ethereum", "base", "polygon", "arbitrum"],
  "stale_days": 90,
  "token_addresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
}
```

Supported chains: `ethereum`, `base`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`, `gnosis`, `fantom`.

## Output

```json
{
  "approvals": [],
  "risk_flags": {},
  "revoke_tx_data": [],
  "warnings": [],
  "data_sources": []
}
```

Each approval includes the token, spender/operator, standard, current allowance or token id where applicable, last observed approval block/time, risk flags, risk score, and one revoke transaction object.

## Revoke Calldata

- ERC20 allowance: `approve(spender, 0)`
- ERC721 token approval: `approve(address(0), tokenId)`
- ERC721/ERC1155 operator approval: `setApprovalForAll(operator, false)`

All revoke entries are unsigned transaction data with `to`, `data`, `value`, `chain`, and a human-readable description.

## Data Sources

The scanner uses Etherscan v2 logs when `ETHERSCAN_API_KEY` is set. Without that key it falls back to public RPC `eth_getLogs` over the latest 750,000 blocks by default. Public RPC providers can be rate limited, so production deployments should provide `ETHERSCAN_API_KEY` and dedicated RPC URLs via `.env`.

Historical events are not trusted by themselves. The scanner validates the current state before returning an approval:

- ERC20: `allowance(owner, spender) > 0`
- ERC721 token approval: `getApproved(tokenId) == spender`
- ERC721/ERC1155 operator approval: `isApprovedForAll(owner, operator) == true`

## Risk Flags

- `unlimited_allowance` / `max_uint_allowance`
- `stale_90d`
- `stale_180d`
- `unknown_spender`
- `non_verified_spender`
- `spender_is_eoa`
- `high_value_token_approval`
- `operator_approval`
- `current_approval_confirmed`

High-value token detection uses a conservative allowlist for common blue-chip/stable tokens such as USDC, USDT, DAI, WETH, WBTC, LINK, UNI, AAVE, MKR, COMP, CRV, and LDO.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
```

Optional live scan:

```bash
cp .env.example .env
# set AUDIT_WALLET, optional ETHERSCAN_API_KEY and RPC URLs
AUDIT_WALLET=0x0000000000000000000000000000000000000001 AUDIT_CHAINS=base npm run audit:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/approval-risk-auditor`
- Health: `https://gpt55.558686.xyz/approval-risk-auditor/health`
- Agent manifest: `https://gpt55.558686.xyz/approval-risk-auditor/.well-known/agent.json`
- x402 invoke: `POST https://gpt55.558686.xyz/approval-risk-auditor/entrypoints/audit_approvals/invoke`

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/audit_approvals/invoke`
- `POST /entrypoints/audit-approvals/invoke`
- `POST /entrypoints/audit/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, invoke routes are protected by `@x402/express`. Set `X402_FACILITATOR_URL` to the facilitator used by the deployment, for example `https://facilitator.openx402.ai`.

Local x402 smoke test:

```bash
PORT=8792 \
X402_PAY_TO=0x1f0130669ca6fd02e025a984cc038f139df19a2f \
X402_NETWORK=eip155:8453 \
X402_PRICE='$0.01' \
X402_FACILITATOR_URL=https://facilitator.openx402.ai \
PUBLIC_BASE_URL=http://127.0.0.1:8792 \
npm start
```

An unpaid protected POST should return HTTP 402 with a `PAYMENT-REQUIRED` header. Public validation against the deployment URL returned Base USDC, amount `10000` atomic units (`$0.01`), and payout wallet `0x1f0130669ca6fd02e025a984cc038f139df19a2f`.

The current public deployment uses a Cloudflare Tunnel URL. A stable custom hostname can be pointed at the same service without code changes by setting `PUBLIC_BASE_URL` and restarting the server.
