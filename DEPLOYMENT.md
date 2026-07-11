# Slippage Sentinel Deployment

This agent is ready for a hosted domain and x402-protected invocation routes through `@lucid-dreams/agent-kit`.

## Runtime

Any Hono-compatible host can serve `src/index.ts` / the compiled default export:

- Cloudflare Workers
- Bun server
- Node/Hono adapter behind a domain
- Vercel/Fly/Railway with a Hono adapter

## Required environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `ADDRESS` | x402 pay-to address for settlement | `0x...` |
| `FACILITATOR_URL` | x402 facilitator URL | `https://x402.org/facilitator` |
| `NETWORK` | x402 network | `base` |
| `DEFAULT_PRICE` | price in USDC base units | `10000` |
| `AGENT_DOMAIN` | public HTTPS domain used in manifests/trust metadata | `https://slippage.example.com` |

`DEFAULT_PRICE=10000` is 0.01 USDC when USDC has 6 decimals.

## Verification endpoints

After deployment, verify:

```bash
curl -i https://YOUR_DOMAIN/health
curl -i https://YOUR_DOMAIN/entrypoints
curl -i https://YOUR_DOMAIN/.well-known/agent.json
curl -i https://YOUR_DOMAIN/entrypoints/estimate-slippage/invoke \
  -H 'content-type: application/json' \
  -d '{"token_in":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","token_out":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","amount_in":1000,"route_hint":"Uniswap V3"}'
```

With payment environment variables set, `estimate-slippage` and `echo` invoke routes are wrapped by x402. Unpaid requests should return `402 Payment Required`; paid x402 clients can settle and receive the slippage quote.

## Local development note

If no x402 environment variables are present, the app disables payment middleware so the four Harness commands and local agent discovery stay easy to run without secrets.
