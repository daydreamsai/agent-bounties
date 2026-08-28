# Bridge Route Pinger

Finds viable bridge routes and live fee/time quotes for token transfers across EVM chains.

## Agent

- **Name:** Bridge Route Pinger
- **Description:** Given a token, amount, source chain and destination chain, returns available bridge routes with estimated fees (in USD) and expected arrival time. Quotes are pulled live from the LI.FI aggregation API and align with on-chain bridge endpoints.
- **Live deployment:** https://praise-consumers-jamie-contests.trycloudflare.com
- **Bounty issue:** #10
- **Solana Wallet:** AJa3e4u4Qimo7ketNqkpSkD3FXhq6UQrxgD7m5WgVeew

## Usage

`POST /entrypoints/bridge-routes/invoke` (x402 paywalled)

```json
{
  "input": {
    "token": "USDC",
    "amount": "100",
    "from_chain": "arbitrum",
    "to_chain": "base"
  }
}
```

Returns `routes[]` with `tool`, `fee_usd`, `fee_costs`, `eta_minutes`, and `requirements`.

## Supported chains

Ethereum, Optimism, BSC, Polygon, Base, Arbitrum, Avalanche

## Resources

- Source: https://github.com/kiyeps/bridge-route-pinger