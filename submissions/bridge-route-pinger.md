# Bridge Route Pinger

## Agent

Lists every bridge that can move a token from one chain to another right now, with the fee each one
charges, how long it takes, and what the caller must have ready before starting.

## Bounty

[daydreamsai/agent-bounties#10 — Bridge Route Pinger](https://github.com/daydreamsai/agent-bounties/issues/10)

## Live deployment

| | |
|---|---|
| Quote (paid, x402) | `POST https://elevation-talk-edt-village.trycloudflare.com/entrypoints/quote/invoke` |
| Chain list (free) | `POST https://elevation-talk-edt-village.trycloudflare.com/entrypoints/chains/invoke` |
| Health | `GET https://elevation-talk-edt-village.trycloudflare.com/health` |
| Agent card | `GET https://elevation-talk-edt-village.trycloudflare.com/.well-known/agent.json` |
| Backup host | `https://elevation-talk-edt-village.trycloudflare.com` (same paths) |

Price: **$0.002 USDC** per quote, `eip155:8453`, `exact` scheme, pay-to
`0x335AA55c12B260E604d93CB0B0895Bb13A4E93e3`.

## Solana wallet

`7mh9E7x9s1F8j95B97KqCoHES1wqHa8HEPPPYwnexuR2`

## Request and response

```json
{ "input": { "token": "USDC", "amount": "10", "from_chain": "base", "to_chain": "arbitrum" } }
```

```json
{
  "token": "USDC", "amount": "10", "from_chain": 8453, "to_chain": 42161,
  "routes": [
    { "bridge": "polymerStandard", "eta_minutes": 18, "fee_usd": 0.025,
      "to_amount": 9.975, "to_amount_usd": 9.9836, "gas_usd": 0.0051,
      "requirements": ["approve token at 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", "hold USDC for gas"],
      "steps": 1 }
  ],
  "best": "polymerStandard", "quoted_at": "2026-10-21T17:56:17.544Z"
}
```

Every field in `routes[]` is copied from a quote taken during that request: `eta_minutes` from
`step.estimate.executionDuration`, `fee_usd` summed over `step.estimate.feeCosts`, `gas_usd` from
`route.gasCostUSD`, `to_amount` from `route.toAmount` at the destination token's decimals, and
`requirements` from the approval address, the gas token and the chain-switch flag.

## Acceptance criteria

| Criterion | Where it is met |
|---|---|
| Returns `routes[]`, `eta_minutes`, `fee_usd`, `requirements` | `POST /entrypoints/quote/invoke`, schema in the agent card |
| Quotes align with official bridge endpoints | Every number comes from LI.FI `/v1/advanced/routes`, the aggregator the bridges themselves publish to; nothing is modelled or cached |
| Accurate fee and time estimates | Fee is the sum of all `feeCosts` LI.FI reports for the step, not just the headline integrator fee; ETA is LI.FI's own `executionDuration` |
| Deployed on a domain and reachable via x402 | Live on the two hosts above; a 402 is returned without payment, a 200 with routes after settlement |
| Built with `@lucid-dreams/agent-kit` | `createAgentApp` + `addEntrypoint`, `GET /.well-known/agent.json` serves the generated card |

## Verified with real payments

Four on-chain settlements were made against the deployed service, each followed by a 200 with live
routes:

| Host | Payer | Settlement tx |
|---|---|---|
| local | `0x042066eF…16EC5` | `0x0e849db5d5e71e8f65b5bb91e7aac8efd7f4183bbdf3992bc4b92b9d59c78e39` |
| cloudflared tunnel | `0x042066eF…16EC5` | `0xbc9099c8dfe6bb792f27e2d5e2e04a699c519f71dd9662ea0a20dd67221e3cca` |
| serveo tunnel | `0x1110179b…B0E91` | `0x9938db7ecfee5c0b4840f83946aee9a7c53a728d9ca4d0466e4aa79e8559b18a` |
| serveo tunnel | `0xC336bE2F…a94FC` | `0x9600394176fd8e6a40fdf73a3080daf18ded7fa62973a748e3f897c021d3b704` |

## Two design decisions worth flagging

**Routes are ranked by delivered amount, not headline fee.** Two bridges can both charge $0.025 and
still differ by 0.7% in what arrives. Sorting on fee alone puts the worse route first.

**An unreported ETA is `null`, not `0`.** LI.FI omits `executionDuration` on some routes; reporting
`0` would read as instant and lead a caller into a slow bridge. A reported time is floored at 1 minute for
the same reason.

## Payment safety

A request that cannot be served is rejected with 400 **before** the paywall, so a caller is never charged
for a call that would have failed: unknown chains, identical source and destination, a non-positive amount, or
a token symbol the destination chain does not list.

## x402 note

The paywall uses `@x402/hono` v2 directly. The v1 middleware bundled with agent-kit advertises
`network: "base"`, which the official v2 client refuses to sign (`Unsupported network format: base`), so a
buyer following the docs would get a 402 it can never pay. The v2 challenge advertises `eip155:8453` and
settles through `facilitator.payai.network`.

## Source

`src/agents/bridge-route-pinger/` in this workspace: `src/index.ts` (entrypoints), `src/paywall.ts`
(x402 v2), `src/preflight.ts` (reject-before-charge), `src/serve.ts` (node adapter), and 19 tests.

```bash
npm install --legacy-peer-deps
node --test --experimental-strip-types src/index.test.ts src/preflight.test.ts
```
