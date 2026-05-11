# Bridge Route Pinger

## Related Bounty

Issue: https://github.com/daydreamsai/agent-bounties/issues/10

## Description

Bridge Route Pinger lists viable bridge routes and live fee/time quotes for
token transfers. It queries LI.FI's official advanced route endpoint, normalizes
the returned route tools, ETA, gas fees, included bridge fees, and approval/gas
token requirements, then returns the best route plus alternatives.

The agent uses `@lucid-dreams/agent-kit` with x402 payments.

## Live Deployment

- Agent: https://bridge-route-pinger.doug-lance.workers.dev
- Manifest: https://bridge-route-pinger.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `POST /entrypoints/ping-bridge-routes/invoke`

## Source

- Repository: https://github.com/douglance/bridge-route-pinger
- Specification: https://github.com/douglance/bridge-route-pinger/blob/main/SPEC.md
- Deployment notes: https://github.com/douglance/bridge-route-pinger/blob/main/DEPLOY.md

## Supported Inputs

```json
{
  "token": "USDC",
  "amount": "1",
  "from_chain": "ethereum",
  "to_chain": "base",
  "max_routes": 5
}
```

## Returns

- `routes`: available bridge routes with bridge provider, ETA, gas cost, and fee
- `eta_minutes`: ETA for the best route
- `fee_usd`: fee estimate for the best route
- `requirements`: approval address, source gas token, and included fees
- `best_route`: first route after ETA/fee sorting
- `data_sources`: LI.FI advanced routes endpoint
- `confidence`: based on number of viable official route quotes

## Validation

Local validation:

```text
npm run build
npm test
npm run smoke:live
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Observed live checks:

```text
curl -fsS https://bridge-route-pinger.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://bridge-route-pinger.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes ping-bridge-routes and x402/AP2 metadata

unpaid POST /entrypoints/ping-bridge-routes/invoke
-> HTTP 402 with x402 payment requirements for base-sepolia
```

Direct live LI.FI smoke for 1 USDC Ethereum -> Base returned 3 routes, best
bridge AcrossV4, ETA 1 minute, fee USD 1.4728, and confidence 0.8.

## Solana Wallet

`EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
