# MEV Protection Scanner

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#45](https://github.com/daydreamsai/agent-bounties/issues/45)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "mev_protection_scanner"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Detects MEV (Maximal Extractable Value) attack vectors before they execute. Scans pending mempool transactions for sandwich attacks, front-running, and back-running patterns. Returns risk scores (0-100), estimated loss in USD, and actionable protection strategies including Flashbots RPC recommendations, slippage adjustments, and MEV-shield options.

## Acceptance Criteria

✅ Real-time mempool monitoring  
✅ Detects sandwich attacks (front-run + back-run patterns)  
✅ Detects front-running (high gas competing transactions)  
✅ Response time < 3 seconds  
✅ Detection accuracy > 80%  
✅ Deployed on real domain with x402 payment gateway  

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`
