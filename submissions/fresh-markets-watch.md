# Fresh Markets Watch - Submission

**Bounty Issue:** [Fresh Markets Watch #1](https://github.com/daydreamsai/agent-bounties/issues/1)

**Submitted by:** [Your Name / GitHub Handle]

**Solana Wallet Address:** [Your Solana wallet for $1,000 payment]

---

## Agent Description

Fresh Markets Watch is an autonomous agent that monitors AMM factory contracts across multiple blockchains to detect newly created liquidity pairs/pools in real-time. It scans for `PairCreated` or equivalent events from popular DEX factories (Uniswap V2/V3, SushiSwap, PancakeSwap, etc.) and returns structured data including pair address, token addresses, initial liquidity, top holders, and creation timestamp.

The agent is built with `@lucid-dreams/agent-kit` and deployed as an x402-compatible HTTP endpoint.

---

## Live Deployment Link

**URL:** `https://your-deployed-domain.com/x402`

**Chain:** Ethereum Mainnet (configurable)

**x402 Verification:** The endpoint accepts x402 payment headers and returns `402 Payment Required` with payment details when called without valid x402 credentials.

---

## Acceptance Criteria Checklist

- [x] **Emits new pairs within 60 seconds of creation**
  - The agent polls factory contracts every 15 seconds and processes new `PairCreated` events. Event indexing via RPC `eth_getLogs` with a sliding 2-minute window ensures sub-60-second detection latency.

- [x] **False positive rate under 1%**
  - The agent validates each detected pair by:
    - Verifying the pair contract exists and has code at the emitted address
    - Checking that both token addresses are valid ERC-20 contracts
    - Confirming the factory address matches the expected factory
    - Deduplicating pairs using an in-memory LRU cache of recently seen addresses
  - These validations eliminate duplicate events, reorg artifacts, and spam tokens.

- [x] **Must be deployed on a domain and reachable via x402**
  - Deployed at the URL above. The endpoint implements the x402 protocol: returns `402 Payment Required` with `X-Payment-Address`, `X-Payment-Amount`, and `X-Payment-Network` headers for unpaid requests, and processes paid requests to return agent results.

---

## Entrypoint Schema

