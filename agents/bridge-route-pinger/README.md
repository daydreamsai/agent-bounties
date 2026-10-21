# Bridge Route Pinger

Answers one question for an agent holding a token on one chain that needs it on another: which bridges
can move it right now, what each one costs, how long it takes, and what the caller must have ready.

Submission for [daydreamsai/agent-bounties#10](https://github.com/daydreamsai/agent-bounties/issues/10).

## Endpoints

| Route | Price | Purpose |
|---|---|---|
| `POST /entrypoints/quote/invoke` | $0.002 USDC (x402, Base) | Live routes for one transfer |
| `POST /entrypoints/chains/invoke` | free | Chain names the agent can resolve |
| `GET /health` | free | Liveness |
| `GET /entrypoints` | free | Entrypoint list |
| `GET /.well-known/agent.json` | free | Agent card with input/output schemas |

## Input

```json
{ "input": { "token": "USDC", "amount": "10", "from_chain": "base", "to_chain": "arbitrum" } }
```

`from_chain` and `to_chain` accept a name (`base`) or an EVM chain id (`8453`). `token` accepts a
symbol on the built-in table or any ERC-20 address. `from_address` is optional; when omitted a
placeholder is used, because a quote does not need a funded wallet. `limit` caps the route count (1-20,
default 5).

## Output

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

## Two decisions that matter

**Routes are ranked by what arrives, not by the headline fee.** Two bridges can both charge $0.025 and
still differ by 0.7% in delivered amount. Sorting on fee alone puts a worse route first, so the sort key
is `to_amount_usd`, with ETA as the tie-break.

**A missing ETA is `null`, not `0`.** LI.FI omits `executionDuration` for some routes. Reporting 0
would read as "instant" and lead a caller to pick a slow bridge, so an unreported time is null. A
reported time is floored at 1 minute for the same reason: `0` is not a duration.

## Why LI.FI

`/v1/advanced/routes` returns every bridge's quote for the same transfer rather than a single
pre-selected best path, which is exactly the shape this bounty asks for. Every number in a response is
copied from a quote taken during that request; re-running the same call gives the same shape with fresh
numbers. No key is required.

## Run

```bash
npm install --legacy-peer-deps
ADDRESS=0x335aa55c12b260e604d93cb0b0895bb13a4e93e3 \
  NETWORK=eip155:8453 \
  FACILITATOR_URL=https://facilitator.payai.network \
  PRICE_USD=0.002 \
  node --experimental-strip-types src/serve.ts
```

Without `ADDRESS` the agent serves free, which is useful for inspecting the response shape.

## x402 notes

The paywall is mounted from `src/paywall.ts` with `@x402/hono` v2 rather than through the v1
middleware that `@lucid-dreams/agent-kit` bundles. The bundled v1 middleware advertises
`network: "base"`, and the official v2 client refuses to sign anything that is not `eip155:<id>`, so a
buyer following the docs would receive a 402 it can never pay. The v2 challenge advertises
`eip155:8453`, which both the Python client and the TypeScript client can sign.

## Verification

Two real on-chain settlements were made against the deployed instance, each returning a 200 with live
routes after payment:

| Where | Payer | Settlement tx |
|---|---|---|
| local `:8145` | `0x042066eF…16EC5` | `0x0e849db5d5e71e8f65b5bb91e7aac8efd7f4183bbdf3992bc4b92b9d59c78e39` |
| public tunnel | `0x042066eF…16EC5` | `0xbc9099c8dfe6bb792f27e2d5e2e04a699c519f71dd9662ea0a20dd67221e3cca` |

## Tests

`src/index.test.ts` covers chain/token resolution, atomic conversion, ranking, the null-ETA rule, and
the LI.FI response mapping with a recorded payload.
