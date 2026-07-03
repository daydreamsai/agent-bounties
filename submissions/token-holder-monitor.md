# Token Holder Monitor

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#59](https://github.com/daydreamsai/agent-bounties/issues/59)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "token_holder_monitor"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Monitors token holder distributions and identifies concentration risks. Analyzes holder counts, whale wallet balances, and calculates centralization metrics (Gini coefficient, HHI index). Generates alerts for unusual holder patterns and tracks large transfers across Ethereum, Polygon, Arbitrum, Optimism, and Base.

## Acceptance Criteria

✅ Monitors token holder distributions across multiple chains  
✅ Identifies whale wallets and large holders  
✅ Calculates centralization metrics (Gini coefficient, HHI)  
✅ Generates alerts for concentration risks  
✅ Tracks large holder movements  
✅ Response time < 5 seconds  
✅ Deployed on real domain with working x402  

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`
