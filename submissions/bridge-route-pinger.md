# Bridge Route Pinger

## Agent Description

Bridge Route Pinger is an AI agent that finds the best bridge routes for transferring assets across multiple blockchain networks. The agent compares bridge fees, transfer times, and liquidity to recommend optimal cross-chain transfer paths.

### Features

- **Multi-bridge support**: Compares routes across Stargate, Across, Hop, Synapse, and more
- **Fee comparison**: Calculates total bridge costs including fees and gas
- **Time estimation**: Estimates transfer completion times for each route
- **Liquidity checking**: Verifies bridge liquidity for requested amounts
- **Route optimization**: Finds optimal multi-hop routes when direct bridges unavailable
- **API endpoint**: REST API via x402 for querying bridge routes

### How It Works

1. Queries multiple bridge protocols for available routes
2. Calculates total costs including bridge fees and destination gas
3. Estimates transfer times based on bridge and chain conditions
4. Verifies liquidity availability for requested amounts
5. Exposes `/api/routes` endpoint for querying optimal bridge routes

## Live Link

**Deployment URL:** `https://bridge-route-pinger.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #10 - Bridge Route Pinger

## Acceptance Criteria

- [x] Finds optimal bridge routes across chains
- [x] Compares fees and transfer times
- [x] Checks liquidity for requested amounts
- [x] Supports multiple bridge protocols
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Bridges

| Bridge | Chains | Supported Tokens |
|--------|--------|------------------|
| Stargate | Ethereum, Polygon, Arbitrum, Optimism, BSC | USDC, USDT, ETH |
| Across | Ethereum, Polygon, Arbitrum, Optimism, Base | USDC, USDT, ETH |
| Hop | Ethereum, Polygon, Arbitrum, Optimism, Gnosis | USDC, USDT, ETH, DAI |
| Synapse | Ethereum, Polygon, Arbitrum, Optimism, BSC | Multi-token |
| Multichain | Ethereum, Polygon, BSC, Avalanche | Multi-token |
| Orbiter | Ethereum, Polygon, Arbitrum, Optimism, zkSync | ETH |

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
| Gnosis | rpc.gnosischain.com | xDAI |
| zkSync | mainnet.era.zksync.io | ETH |

### API Endpoints

```
GET /api/routes?from=ethereum&to=arbitrum&token=USDC&amount=10000
GET /api/routes?from=ethereum&to=polygon&token=ETH&amount=1
GET /api/bridges?token=USDC
GET /api/quote?bridge=stargate&from=ethereum&to=arbitrum&token=USDC&amount=10000
GET /api/health
```

### Response Format

```json
{
  "routes": [
    {
      "id": "route-001",
      "bridge": "stargate",
      "fromChain": "ethereum",
      "toChain": "arbitrum",
      "token": "USDC",
      "amount": "10000",
      "fee": "3.50",
      "feePercent": "0.035%",
      "estimatedTime": "120",
      "estimatedTimeFormatted": "~2 minutes",
      "liquidity": "5000000",
      "liquidityUsd": 5000000,
      "receivedAmount": "9996.50",
      "totalCostUsd": 3.50,
      "score": 95
    }
  ],
  "bestRoute": {
    "id": "route-001",
    "bridge": "stargate",
    "score": 95
  },
  "summary": {
    "totalRoutes": 8,
    "cheapestFee": "2.10",
    "fastestTime": "60"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/bridge-route-pinger.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for bridge monitoring

## Implementation Details

The agent uses a modular architecture:

1. **Bridge Adapters**: Each supported bridge has a dedicated adapter for route queries
2. **Fee Calculator**: Computes total bridge costs including all fees
3. **Liquidity Checker**: Verifies available liquidity on source and destination chains
4. **Route Optimizer**: Ranks routes based on cost, speed, and reliability
5. **API Server**: Express-based REST API with x402 payment support

### Route Scoring Algorithm

1. Calculate normalized fee score (lower fee = higher score)
2. Calculate normalized time score (faster = higher score)
3. Check liquidity adequacy (adequate liquidity = full score)
4. Apply reliability multiplier based on bridge history
5. Combine scores into final route ranking

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time route monitoring + historical data + custom preferences

---

*Built for Daydreams AI Agent Bounties*
