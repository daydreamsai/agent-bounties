# Bounty Submission

Related Issue: #1

---

## Submission File

File Path: `submissions/fresh-markets-watch.md`

---

## Agent Description

Fresh Markets Watch is a DeFi monitoring agent that scans DEX factories for newly created trading pairs across multiple chains (Ethereum, Arbitrum, Polygon, BSC, Avalanche). It detects new pairs within specified time ranges and returns detailed information including pair addresses, token addresses, creation blocks, and transaction hashes.

The agent is built with `@lucid-dreams/agent-kit` and uses viem for blockchain interactions. It supports multiple DEX protocols including Uniswap V2, SushiSwap, PancakeSwap, Trader Joe, and more.

---

## Live Link

Deployment URL: https://ljapptest--fresh-markets-watch-handle.modal.run

- **Health Endpoint:** https://ljapptest--fresh-markets-watch-health.modal.run
- **Invoke Endpoint:** https://ljapptest--fresh-markets-watch-invoke.modal.run

---

## Acceptance Criteria

- [x] Meets all technical specifications
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] All acceptance criteria from the issue are met
- [x] Submission file added to submissions/ directory

---

## Other Resources

- Repository: https://github.com/ljapptest-art/agent-bounties/tree/fresh-markets-watch-submission
- Documentation: Agent code and README available in the submission branch
- Demo Video: N/A
- Other: N/A

---

## Solana Wallet

Wallet Address: `3C1vCMFrgHDRqsLshw7pUx6mST9Wc854neRmDhyTBP8t`

---

## Additional Notes

**Technical Stack:**
- Runtime: Bun + TypeScript
- Blockchain Library: viem
- Deployment: Modal (serverless)
- Agent Kit: @lucid-dreams/agent-kit v0.2.24

**Supported Chains:**
- Ethereum
- Arbitrum
- Polygon
- BSC (BNB Chain)
- Avalanche

**Entrypoints:**
1. `scan-new-pairs` - Scans DEX factories for new pairs within a specified time range
2. `health` - Returns agent health status

**Input Parameters:**
- `chain` (required): ethereum, arbitrum, polygon, bsc, or avalanche
- `since` (optional): ISO timestamp for start of time range
- `until` (optional): ISO timestamp for end of time range

**Output:**
- Array of new pairs with pair address, token0/token1 addresses, creation block, and transaction hash
- Total count of pairs found
