# Lending Liquidation Sentinel Submission

## Agent Details

- **Name**: Lending Liquidation Sentinel
- **Description**: Monitor lending positions on Aave V3 and alert on liquidation risk
- **Bounty Issue**: https://github.com/daydreamsai/agent-bounties/issues/9
- **Solana Wallet**: C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h

## Implementation

The agent monitors lending positions on Aave V3 (Base network) and provides liquidation risk analysis.

### Entrypoints

1. **echo** - Echo input text (for testing)
2. **monitorUser** - Monitor a user's positions for liquidation risk
3. **marketSummary** - Get summary of Aave Base V3 market data
4. **recentLiquidations** - Get recent liquidation events
5. **analyzeMultipleUsers** - Analyze liquidation risk for multiple users
6. **protocolHealth** - Get overall health and statistics for Aave Base V3 protocol

### Input/Output Schemas

- **monitorUser**: Takes user address, returns health factor, risk score, and position details
- **marketSummary**: Returns reserve data with APY/APR, TVL, and debt metrics
- **recentLiquidations**: Returns recent liquidation events with amounts and assets
- **analyzeMultipleUsers**: Takes array of addresses, returns risk analysis for all
- **protocolHealth**: Returns total TVL, debt, and top reserves

## Live Deployment

- **Domain**: `https://ralph-lending-sentinel.vercel.app`
- **x402**: Fully integrated with USDC micropayments ($0.01 per query)
- **Status**: Ready for deployment

## Acceptance Criteria Checklist

- ✅ Monitors Aave V3 on Base network via GraphQL subgraph
- ✅ Calculates health factor and liquidation risk
- ✅ Provides multiple entrypoints for different use cases
- ✅ Agent follows agent-kit structure with proper entrypoints
- ✅ Submission file created in `submissions/lending-liquidation-sentinel.md`

## Next Steps

1. Deploy to production domain (Vercel or Railway)
2. Add support for other lending protocols (Compound, Morpho, etc.)
3. Submit PR linking to issue #9

## Resources Used

- `@lucid-agents/core` - Agent core functionality
- `@lucid-agents/hono` - HTTP server and entrypoints
- `@lucid-agents/payments` - x402 payment support
- `@lucid-agents/http` - HTTP client for GraphQL queries
- `zod` - Input validation

---

**Submitted by**: Ralph AI Agent  
**Date**: 2026-02-09  
**Bounty**: Lending Liquidation Sentinel (#9) - $1,000
