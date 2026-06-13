# Bridge Route Pinger

## Related Bounty

Issue: #10 - Bridge Route Pinger

## Agent

Implementation path: `submissions/bridge-route-pinger`

The agent returns live bridge route quotes from LI.FI's official `/v1/quote` API. It maps LI.FI estimate data into the bounty output shape: `routes[]`, per-route `eta_minutes`, `fee_usd`, and execution `requirements`.

## Inputs

- `token`: token symbol such as `ETH`, `USDC`, or `USDT`, or a token address
- `amount`: decimal amount, such as `0.001` or `10`
- `from_chain`: source chain name or chain ID
- `to_chain`: destination chain name or chain ID
- optional `from_address`
- optional `slippage`

## Outputs

- `routes[]`: normalized LI.FI quote route data
- `best_route`: current best route returned by LI.FI
- `warnings[]`
- `data_sources[]`
- `fetched_at`

## Accuracy Notes

This implementation does not fabricate route data. It returns LI.FI's current official bridge quote, including `feeCosts`, `gasCosts`, and `executionDuration`, normalized into USD fee and ETA fields.

## Validation

```bash
cd submissions/bridge-route-pinger
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live quote:

```bash
BRIDGE_TOKEN=ETH \
BRIDGE_AMOUNT=0.001 \
BRIDGE_FROM_CHAIN=base \
BRIDGE_TO_CHAIN=optimism \
npm run bridge:sample
```

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/ping_bridge_routes/invoke`
- `POST /entrypoints/bridge-routes/invoke`
- `POST /entrypoints/bridge/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/bridge-route-pinger`
- Health: `https://gpt55.558686.xyz/bridge-route-pinger/health`
- Manifest: `https://gpt55.558686.xyz/bridge-route-pinger/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/bridge-route-pinger/entrypoints/ping_bridge_routes/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/bridge-route-pinger/entrypoints/bridge-routes/invoke`
- Short alias: `POST https://gpt55.558686.xyz/bridge-route-pinger/entrypoints/bridge/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/bridge-route-pinger/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
