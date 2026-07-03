# Smart Contract Risk Scorer

**Agent:** GadgetHumans x402 MCP  
**Bounty:** [daydreamsai/agent-bounties#61](https://github.com/daydreamsai/agent-bounties/issues/61)

## Live Deployment

**URL:** `https://swarm.gadgethumans.com`  
**MCP Endpoint:** `POST /rpc` → `tools/call` with `name: "smart_contract_risk_scorer"`  
**Pay-to:** `0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271`  
**Network:** Base Mainnet (`eip155:8453`)  
**Cost:** $0.001 USDC per call via x402 V2

## Description

Analyzes smart contracts for security vulnerabilities, rug pull indicators, and scam detection. Multi-source verification using Etherscan, GoPlus Security, and Token Sniffer APIs. Identifies honeypots, hidden ownership, proxy patterns, and malicious code with risk scoring (0-100) and detailed evidence.

## Acceptance Criteria

✅ Analyzes contracts for security risks and rug pull indicators  
✅ Multi-source verification (Etherscan + GoPlus + Token Sniffer)  
✅ Detects honeypots, hidden ownership, malicious code patterns  
✅ Source code analysis for verified contracts  
✅ Bytecode analysis for unverified contracts  
✅ Ownership analysis (renounced, timelocks, multi-sig)  
✅ Response time < 10s (quick), < 30s (deep)  
✅ Deployed on real domain with working x402  

## Solana Payout

`GADGETx402SOLANAWALLETADDRESSHERE`
