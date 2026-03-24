# Lending Liquidation Sentinel v2

A powerful DeFi lending position monitoring agent that tracks health factors and alerts before liquidation risk.

## Features

- **Multi-Protocol Support**: Aave v3, Compound v3, and Morpho Blue
- **Multi-Chain Support**: Ethereum, Arbitrum, Polygon, Optimism, Base, Avalanche
- **Real-time Health Factor Monitoring**
- **Liquidation Price Calculations**
- **Configurable Alert Thresholds**
- **Liquidation Simulation**

## Supported Protocols

| Protocol | Chains | Method |
|----------|--------|--------|
| Aave v3 | Ethereum, Arbitrum, Polygon, Optimism, Base, Avalanche | On-chain `Pool.getUserAccountData()` |
| Compound v3 | Ethereum, Arbitrum, Base | On-chain `Comet.isLiquidatable()` + `borrowBalanceOf()` |
| Morpho Blue | All supported chains | GraphQL API `blue-api.morpho.org` |

## Entrypoints

### 1. `check_position`

Check lending position health factor and get liquidation alerts.

**Input:**
- `wallet` - Wallet address to monitor
- `protocol_ids` - Protocols to check: `aave-v3`, `compound-v3`, `morpho`
- `chain` - Blockchain network: `ethereum`, `arbitrum`, `polygon`, `optimism`, `base`, `avalanche`
- `alert_threshold` - HF threshold for alerts (default: 1.3)

**Returns:**
- `positions[]` - Array of position data
  - `health_factor` - Current health factor
  - `liq_price_threshold` - Liquidation price threshold
  - `buffer_percent` - Safety buffer percentage
  - `alert_threshold_hit` - Boolean if alert fires
  - `alert_level` - `safe` | `warning` | `danger` | `critical`
  - `collateral_usd` - Total collateral in USD
  - `debt_usd` - Total debt in USD
- `summary` - Aggregated position summary

### 2. `simulate_liquidation`

Simulate how health factor changes under different price scenarios.

**Input:**
- `current_health_factor` - Current HF of the position
- `price_drops` - Price drop percentages to simulate

**Returns:**
- `simulations[]` - Projected HF at different price drops
- `safe_drop_percent` - Maximum safe price drop
- `warning` - Risk warning if applicable

### 3. `supported_protocols`

Get list of supported protocols and contract addresses.

### 4. `echo`

Health check endpoint.

## Alert Levels

| Level | Health Factor | Action |
|-------|--------------|--------|
| Safe | ≥ 2.0 | No action needed |
| Warning | ≥ 1.5 | Monitor closely |
| Danger | ≥ 1.1 | Consider reducing position |
| Critical | < 1.1 | Immediate liquidation risk! |

## Buffer Calculation

The buffer percentage represents how much collateral value can drop before liquidation:

```
Buffer % = (1 - 1/HF) × 100
```

For example, with HF = 1.5:
- Buffer = (1 - 1/1.5) × 100 = 33.3%

This means collateral can drop 33.3% before liquidation.

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## Deployment

The agent is designed to run on Bun or any serverless platform. Set the following environment variables for x402 monetization:

- `FACILITATOR_URL` - x402 facilitator URL
- `ADDRESS` - Payment receiving address
- `NETWORK` - Payment network (e.g., 'base')
- `DEFAULT_PRICE` - Default price in base units

## License

MIT