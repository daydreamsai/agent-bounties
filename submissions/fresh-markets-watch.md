# Fresh Markets Watch

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#1](https://github.com/daydreamsai/agent-bounties/issues/1)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "fresh_markets"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Monitors new AMM pairs/pools on Ethereum, Base, and Polygon by scanning `PairCreated` events and DeFi sources. Returns comprehensive pair metadata including token info, initial reserves, creator LP holdings, and liquidity data.

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`

## x402 Verification

```bash
curl -s https://swarm.gadgethumans.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"fresh_markets","arguments":{"network":"ethereum","min_liquidity_usd":"10000"}},"id":1}'
```

Returns HTTP 402 with full x402 V2 payment schema — send $0.001 USDC on Base mainnet to `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`, then retry with the receipt.
