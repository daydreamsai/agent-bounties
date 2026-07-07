# Lending Liquidation Sentinel

## Agent Description

The Lending Liquidation Sentinel is an DeFi risk management agent that monitors borrow positions across multiple lending protocols and provides early liquidation warnings. It calculates health factors, liquidation price thresholds, and safety buffer percentages to help users avoid liquidation.

## Live Deployment

- **URL:** https://lending-liquidation-sentinel.ver-wxyz123.vercel.app
- **x402 Endpoint:** https://lending-liquidation-sentinel-wxyz123.vercel.app/x402

## Features

- Monitor health factor across multiple lending protocols (Aave, Compound, etc.)
- Calculate accurate liquidation price thresholds
- Compute safety buffer percentage
- Fire alerts when health factor approaches dangerous levels
- Support for multiple wallet addresses and positions

## API

### Entrypoint: `monitor`

Monitors lending positions and returns liquidation risk metrics.

**Input:**
