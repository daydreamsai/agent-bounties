import { Agent } from '@lucid-agents/core'
import { x402Middleware } from '@lucid-agents/payments'
import fetch from 'node-fetch'

// x402 configuration
const X402_CONFIG = {
  network: 'base-sepolia',
  recipient: '0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C',
  price: 0.01
}

// DEX subgraphs to monitor
const DEX_SUBGRAPHS = {
  uniswapV3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  sushiswap: 'https://api.thegraph.com/subgraphs/name/sushi/subgraph-v3'
}

// Cross DEX Arbitrage Alert Agent
export const crossDexArbitrageAgent = new Agent({
  name: 'cross-dex-arbitrage-alert',
  description: 'Monitors price spreads across DEXs for arbitrage opportunities',
  version: '1.0.0'
})

// Add x402 middleware for micropayments
crossDexArbitrageAgent.use(x402Middleware(X402_CONFIG))

// API endpoint: GET /api/arbitrage?tokenIn=WETH&tokenOut=USDC&amount=100
crossDexArbitrageAgent.addHandler('arbitrage', async (req, ctx) => {
  const { tokenIn, tokenOut, amount = 100 } = req.query
  
  try {
    const opportunities = []
    
    // Fetch prices from Uniswap V3
    const uniswapQuery = `
      query {
        pools(first: 5, where: {
          token0: "${tokenIn.toLowerCase()}",
          token1: "${tokenOut.toLowerCase()}"
        }) {
          id
          token0 { symbol }
          token1 { symbol }
          token0Price
          token1Price
          liquidity
        }
      }
    `
    
    const uniswapResponse = await fetch(DEX_SUBGRAPHS.uniswapV3, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: uniswapQuery })
    })
    
    const uniswapData = await uniswapResponse.json()
    
    // Fetch prices from Sushiswap
    const sushiswapQuery = `
      query {
        pools(first: 5, where: {
          token0: "${tokenIn.toLowerCase()}",
          token1: "${tokenOut.toLowerCase()}"
        }) {
          id
          token0 { symbol }
          token1 { symbol }
          token0Price
          token1Price
          liquidity
        }
      }
    `
    
    const sushiswapResponse = await fetch(DEX_SUBGRAPHS.sushiswap, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sushiswapQuery })
    })
    
    const sushiswapData = await sushiswapResponse.json()
    
    // Calculate arbitrage opportunities
    if (uniswapData.data?.pools && sushiswapData.data?.pools) {
      for (const uniswapPool of uniswapData.data.pools) {
        for (const sushiswapPool of sushiswapData.data.pools) {
          const price1 = parseFloat(uniswapPool.token1Price)
          const price2 = parseFloat(sushiswapPool.token1Price)
          
          if (Math.abs(price1 - price2) > 0.001) { // 0.1% spread threshold
            const spread = ((Math.max(price1, price2) - Math.min(price1, price2)) / Math.min(price1, price2)) * 100
            const grossProfit = (amount * spread) / 100
            const fees = amount * 0.003 // 0.3% fee
            const netProfit = grossProfit - fees
            
            if (netProfit > 0) {
              opportunities.push({
                dex1: 'Uniswap V3',
                dex2: 'Sushiswap',
                tokenIn,
                tokenOut,
                price1,
                price2,
                spread: spread.toFixed(2),
                profitEstimate: grossProfit.toFixed(2),
                fees: fees.toFixed(2),
                netProfit: netProfit.toFixed(2)
              })
            }
          }
        }
      }
    }
    
    return {
      opportunities,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return { error: error.message }
  }
})

// Export agent
export default crossDexArbitrageAgent
