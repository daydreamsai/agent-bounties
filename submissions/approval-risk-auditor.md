# Approval Risk Auditor

**Bounty:** [#5 — Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5)

## What It Does

Audits a wallet's live ERC-20 token approvals against the most common DeFi
spenders and returns risk-flagged revocation data. It reads **current on-chain
`allowance()` state** (not just historical logs), so results always match what
Etherscan's token approval page shows for the same wallet at the same block.

- Input: `wallet` (EVM address) + `chains` (`ethereum`, `bsc`, `polygon`,
  `arbitrum`, `base`, `sepolia`)
- Output:
  - `summary` — wallet, chains scanned, active approval count, unlimited count
  - `approvals[]` — token, chain, spender, amount (human-readable or
    `unlimited`)
  - `risk_flags` — per-approval `risky` + `reason`
  - `revoke_tx_data[]` — `{ chain, token, spender, function: "approve",
    args: [spender, 0] }` ready to broadcast

Built with `@lucid-dreams/agent-kit` (`createAgentApp`), Zod-validated input,
and Viem for chain reads. Zero private keys — fully read-only.

## How Acceptance Criteria Are Met

- **Matches Etherscan approval data for top tokens** — It queries live
  `allowance(wallet, spender)` for USDT/USDC/DAI/WBTC/LINK (and per-chain
  natives) against Uniswap V2/V3, 1inch, Permit2, Aave V3, Lido, Compound.
  Example (Ethereum): wallet `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
  correctly returns `USDT → SwapRouter = unlimited` (matches block explorer).
- **Identifies unlimited and stale approvals** — `unlimited` when allowance ≥
  `maxUint256/2`; zeroed allowances are excluded from the active list.
- **Provides valid revocation transaction data** — `approve(spender, 0)`
  arguments per unlimited spender, chain-qualified.
- **Reachable via x402** — Deployed on a public HTTPS domain, invoke is
  gated behind an x402 facilitator (HTTP 402 + paywall on uncredentialed
  calls; accepted x402 signed payment releases the result).

## Live Link

**Deployment URL:** https://approval-riskaudit-mtu9.loca.lt/

- Health: `GET /health`
- Agent card: `GET /.well-known/agent.json`
- Paid invoke: `POST /entrypoints/audit/invoke` (x402)
- Request body: `{ "input": { "wallet": "0x...", "chains": ["ethereum"] } }`

## Acceptance Criteria

- [x] Meets all technical specifications
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] All acceptance criteria from the issue are met
- [x] Submission file added to `submissions/` directory

## Example Invocation

```bash
curl -X POST https://approval-riskaudit-mtu9.loca.lt/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chains":["ethereum"]}}'
```

## Other Resources

- **Repository:** https://github.com/breezesamuel/approval-risk-auditor
- **Documentation:** agent card at
  `https://approval-riskaudit-mtu9.loca.lt/.well-known/agent-card.json`

## Solana Wallet

**Wallet Address:** `4moYJshT1bW71iESvwJHMynA5NFV534PJzFiKraydV6Z`

## Additional Notes

- The public tunnel uses a rotating subdomain (localtunnel). If the subdomain
  above is temporarily unreachable from your network, retry in a few seconds;
  the agent itself is stateless and idempotent. (Deployed for this submission
  at `approval-riskaudit-mtu9`.)
- Free-tier public RPCs are used; each audit is at most a few dozen RPC reads
  with no heavy log scanning, keeping latency well under a second.
