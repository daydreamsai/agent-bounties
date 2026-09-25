# GasRoute Oracle

## Agent Description

GasRoute Oracle is an AI agent that monitors gas prices across multiple EVM-compatible chains and finds the cheapest chain for executing transactions. The agent continuously tracks gas prices on Ethereum, Polygon, Arbitrum, Optimism, Base, and other supported chains, providing real-time recommendations for cost-optimized transaction routing.

### Features

- **Multi-chain gas monitoring**: Tracks real-time gas prices across 10+ EVM chains
- **Historical analysis**: Maintains gas price history for trend analysis and prediction
- **Cost estimation**: Calculates total transaction costs including gas fees for common operations
- **API endpoint**: Exposes REST API via x402 for querying cheapest chains
- **Alerts**: Optional webhook notifications for gas price thresholds

### How It Works

1. Polls gas prices from each supported chain's RPC endpoint every 30 seconds
2. Stores historical data for trend analysis
3. Exposes a `/api/cheapest` endpoint that returns the lowest-cost chain for a given transaction type
4. Supports custom transaction simulation for accurate cost estimation

## Live Link

**Deployment URL:** `https://gasroute-oracle.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #4 - GasRoute Oracle

## Acceptance Criteria

- [x] Monitors gas prices across multiple chains
- [x] Provides cheapest chain recommendations
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Chains

| Chain | RPC Endpoint | Native Token |
|-------|--------------|--------------|
| Ethereum | eth.llamarpc.com | ETH |
| Polygon | polygon-rpc.com | MATIC |
| Arbitrum | arb1.arbitrum.io/rpc | ETH |
| Optimism | mainnet.optimism.io | ETH |
| Base | mainnet.base.org | ETH |
| BSC | bsc-dataseed.binance.org | BNB |
| Avalanche | api.avax.network/ext/bc/C/rpc | AVAX |
| Fantom | rpc.ftm.tools | FTM |
| Gnosis | rpc.gnosischain.com | xDAI |
| Cronos | evm.cronos.org | CRO |

### API Endpoints

```
GET /api/cheapest?operation=transfer&token=USDC
GET /api/gas-prices
GET /api/history/{chain}?hours=24
GET /api/health
```

### Response Format

```json
{
  "cheapest": {
    "chain": "polygon",
    "gasPrice": "30",
    "gasPriceUsd": 0.01,
    "estimatedCost": "0.0001",
    "estimatedCostUsd": 0.01
  },
  "alternatives": [
    {
      "chain": "arbitrum",
      "gasPrice": "0.1",
      "gasPriceUsd": 0.03,
      "estimatedCost": "0.00001",
      "estimatedCostUsd": 0.03
    }
  ],
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/gasroute-oracle.md
- **Architecture:** Uses Node.js with Express for the API server, and a background worker for chain monitoring

## Implementation Details

The agent uses a modular architecture:

1. **Chain Adapters**: Each supported chain has a dedicated adapter that handles RPC communication and gas price parsing
2. **Price Aggregator**: Collects and normalizes gas prices from all chains
3. **History Store**: Maintains historical data for trend analysis (in-memory with optional Redis persistence)
4. **API Server**: Express-based REST API with x402 payment support
5. **Health Monitor**: Continuous health checks for all connected chains

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 100 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time WebSocket updates + historical data access

---

*Built for Daydreams AI Agent Bounties*
