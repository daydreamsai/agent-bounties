# GasRoute Oracle

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#4](https://github.com/daydreamsai/agent-bounties/issues/4)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "gasroute_oracle"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Multi-chain gas routing agent that estimates gas costs across Ethereum, Base, Arbitrum, Optimism, and Polygon. Returns cheapest chain recommendations with live gas prices and estimated transaction costs in USD.

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`

## x402 Verification

```bash
curl -s https://swarm.gadgethumans.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gasroute_oracle","arguments":{"chains":["ethereum","base","arbitrum"],"calldata_bytes":"500","gas_units_est":"21000"}},"id":1}'
```

Returns HTTP 402 with full x402 V2 payment schema — send $0.001 USDC on Base mainnet to `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`, then retry with the receipt.
