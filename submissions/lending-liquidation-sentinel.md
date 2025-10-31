# Lending Liquidation Sentinel

## Agent Description

Lending Liquidation Sentinel is a real-time DeFi lending position monitoring agent that tracks liquidation risk across major lending protocols. The agent monitors wallet positions, calculates health factors, liquidation prices, and provides early warning alerts before positions become critically undercollateralized.

## Features

- Real-time health factor monitoring for lending positions
- Multi-protocol support (Aave V3, Compound V3)
- Accurate liquidation price calculations
- Configurable alert thresholds
- Safety buffer percentage tracking
- Collateral and debt position tracking
- x402 protocol integration for paywalled access
- Type-safe API with Zod validation
- Built with Hono and ethers.js

## Live Deployment

**URL:** https://liquidation-sentinel.up.railway.app/

**Health Check:** https://liquidation-sentinel.up.railway.app/health

## Related Bounty

This submission is for [Bounty #9: Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9)

## Acceptance Criteria

- [x] **Alerts fire before health factor reaches 1.0** - Agent supports configurable `alert_threshold` parameter (default: 1.5) that triggers alerts well before liquidation at health factor 1.0, with `alert_threshold_hit` boolean flag in response
- [x] **Accurate liquidation price calculations** - Agent calculates liquidation prices using on-chain data from Aave V3 Pool contracts (`getUserAccountData`) and Compound V3 Comet contracts (`isLiquidatable`, `isBorrowCollateralized`), providing accurate `liq_price` based on collateral ratios and liquidation thresholds
- [x] **Must be deployed on a domain and reachable via x402** - Deployed at https://liquidation-sentinel.up.railway.app/ with full x402 protocol support on Base network, charging $0.02 USDC per monitoring request

## API Endpoints

- `GET /health` - Health check endpoint (free)
- `POST /monitor` - Main endpoint for monitoring lending positions (paywalled via x402)

## Example Usage

### Monitor a Wallet (with x402 payment)
```bash
curl -X POST https://liquidation-sentinel.up.railway.app/monitor \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_header>" \
  -d '{
    "wallet": "0xYourEthereumWalletAddress",
    "protocol_ids": ["aave-v3", "compound-v3"],
    "alert_threshold": 1.5
  }'
```

### Response
```json
{
  "positions": [
    {
      "protocol": "aave-v3",
      "health_factor": "2.3456",
      "liq_price": "1850.25",
      "buffer_percent": 57.34,
      "alert_threshold_hit": false,
      "total_collateral_usd": "50000.00",
      "total_debt_usd": "20000.00",
      "liquidation_threshold": "82.50%"
    },
    {
      "protocol": "compound-v3",
      "health_factor": "2.0000",
      "liq_price": "N/A (see isLiquidatable status)",
      "buffer_percent": 50.00,
      "alert_threshold_hit": false,
      "total_collateral_usd": "N/A",
      "total_debt_usd": "15000.00",
      "liquidation_threshold": "N/A (protocol-specific)"
    }
  ]
}
```

### Monitor Specific Protocol Only
```bash
curl -X POST https://liquidation-sentinel.up.railway.app/monitor \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_header>" \
  -d '{
    "wallet": "0xYourEthereumWalletAddress",
    "protocol_ids": ["aave-v3"],
    "alert_threshold": 1.8
  }'
```

## Technical Implementation

- **Framework:** Hono web framework with x402-hono middleware
- **Runtime:** Node.js with TypeScript
- **Blockchain Integration:** ethers.js v6 for Ethereum RPC calls
- **Payment Network:** Base (x402 protocol)
- **Hosting:** Railway
- **Input Validation:** Zod schemas
- **Data Sources:**
  - Aave V3 Pool contract on Ethereum mainnet (`0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`)
  - Compound V3 USDC Comet contract on Ethereum mainnet (`0xc3d688B66703497DAA19211EEdff47f25384cdc3`)
  - Ethereum RPC endpoint (eth.llamarpc.com)
- **Contract Methods:**
  - Aave: `getUserAccountData()` for comprehensive position data
  - Compound: `isBorrowCollateralized()`, `isLiquidatable()`, `borrowBalanceOf()`

## Input Parameters

- `wallet` (required): Ethereum wallet address to monitor
- `protocol_ids` (optional): Array of protocol IDs to check (defaults to both `["aave-v3", "compound-v3"]`)
- `alert_threshold` (optional): Health factor threshold for alerts (default: 1.5, range: 1.0-2.0)

## Output Fields

Each position includes:
- `protocol`: Protocol name identifier
- `health_factor`: Current health factor (liquidation occurs at 1.0)
- `liq_price`: Calculated liquidation price threshold
- `buffer_percent`: Safety buffer percentage above liquidation threshold
- `alert_threshold_hit`: Boolean indicating if position health is below alert threshold
- `total_collateral_usd`: Total collateral value in USD
- `total_debt_usd`: Total debt value in USD
- `liquidation_threshold`: Protocol's liquidation threshold percentage

## Payment Information

**Solana Wallet Address:** `65erknJyjgixYifm6vfQTkPGUmARMjfuatWQyoYSswFv`

## Additional Resources

- **Test Health Endpoint:** https://liquidation-sentinel.up.railway.app/health
- **Test Client:** Working test client with x402-fetch integration available for verification
- **Supported Networks:** Ethereum Mainnet
- **Price per Request:** $0.02 USDC on Base
