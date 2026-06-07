# Daydreams x402 Deployment Notes

This PR contains two independent x402-protected agent services:

- `submissions/slippage-sentinel`
- `submissions/gasroute-oracle`

Each package includes a Dockerfile and exposes:

- `GET /health`
- `POST /estimate_slippage` or `POST /estimate_gas_route`, protected by x402

## Required Environment

Set these variables in the hosting provider:

- `X402_PAY_TO`: EVM address that receives x402 payments
- `X402_NETWORK`: defaults to `eip155:84532` for Base Sepolia
- `X402_FACILITATOR_URL`: defaults to `https://x402.org/facilitator`
- `X402_PRICE`: defaults to `$0.001`
- `PORT`: provided by most hosts; defaults to `3000`

## Container Deployment

Deploy each service from its own directory:

```bash
cd submissions/slippage-sentinel
docker build -t slippage-sentinel .
docker run --rm -p 3000:3000 -e X402_PAY_TO=0xYourAddress slippage-sentinel

cd ../gasroute-oracle
docker build -t gasroute-oracle .
docker run --rm -p 3001:3000 -e X402_PAY_TO=0xYourAddress gasroute-oracle
```

## Verification

```bash
curl -i https://your-slippage-domain.example/health
curl -i -X POST https://your-slippage-domain.example/estimate_slippage \
  -H 'content-type: application/json' \
  --data '{"token_in":"0x4200000000000000000000000000000000000006","token_out":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","amount_in":"1","route_hint":"base/uniswap"}'

curl -i https://your-gasroute-domain.example/health
curl -i -X POST https://your-gasroute-domain.example/estimate_gas_route \
  -H 'content-type: application/json' \
  --data '{"chain_set":["ethereum","base","arbitrum"],"calldata_size_bytes":512,"gas_units_est":180000}'
```

Unauthenticated protected requests should return `HTTP/1.1 402 Payment Required` and include the `PAYMENT-REQUIRED` header.

## Render Blueprint

The repository root includes `render.yaml` with two Docker web services:

- `slippage-sentinel`
- `gasroute-oracle`

In Render, create a Blueprint from the forked repository, then set `X402_PAY_TO` for both services. Render will build each service from its submission directory and use `/health` as the health check.
