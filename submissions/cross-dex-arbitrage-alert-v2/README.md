# Cross DEX Arbitrage Alert v2

Detect cross-DEX token price spreads for arbitrage opportunities.

## Features

- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche
- **Real-time Price Quotes** via 0x API
- **Gas Cost Estimation** for accurate profit calculation
- **Net Spread Calculation** accounting for fees and gas
- **Configurable Minimum Spread Threshold**

## Entrypoints

### 1. `find_arbitrage`

Find profitable cross-DEX arbitrage opportunities.

**Input:**
- `token_in` - Input token address or symbol (e.g., "USDC")
- `token_out` - Output token address or symbol (e.g., "WETH")
- `amount_in` - Amount to swap (in smallest unit)
- `chains` - Chains to scan: `ethereum`, `polygon`, `arbitrum`, `optimism`, `base`, `bsc`, `avalanche`
- `min_spread_bps` - Minimum spread in basis points (default: 50)

**Returns:**
- `best_route` - Optimal arbitrage route
- `alt_routes` - Alternative profitable routes
- `net_spread_bps` - Net spread in basis points
- `est_fill_cost` - Estimated cost including fees/gas
- `quotes_by_chain` - Price quotes per chain

### 2. `get_quote`

Get DEX quote for a token pair on a specific chain.

### 3. `supported_chains`

List supported chains and common tokens.

### 4. `echo`

Health check endpoint.

## Supported Chains

| Chain | Native Token | Common Tokens |
|-------|--------------|---------------|
| Ethereum | ETH | WETH, USDC, USDT, DAI, WBTC |
| Polygon | MATIC | WMATIC, USDC, USDT, WETH |
| Arbitrum | ETH | WETH, USDC, USDT, ARB |
| Optimism | ETH | WETH, USDC |
| Base | ETH | WETH, USDC |
| BSC | BNB | WBNB, USDC, USDT |
| Avalanche | AVAX | WAVAX, USDC, USDT |

## Spread Calculation

```
Gross Spread (bps) = ((Best Output - Worst Output) / Worst Output) × 10000
Net Spread (bps) = Gross Spread - (Gas Costs / Input Amount × 10000)
```

Arbitrage is profitable when `Net Spread > 0` and exceeds the minimum threshold.

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build
```

## Deployment

### Vercel

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

## License

MIT