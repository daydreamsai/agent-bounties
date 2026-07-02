# MEV Protection Scanner

Closes #45

## Live Deployment
https://mev-protection-scanner.netlify.app

## Agent Description
Detects MEV attack risk (sandwich attacks, front-running) for DeFi trades. Uses KyberSwap
aggregator price impact data + on-chain gas prices (no API keys required) to calculate
extractable value and sandwich profitability. Returns risk score 0-100, attack type,
estimated loss, and actionable protection suggestions.

## How It Works
1. Fetches KyberSwap price quote for the trade to get `priceImpact` (free, no auth)
2. Fetches current `eth_gasPrice` via public RPC
3. Gets ETH price from DeFiLlama coins API
4. Calculates: `extractable_usd = trade_value * price_impact_pct`
5. Calculates: `sandwich_profit = extractable_usd - sandwich_gas_cost_usd`
6. Risk score: high price impact + profitable sandwich = high risk
7. Recommends Flashbots, MEV Blocker, CowSwap based on risk level

## MEV Risk Formula
```
extractable_usd = amount_out_usd * price_impact_pct / 100
sandwich_gas_cost_usd = (gas_price_wei * 400_000 / 1e18) * eth_price_usd
sandwich_profit = extractable_usd - sandwich_gas_cost_usd
risk_score = f(price_impact_pct, sandwich_profit, chain, token_pair)
```

## Entrypoint
**Key:** `scan`

**Input:**
```json
{
  "token_in": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "token_out": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount_in": "100000000000",
  "dex": "uniswap-v3",
  "chain": "ethereum"
}
```

**Output:**
```json
{
  "risk_score": 65,
  "risk_level": "high",
  "attack_type": "sandwich",
  "estimated_loss_usd": 45.50,
  "protection_suggestions": [
    "🛡️ Use Flashbots Protect RPC (rpc.flashbots.net)",
    "🔒 Set max slippage to 0.5% or lower",
    "💨 Use MEV Blocker (rpc.mevblocker.io)"
  ],
  "competing_txs": 38,
  "gas_price_percentile": 76,
  "market_data": {
    "price_impact_pct": "1.2345",
    "trade_value_usd": "3456.00",
    "sandwich_gas_cost_usd": "8.50",
    "sandwich_profit_usd": "34.15",
    "current_gas_gwei": "25.40"
  }
}
```

## APIs Used (all free, no auth)
- **KyberSwap** — `aggregator-api.kyberswap.com/{chain}/api/v1/routes` for price impact
- **DeFiLlama** — `coins.llama.fi/prices/current/coingecko:ethereum` for ETH price
- **Public RPC** — `eth.llamarpc.com` `eth_gasPrice` for current gas

## Protection Recommendations
- Flashbots Protect: `rpc.flashbots.net`
- MEV Blocker: `rpc.mevblocker.io`
- Eden Network: private mempool
- CowSwap: batch auction orders

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef