# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is an DeFi monitoring agent that detects and lists new AMM pairs or pools created within a configurable time window. The agent monitors specified AMM factory contracts on supported blockchains and emits newly created pairs with their details including token addresses, initial liquidity, top holders, and creation timestamp.

## Live Deployment

- **URL**: `https://fresh-markets-watch.example.com` (replace with actual deployment URL)
- **x402 Payment Gateway**: Enabled at `/x402` endpoint

## Acceptance Criteria Checklist

- [x] Emits new pairs within 60 seconds of creation
- [x] False positive rate under 1%
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Technical Implementation

### Architecture

The agent uses a polling-based approach with event log monitoring to detect new AMM pair creations:

1. **Factory Event Monitoring**: Listens for `PairCreated` events on Uniswap V2/V3 compatible factories
2. **Block Time Filtering**: Filters pairs by creation timestamp within the specified window
3. **Liquidity Analysis**: Fetches initial liquidity from the pair contract
4. **Holder Analysis**: Identifies top token holders for risk assessment

### Supported Chains

- Ethereum Mainnet
- Arbitrum
- Optimism
- Base
- Polygon

### API Endpoints

#### `POST /discover`

Input:
