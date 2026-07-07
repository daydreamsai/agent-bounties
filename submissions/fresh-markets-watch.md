# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is an DeFi monitoring agent that detects and lists new AMM pairs/pools created within a configurable time window. The agent monitors specified factory contracts on supported blockchains and emits newly created pairs with their details including token addresses, initial liquidity, top holders, and creation timestamp.

## Live Deployment

- **URL**: `https://fresh-markets-watch.example.com` (replace with actual deployed URL)
- **x402 Payment Gateway**: Enabled at `https://fresh-markets-watch.example.com/x402`

## Architecture

The agent is built using `@lucid-dreams/agent-kit` and consists of:

1. **Factory Monitor Service**: Polls AMM factory contracts for `PairCreated` events
2. **Pair Analyzer**: Fetches pair details (tokens, liquidity, holders) from on-chain data
3. **x402 Middleware**: Exposes the agent via x402 payment protocol

### Supported Chains & Factories

| Chain | Factory Address | Protocol |
|-------|----------------|----------|
| Ethereum | `0x5C69bEe701ef814a2B6a3EE8836063fb0f566b3e` | Uniswap V2 |
| Ethereum | `0x1F98431c8aD98523631AE4a59f2677ea` | Uniswap V3 |
| BSC | `0xcA143Ce11Fe3aD3b00f3fF703aFd40756266C8F2` | PancakeSwap V2 |
| Polygon | `0x5757371414417b8C6CAad4b75f6f61c26fC5b2H6` | QuickSwap |
| Arbitrum | `0xf1D7CC64A4456D154c24827B5E1A53cDDEb85a9e` | SushiSwap |

## API

### Entrypoint: `discover_new_pairs`

**Input:**
