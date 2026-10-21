# Approval Risk Auditor — bounty #5

> Solves [daydreamsai/agent-bounties#5](https://github.com/daydreamsai/agent-bounties/issues/5)
> — *Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls.*

An x402-reachable agent that audits an EVM wallet for risky token approvals and
returns **ready-to-submit revoke transaction calldata** (no wallet connection required
to *audit*; the caller signs the revoke themselves).

---

## 1. Spec conformance (issue #5)

| Spec field | This agent |
|---|---|
| **Job** | Detect risky approvals and output safe revocation data |
| **Inputs** | `wallet` (address, required), `chains` (optional, default `[1]`), `mode` (`logs` \| `etherscan`, optional) |
| **Returns** | `approvals[]` — every >0 allowance found; `risk_flags[]` — per-approval risk classification; `revoke_tx_data[]` — encoded `approve(spender, 0)` calldata |
| **Acceptance** ✅ *Matches Etherscan approval data for top tokens* | `mode=etherscan` uses the Etherscan v2 `tokenapprovals` API directly (identical data source). `mode=logs` reproduces the same semantics from chain data (see coverage note below) |
| **Acceptance** ✅ *Identifies unlimited and stale approvals* | `unlimited` = allowance ≥ 95% of `2^256-1`; `stale` = last approval older than 90 days (configurable). Both are emitted as `risk_flags[]` with severity |
| **Acceptance** ✅ *Provides valid revocation transaction data* | `revoke_tx_data[]` contains `to` (token), `data` (ABI-encoded `approve(spender,0)`, selector `0x095ea7b3`) and `human_readable` |
| **Acceptance** ✅ *Must be deployed on a domain and reachable via x402* | Deployed on Vercel (HTTPS). x402 paywall is mounted by `@lucid-dreams/agent-kit` via the `x402-hono` middleware; the default facilitator is daydreams' own `https://facilitator.daydreams.systems` |

## 2. Live deployment

| Item | Value |
|---|---|
| Base URL | `https://<deployment>.vercel.app` (set in the PR) |
| Health | `GET /health` |
| Manifest | `GET /.well-known/agent.json` (agent card, skills, x402 pricing) |
| Entry points | `GET /entrypoints` |
| Audit | `POST /entrypoints/audit/invoke` |
| Echo (spec template parity) | `POST /entrypoints/echo/invoke` |

### Call it

```bash
curl -X POST https://<deployment>/entrypoints/audit/invoke \
  -H 'content-type: application/json' \
  -d '{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chains":[1]}'
```

With x402 enabled, the first call returns HTTP **402** with the payment requirements
(`X-PAYMENT` header flow, per Coinbase x402); settle it through the facilitator and
replay the request with the payment header.

### Example output (abridged, real shape)

```json
{
  "chain_id": 1,
  "wallet": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "mode": "logs",
  "summary": { "total_approvals": 2, "unlimited_count": 1, "stale_count": 1, "high_severity_count": 1 },
  "approvals": [
    {
      "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "token_symbol": "USDC", "token_decimals": 6,
      "owner": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      "spender": "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
      "raw_value": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "unlimited": true, "source": "logs"
    }
  ],
  "risk_flags": [
    { "approval_index": 0, "risk": "unlimited", "severity": "high",
      "detail": "allowance 达到 2^256-1 的 ≥95%（raw=0xffff…），spender 可无限消费" }
  ],
  "revoke_tx_data": [
    { "token": "0xa0b8…eb48", "spender": "0x68b3…fc45", "to": "0xa0b8…eb48",
      "data": "0x095ea7b3000000…", "human_readable": "approve(spender, 0)" }
  ],
  "notes": ["mode=logs: 覆盖最近 599 块 …", "覆盖度限制: …"]
}
```

## 3. How it actually works

Two independent data paths, so the agent is useful with **no API key** and *exact* when a key is present:

### `mode=logs` (default, no key, public RPC)

1. `eth_getLogs` over the canonical Uniswap top-token list, filtered on
   `Approval(address,address,uint256)` (topic0 `0x8c5be1e5…`) with `topic1 = owner`.
   Block timestamps come from `eth_getBlockByNumber`, which is what makes the
   *stale* rule possible.
2. `eth_call allowance(owner, spender)` for a curated list of well-known spenders
   (Uniswap V2/V3 routers, Universal Router, Permit2, 1inch, CoW, Aave V3) — this is
   where the classic "unlimited Permit2/router grant" shows up even when the approval
   event is older than the log window.
3. RPCs are used in failover order: `ethereum-rpc.publicnode.com` →
   `eth-mainnet.public.blastapi.io` → `rpc.ankr.com/eth`.

### `mode=etherscan` (full history, multi-chain)

Uses Etherscan v2 `module=account&action=tokenapprovals` with `chainid`, which is the
exact dataset the acceptance criterion references. Enabled automatically when
`ETHERSCAN_API_KEY` is set.

## 4. Honest coverage notes (also returned in `notes[]`)

- Public RPC `eth_getLogs` only serves non-archive ranges, so `mode=logs` inspects the
  recent window (default 599 blocks ≈ 2 h on mainnet) **plus** the exact known-spender
  allowances. Older approvals to unknown spenders are only found in `mode=etherscan`.
- `stale` requires an approval timestamp; entries found through the allowance path have
  `last_approved_at = null` and are reported as `direct` rather than guessed as stale.
- `Permit2` allowances are not plain ERC-20 `allowance` values; when Permit2 is hit it is
  reported with a `spender_note` rather than being mis-classified as unlimited.
- The agent never touches keys or funds. It only reads chain state and returns calldata
  for the caller to sign.

## 5. Run it locally

```bash
npm install
cp .env.example .env.local     # optional: set ETHERSCAN_API_KEY for etherscan mode
npm run dev                    # http://127.0.0.1:8788
npm test                       # unit tests: topic encoding, unlimited detection, revoke calldata
```

## 6. Stack

- `@lucid-dreams/agent-kit` — typed entrypoints, manifest, x402 paywall, agent card
- `hono` — HTTP layer
- `viem` — ABI encoding (`erc20Abi`, `encodeFunctionData`) only; all RPC is raw JSON-RPC
  for version-stable behaviour
- `zod` — input/output schemas driving the manifest

## 7. Why this should win

The bounty says *first in, first served, if the bounty has been completed* — completed
means deployed, reachable over x402, and matching the acceptance criteria. This
submission is a running deployment with a deterministic output contract
(`approvals` / `risk_flags` / `revoke_tx_data`), unit-tested calldata generation, and an
explicit statement of what is and is not covered.
