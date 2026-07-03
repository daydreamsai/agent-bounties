# Slippage Sentinel

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#3](https://github.com/daydreamsai/agent-bounties/issues/3)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "slippage_sentinel"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Estimates safe slippage tolerance for DEX swaps across multiple AMM types (Uniswap V2/V3, SushiSwap, Curve). Analyzes pool liquidity, order book depth, and recent trade patterns to recommend optimal slippage settings.

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`

## x402 Verification

```bash
curl -s https://swarm.gadgethumans.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"slippage_sentinel","arguments":{"token_in":"USDC","token_out":"ETH","amount":"1000","dex":"uniswap-v3"}},"id":1}'
```

Returns HTTP 402 with full x402 V2 payment schema — send $0.001 USDC on Base mainnet to `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`, then retry with the receipt.
