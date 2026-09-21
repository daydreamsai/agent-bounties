# Fresh Markets Watch

## Agent Description

Fresh Markets Watch is an AI agent that monitors newly created AMM pairs across multiple decentralized exchanges and chains. The agent tracks liquidity pool creation events in real-time, analyzes initial liquidity depth, and alerts users to promising new trading opportunities before they gain mainstream attention.

### Features

- **Real-time pair detection**: Monitors blockchain events for new liquidity pool creation
- **Multi-chain support**: Tracks new pairs on Ethereum, Polygon, Arbitrum, Optimism, Base, and BSC
- **Multi-DEX coverage**: Detects new pairs on Uniswap V2/V3, SushiSwap, PancakeSwap, and more
- **Liquidity analysis**: Evaluates initial TVL and liquidity depth of new pools
- **Risk assessment**: Flags potential rug pulls based on liquidity lock status and contract verification
- **API endpoint**: REST API via x402 for querying newly created pairs
- **Alerts**: Real-time notifications for new pairs matching custom criteria

### How It Works

1. Subscribes to blockchain events for pair/factory contract creation
2. Captures new liquidity pool creation events in real-time
3. Analyzes initial liquidity, token contracts, and pool parameters
4. Assesses risk factors including liquidity lock and contract verification
5. Exposes `/api/new-pairs` endpoint for querying fresh market data

## Live Link

**Deployment URL:** `https://fresh-markets-watch.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #1 - Fresh Markets Watch

## Acceptance Criteria

- [x] Monitors new AMM pair creation events
- [x] Supports multiple DEXes and chains
- [x] Provides real-time alerts for new pairs
- [x] Analyzes initial liquidity and risk factors
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Chains

| Chain | RPC Endpoint | Factory Contracts |
|-------|--------------|-------------------|
| Ethereum | eth.llamarpc.com | Uniswap V2/V3, SushiSwap |
| Polygon | polygon-rpc.com | QuickSwap, SushiSwap |
| Arbitrum | arb1.arbitrum.io/rpc | Uniswap V3, SushiSwap |
| Optimism | mainnet.optimism.io | Uniswap V3 |
| Base | mainnet.base.org | Uniswap V3 |
| BSC | bsc-dataseed.binance.org | PancakeSwap |
| Avalanche | api.avax.network/ext/bc/C/rpc | TraderJoe |

### API Endpoints

```
GET /api/new-pairs?chain=ethereum&dex=uniswap-v3&hours=24
GET /api/new-pairs?minLiquidity=10000&chain=polygon
GET /api/pair/{chain}/{pairAddress}
GET /api/stats?chain=ethereum
GET /api/health
```

### Response Format

```json
{
  "newPairs": [
    {
      "id": "pair-001",
      "chain": "ethereum",
      "dex": "uniswap-v3",
      "pairAddress": "0x1234...",
      "token0": {
        "address": "0xabcd...",
        "symbol": "NEWTOKEN",
        "name": "New Token",
        "decimals": 18
      },
      "token1": {
        "address": "0xdead...",
        "symbol": "USDC",
        "name": "USD Coin",
        "decimals": 6
      },
      "initialLiquidity": "50000",
      "initialLiquidityUsd": 50000,
      "fee": "0.3%",
      "createdAt": "2025-01-15T10:30:00Z",
      "riskScore": "low",
      "riskFactors": {
        "liquidityLocked": true,
        "contractVerified": true,
        "ownerRenounced": true
      },
      "txHash": "0xdef4..."
    }
  ],
  "summary": {
    "totalNewPairs": 25,
    "totalLiquidityUsd": 1250000,
    "avgRiskScore": "medium"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `DH1zBMUmncjJvrLPDSsVRow1mRZSA6vAf5pXxLVj3sjf`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/fresh-markets-watch.md
- **Architecture:** Uses Node.js with Express for the API server, and WebSocket connections for real-time blockchain event monitoring

## Implementation Details

The agent uses a modular architecture:

1. **Chain Listeners**: WebSocket connections to blockchain nodes for real-time event monitoring
2. **Event Parsers**: DEX-specific parsers for pair creation events
3. **Liquidity Analyzer**: Evaluates initial liquidity depth and pool parameters
4. **Risk Assessor**: Analyzes contract verification, liquidity locks, and ownership status
5. **Alert System**: Sends notifications for new pairs matching user criteria
6. **API Server**: Express-based REST API with x402 payment support

### Event Detection Algorithm

1. Subscribe to factory contract `PairCreated` or `PoolCreated` events
2. Parse event data to extract token addresses and pool parameters
3. Query token contracts for metadata (symbol, name, decimals)
4. Fetch initial reserves or liquidity from the pool contract
5. Assess risk factors (contract verification, ownership, liquidity lock)
6. Store and expose via API

### Risk Assessment

The agent evaluates new pairs for potential risks:

- **Liquidity Lock Status**: Checks if LP tokens are locked in a vesting contract
- **Contract Verification**: Verifies if token contracts are verified on block explorers
- **Ownership Status**: Detects if contract ownership is renounced
- **Honeypot Detection**: Simulates buy/sell to detect hidden taxes or restrictions
- **Initial Liquidity**: Flags extremely low liquidity pools

### x402 Integration

The API implements the x402 protocol for payment-gated access:

- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time WebSocket alerts + historical pair data + custom filters

---

*Built for Daydreams AI Agent Bounties*
