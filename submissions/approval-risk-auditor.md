# Approval Risk Auditor

**Related Issue:** #5

---

## Submission File

**File Path:** `submissions/approval-risk-auditor.md`

Agent source code is included in this PR at `submissions/approval-risk-auditor/`
(TypeScript, `@lucid-dreams/agent-kit` based, with unit tests and the verification scripts
used to validate every spender address on-chain).

---

## Agent Description

`approval-risk-auditor` audits an EVM wallet for **risky token approvals** and returns
**ready-to-submit revoke transaction calldata**.

**Job:** Detect risky approvals and output safe revocation data.

**Inputs**

| Field | Type | Notes |
|-------|------|-------|
| `wallet` | string (required) | Owner wallet to audit |
| `chains` | number[] (optional) | Default `[1]` (Ethereum mainnet) |
| `mode` | `"logs" \| "etherscan"` (optional) | `logs` = no API key needed; `etherscan` = full history (needs `ETHERSCAN_API_KEY`) |

**Returns** (exactly the fields the issue asks for)

- `approvals[]` — every approval with `token`, `token_symbol`, `token_decimals`, `owner`,
  `spender`, `raw_value`, `value`, `unlimited`, `last_approved_at`, `last_approved_block`, `source`
- `risk_flags[]` — per-approval classification: `unlimited` (severity high) / `stale` (medium) / `direct` (info)
- `revoke_tx_data[]` — for each approval, `{ token, spender, to, data, human_readable }` where `data`
  is the ABI-encoded `approve(spender, 0)` calldata (selector `0x095ea7b3`) ready to be signed and sent

**How the data is produced (two independent paths)**

1. `mode=logs` (default, **no API key required**)
   - `eth_getLogs` on the canonical Uniswap top-token list, filtered by
     `Approval(address,address,uint256)` (topic0 `0x8c5be1e5…`, topic1 = owner).
     Block timestamps come from `eth_getBlockByNumber` — this is what makes the *stale* rule possible.
   - `allowance(owner, spender)` for a curated list of well-known spenders
     (Uniswap V2/V3 routers, Universal Router v1.02/v2, Permit2, 1inch V6, 0x, ParaSwap,
     CoW GPv2 Settlement, Aave V3 Pool, Balancer Vault, Lido stETH, Across SpokePool).
     This is where the classic "unlimited Permit2 / router grant" surfaces even when the
     original approval event is older than the log window.
   - All allowance lookups are batched through **Multicall3** (`0xcA11bde0…`), which takes a
     full audit from ~24s to ~2s.
2. `mode=etherscan` — Etherscan v2 `module=account&action=tokenapprovals` with `chainid`.
   This is the exact dataset the acceptance criterion refers to, and it is selected
   automatically when `ETHERSCAN_API_KEY` is present.

**Safety properties**

- The agent never touches keys, never signs, never moves funds. It only reads chain state and
  returns calldata for the caller to sign.
- The spender list is not hand-written: every address is verified on-chain with `eth_getCode`
  (`scripts/verify_spenders.ts`) and checksums are computed with `viem.getAddress`
  (`scripts/gen_known_spenders.ts`), so no dead or mis-cased contract can be shipped.
- Every coverage limitation is returned to the caller in `notes[]` — nothing is silently guessed.

---

## Live Link

**Deployment URL:** `https://agentauditor-solmount.vercel.app`

> **Deployment:** first-party Vercel production deployment (project `solmount/agent_auditor`),
> built from this PR's source, with `ADDRESS` / `NETWORK` / `DEFAULT_PRICE` / `FACILITATOR_URL`
> configured in the Vercel production environment. Deployment Protection is **disabled**
> (`ssoProtection: null`) so the endpoint is publicly reachable by any reviewer.
>
> A secondary mirror is served from the author's machine over an encrypted public tunnel
> (`https://cf3337636f0572.lhr.life`) — it was used to verify the x402 handshake from an external network
> while the Vercel free-tier daily deployment cap was exhausted.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | liveness |
| `GET /entrypoints` | registered entrypoints (`audit`, `echo`) |
| `GET /.well-known/agent.json` | agent card — includes the `payments[]` (x402) block |
| `POST /entrypoints/audit/invoke` | the audit itself (x402-protected) |
| `POST /entrypoints/echo/invoke` | spec-template parity echo (x402-protected) |

**x402 is live, not simulated.** The agent card advertises:

```json
"payments": [{
  "method": "x402",
  "payee": "0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB",
  "network": "base-sepolia",
  "endpoint": "https://facilitator.daydreams.systems",
  "priceModel": { "default": "0.0025" }
}]
```

An unauthenticated call returns HTTP **402** with the standard x402 `accepts` block
(`scheme: exact`, `network: base-sepolia`, `maxAmountRequired: 2500` = $0.0025 in USDC
base units), so the endpoint is verifiable as x402-reachable by anyone.

```bash
curl -i -X POST https://agentauditor-solmount.vercel.app/entrypoints/audit/invoke \
  -H 'content-type: application/json' \
  -d '{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chains":[1]}'
# → HTTP 402 + {"error":"X-PAYMENT header is required","accepts":[{...}]}
```

---

## Acceptance Criteria

- [x] Meets all technical specifications — `wallet` / `chains` inputs, `approvals[]` / `risk_flags[]` / `revoke_tx_data[]` outputs
- [x] Deployed on a domain — `https://agentauditor-solmount.vercel.app` (HTTPS, Vercel production deployment)
- [x] Reachable via x402 — `x402-hono` middleware via `@lucid-dreams/agent-kit`; 402 + payment requirements verified live; payment settles through daydreams' facilitator
- [x] All acceptance criteria from the issue are met
      - *Matches Etherscan approval data for top tokens* → `mode=etherscan` uses the Etherscan v2 `tokenapprovals` API directly; `mode=logs` reproduces the same semantics from chain data
      - *Identifies unlimited and stale approvals* → `unlimited` = allowance ≥ 95% of `2^256-1`; `stale` = last approval older than 90 days (configurable)
      - *Provides valid revocation transaction data* → `revoke_tx_data[].data` = ABI-encoded `approve(spender, 0)`, unit-tested against `viem` encoding
- [x] Submission file added to `submissions/` directory

---

## Other Resources

- **Repository:** `https://github.com/breezesamuel/agent-bounties` (this PR) — full source under `submissions/approval-risk-auditor/`
- **Documentation:** `submissions/approval-risk-auditor/README.md`
- **Demo (no key needed):** `npx tsx scripts/smoke.ts` — audits a real wallet against mainnet public RPC and prints the approvals, risk flags and revoke calldata
- **Tests:** `npx tsx --test tests/*.test.ts` — 9/9 passing (topic encoding, unlimited detection, stale classification, revoke calldata, x402 price-unit guard)
- **Other:** verified on-chain address set — `scripts/verify_spenders.ts` (eth_getCode) and `scripts/gen_known_spenders.ts` (EIP-55 checksums)

---

## Wallet

**Payment address (EVM / USDC, base-sepolia):** `0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB`

This is the `payee` advertised in the agent card, so x402 payments settle here.
