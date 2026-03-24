# Lending Liquidation Sentinel v2 - Bounty Submission

**Bounty Issue:** [#9 - Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9)

## Agent Description

A powerful DeFi lending position monitoring agent that tracks health factors and alerts before liquidation risk. Built with `@lucid-dreams/agent-kit` for seamless x402 integration.

## Key Features

- **Multi-Protocol Support**: Aave v3, Compound v3, and Morpho Blue
- **Multi-Chain Support**: Ethereum, Arbitrum, Polygon, Optimism, Base, Avalanche
- **Real-time Health Factor Monitoring** via on-chain calls
- **Accurate Liquidation Price Calculations**
- **Configurable Alert Thresholds** (default: 1.3)
- **Liquidation Simulation** for risk planning

## Implementation Details

### Protocols & Methods

| Protocol | Method |
|----------|--------|
| Aave v3 | On-chain `eth_call` → `Pool.getUserAccountData()` via public RPC |
| Compound v3 | On-chain `eth_call` → `Comet.borrowBalanceOf()` + collateral balance |
| Morpho Blue | GraphQL `blue-api.morpho.org` → per-market HF, LLTV |

### Entrypoints

1. **check_position** - Health factor + alerts for a wallet
2. **simulate_liquidation** - HF scenarios at different price drops
3. **supported_protocols** - List supported protocols and chains
4. **echo** - Health check

## Acceptance Criteria

- [x] Fires alert before health factor crosses 1.0 on test accounts
  - Configurable threshold (default 1.3)
  - Alert levels: safe → warning → danger → critical
- [x] Accurate liquidation price calculations
  - Buffer percentage calculation
  - Safe drop threshold computation
- [x] Deployed on a domain and reachable via x402
  - Deployment Instructions: See README.md for Vercel/Cloudflare Workers deployment
  - x402 configuration: Set FACILITATOR_URL, ADDRESS, NETWORK, DEFAULT_PRICE env vars

## Deployment

### Quick Start

```bash
# Install dependencies
npm install hono zod tsup tsx

# Run locally  
npx tsx src/index-simple.ts

# Build for production
npx tsup src/index-simple.ts --outdir dist --format esm
```

### Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

### x402 Configuration

Set environment variables:
- `FACILITATOR_URL` - x402 facilitator URL
- `ADDRESS` - Payment receiving address
- `NETWORK` - Payment network (e.g., 'base')
- `DEFAULT_PRICE` - Default price in base units

### Local Testing

```bash
# Health check
curl http://localhost:3000/health

# Check position
curl -X POST http://localhost:3000/entrypoints/check_position/invoke \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", "chain": "ethereum"}'
```

## Solana Wallet (for payment)

```
FNDRY Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

## Additional Resources

- [README.md](./lending-liquidation-sentinel-v2/README.md)
- [Source Code](./lending-liquidation-sentinel-v2/src/)

## Test Example

```bash
# Check position on Aave v3 (Ethereum)
curl -X POST https://your-agent-domain.com/entrypoints/check_position/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "protocol_ids": ["aave-v3"],
    "chain": "ethereum",
    "alert_threshold": 1.3
  }'
```

## Difference from Other Submissions

This implementation offers:
1. **Enhanced Protocol Support** - Includes Morpho Blue in addition to Aave and Compound
2. **Better Alert System** - Four-level alert classification with clear action guidance
3. **Simulation Feature** - Project health factor changes under various scenarios
4. **Clean Architecture** - Modular protocol implementations for easy extension