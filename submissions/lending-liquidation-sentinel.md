# Lending Liquidation Sentinel

Monitors DeFi lending positions on Aave V3 and Compound, calculates health factors and liquidation prices, and alerts when positions approach liquidation risk.

## Features

- **Multi-chain support**: Ethereum, Polygon, Arbitrum, Optimism, Base
- **Protocol support**: Aave V3 and Compound v2
- **Real-time health factor calculation**
- **Liquidation price estimation** using Chainlink price feeds
- **Customizable alert thresholds** (default: health factor < 1.5)
- **x402 monetization** ready via @lucid-dreams/agent-kit

## Entrypoint

`check-positions` — Check lending positions for liquidation risk

### Input Schema

```json
{
  "wallet": "0x...",
  "protocol_ids": ["aave", "compound"],
  "positions": [
    {
      "asset": "0x...",
      "protocol": "aave",
      "chain": "ethereum",
      "assetDecimals": 18,
      "collateralAmount": "...",
      "borrowAmount": "...",
      "priceFeed": "0x..."
    }
  ],
  "alertThreshold": 1.5
}
```

### Output

```json
{
  "health_factor": 2.3,
  "liq_price": null,
  "buffer_percent": 130.0,
  "alert_threshold_hit": false,
  "position_details": [...]
}
```

## Related Issue

Fixes [#9](https://github.com/daydreamsai/agent-bounties/issues/9)

## Deployment

Deployment link: _(placeholder — deployed via standard agent-kit x402 flow)_

## Solana Wallet

`YOUR_SOLANA_WALLET_ADDRESS`
