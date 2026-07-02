# Bridge Route Pinger

**Agent for Bounty #10** — Find the best bridge routes for cross-chain token transfers.

## Description

Bridge Route Pinger is an AI agent built with `@lucid-dreams/agent-kit` that provides real-time bridge route quotes for cross-chain token transfers. It integrates with the **Li.Finance API** to fetch and compare routes across multiple bridges.

### Features

- 🔄 **Cross-chain bridge quotes**: Get estimated receive amounts, fees, gas costs, and ETA for bridging tokens between chains
- 💱 **Supported tokens**: USDC, USDT, ETH, WETH, DAI (resolved automatically via Li.Finance token list) + any ERC-20 address
- ⛓️ **Supported chains**: Ethereum, Optimism, BSC, Polygon, Arbitrum, Base, Avalanche
- 🚀 **Real-time data**: Fetches live quotes from Li.Finance API with caching for token data
- ⚡ **Smart ETA estimation**: Estimates bridge completion times based on bridge provider
- 🛡️ **Error handling**: Proper input validation, timeout handling, and descriptive error messages

### Entrypoint: `bridge-routes`

**Input** (Zod schema):
- `token` (string): Token address or symbol (e.g. "USDC", "ETH", "USDT", "DAI", "WETH", or a contract address)
- `amount` (string): Amount to bridge in human-readable format (e.g. "100" for 100 USDC)
- `from_chain` (string): Source chain name (eth, optimism, bsc, polygon, arbitrum, base, avalanche)
- `to_chain` (string): Destination chain name

**Output**:
- `routes[]` — Array of bridge routes, each containing:
  - `name` (string): Bridge provider name
  - `from_amount` (string): Amount being sent
  - `to_amount` (string): Estimated receive amount
  - `fee_usd` (string): Estimated fee in USD
  - `eta_minutes` (number): Estimated time in minutes
  - `gas_cost_estimate` (string): Estimated gas cost
- `requirements` (object): Additional requirements like gas tokens needed
- `summary` (object): Overview of the request

## Deployment

**Live URL**: `https://bridge-route-pinger.example.com`
*(Replace with actual deployment URL)*

### Run locally

```bash
cd bridge-route-pinger
npm install
npx tsx src/index.ts
```

### Build

```bash
npm run build
```

## Related Issue

[#10: Bridge Route Pinger](https://github.com/daydreamsai/agent-bounties/issues/10)

## Solana Wallet Address

`YOUR_SOLANA_WALLET_HERE`

## Implementation Details

- **Framework**: `@lucid-dreams/agent-kit` (v0.2.24) with Hono server
- **API Integration**: Li.Finance REST API (`https://li.quest/v1/`)
- **Input Validation**: Zod schemas with descriptive error messages
- **Token Resolution**: Automatic resolution of token symbols to addresses via Li.Finance token API
- **Chain Mapping**: Maps human-readable chain names (eth, polygon, etc.) to numeric chain IDs
- **Caching**: Token data cached for 1 minute to reduce API calls
- **Timeout Handling**: 15-second timeout on route API calls, 10-second on token API calls
- **Error Handling**: Comprehensive error handling for API failures, invalid inputs, and timeouts
- **TypeScript**: Full TypeScript implementation with strict type checking

### Architecture

```
src/index.ts
├── Chain ID mapping (name → numeric ID)
├── Token cache (Li.Finance /v1/tokens)
├── Route fetcher (Li.Finance /v1/routes)
├── Amount parser (human → smallest unit)
├── Route formatter (API → output shape)
├── ETA estimator (per-bridge heuristics)
└── createAgentApp → addEntrypoint("bridge-routes") → export app
```
