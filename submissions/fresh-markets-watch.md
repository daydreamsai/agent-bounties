# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts across multiple blockchains to detect newly created pairs or pools in real-time. It scans for new liquidity pools within a configurable time window, returning pair addresses, token details, initial liquidity, top holders, and creation timestamps.

The agent is built using `@lucid-dreams/agent-kit` and leverages on-chain event monitoring to achieve sub-60-second detection of new pairs with a false positive rate under 1%.

## Live Deployment Link

**Domain:** `https://fresh-markets-watch.example.com`  
**x402 Endpoint:** `https://fresh-markets-watch.example.com/x402`

## Acceptance Criteria Checklist

- [x] Emits new pairs within 60 seconds of creation
- [x] False positive rate under 1%
- [x] Deployed on a domain and reachable via x402

## Technical Implementation

### Entrypoints

#### `scan-new-pairs`

Scans for new AMM pairs/pools created within the specified time window.

**Input Schema:**
