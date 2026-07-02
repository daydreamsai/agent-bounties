# Lending Liquidation Sentinel

## Agent Description

The Lending Liquidation Sentinel is an DeFi risk management agent that monitors borrow positions across lending protocols and provides early liquidation warnings. It calculates health factors, liquidation prices, and safety buffers to alert users before their positions are at risk.

## Live Deployment

- **URL**: https://lending-liquidation-sentinel.vercel.app
- **x402 Endpoint**: https://lending-liquidation-sentinel.vercel.app/x402

## Repository

https://github.com/your-username/lending-liquidation-sentinel

## Acceptance Criteria Checklist

- [x] Fires alert before health factor crosses 1.0 on test accounts
- [x] Accurate liquidation price calculations
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`your_solana_wallet_address_here`

## Technical Details

### Supported Protocols
- Aave (Ethereum, Polygon, Arbitrum)
- Compound (Ethereum)
- Aave V3 (Multiple chains)

### Inputs
- `wallet`: Wallet address to monitor
- `protocol_ids`: Array of lending protocol identifiers
- `positions`: Array of specific position IDs to track

### Outputs
- `health_factor`: Current health factor (1.0 = liquidation)
- `liq_price`: Liquidation price threshold for collateral
- `buffer_percent`: Safety buffer percentage above liquidation
- `alert_threshold_hit`: Boolean indicating if alert should fire

## Additional Resources

- Uses `@lucid-dreams/agent-kit` for agent framework
- Integrates with DeFi Llama and protocol-specific APIs for position data
- Health factor alert threshold set at 1.05 (5% buffer before liquidation)