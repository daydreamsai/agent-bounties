import { Agent } from '@lucid-agents/core'
import { x402Middleware } from '@lucid-agents/payments'
import fetch from 'node-fetch'

// x402 configuration
const X402_CONFIG = {
  network: 'base-sepolia',
  recipient: '0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C',
  price: 0.005
}

// DEX subgraphs to monitor
const DEX_SUBGRAPHS = {
  uniswapV3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  sushiswap: 'https://api.thegraph.com/subgraphs/name/sushi/subgraph-v3'
}

// Fresh Markets Watch Agent
export const freshMarketsAgent = new Agent({
  name: 'fresh-markets-watcher',
  description: 'Monitors DEXs for newly deployed AMM pairs with x402 micropayments',
  version: '1.0.0'
})

// Add x402 middleware for micropayments
freshMarketsAgent.use(x402Middleware(X402_CONFIG))

// API endpoint: GET /api/fresh-markets?chain=ethereum&minLiquidity=10000
freshMarketsAgent.addHandler('fresh-markets', async (req, ctx) => {
  const { chain = 'ethereum', minLiquidity = 10000 } = req.query
  
  if (chain !== 'ethereum') {
    return { error: 'Only Ethereum chain supported' }
  }

  try {
    const freshPairs = []
    
    // Query Uniswap V3 subgraph for new pools
    const uniswapQuery = `
      query {
        pools(first: 10, orderBy: createdAtTimestamp, orderDirection: desc, where: {createdAtTimestamp_gt: "${Date.now() - 3600000}"}) {
          id
          token0 { symbol }
          token1 { symbol }
          liquidity
          volumeUSD
          feeTier
          createdAtTimestamp
        }
      }
    `
    
    const uniswapResponse = await fetch(DEX_SUBGRAPHS.uniswapV3, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: uniswapQuery })
    })
    
    const uniswapData = await uniswapResponse.json()
    
    if (uniswapData.data?.pools) {
      for (const pool of uniswapData.data.pools) {
        if (parseFloat(pool.liquidity) >= minLiquidity) {
          freshPairs.push({
            address: pool.id,
            token0: pool.token0.symbol,
            token1: pool.token1.symbol,
            liquidity: parseFloat(pool.liquidity),
            volume24h: parseFloat(pool.volumeUSD),
            feeTier: parseFloat(pool.feeTier) / 1000000,
            deployedAt: new Date(parseInt(pool.createdAtTimestamp) * 1000).toISOString()
          })
        }
      }
    }
    
    return {
      pairs: freshPairs,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return { error: error.message }
  }
})

// Export agent
export default freshMarketsAgent
