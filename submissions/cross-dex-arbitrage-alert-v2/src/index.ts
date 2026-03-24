import { z } from 'zod';
import { Hono } from 'hono';

// DEX Aggregator APIs
const AGGREGATOR_APIS = {
  '0x': {
    baseUrl: 'https://api.0x.org',
    chains: {
      ethereum: '1',
      polygon: '137',
      arbitrum: '42161',
      optimism: '10',
      base: '8453',
      bsc: '56',
      avalanche: '43114'
    }
  },
  '1inch': {
    baseUrl: 'https://api.1inch.dev/swap',
    chains: {
      ethereum: '1',
      polygon: '137',
      arbitrum: '42161',
      optimism: '10',
      base: '8453',
      bsc: '56',
      avalanche: '43114'
    }
  },
  paraswap: {
    baseUrl: 'https://api.paraswap.io',
    chains: {
      ethereum: '1',
      polygon: '137',
      arbitrum: '42161',
      optimism: '10',
      base: '8453',
      bsc: '56',
      avalanche: '43114'
    }
  }
};

// Common tokens by chain
const COMMON_TOKENS: Record<string, Record<string, { address: string; decimals: number; symbol: string }>> = {
  ethereum: {
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, symbol: 'WETH' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, symbol: 'USDC' },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, symbol: 'USDT' },
    DAI: { address: '0x6B175474E89094C44Da98b954EescdeCB6b8266F', decimals: 18, symbol: 'DAI' },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, symbol: 'WBTC' }
  },
  polygon: {
    WMATIC: { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, symbol: 'WMATIC' },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, symbol: 'USDC' },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, symbol: 'USDT' },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f6A1', decimals: 18, symbol: 'WETH' }
  },
  arbitrum: {
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, symbol: 'WETH' },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, symbol: 'USDC' },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, symbol: 'USDT' },
    ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, symbol: 'ARB' }
  },
  base: {
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC' }
  }
};

// Gas costs by chain (in native token)
const GAS_COSTS: Record<string, { avgGas: number; gasPriceGwei: number }> = {
  ethereum: { avgGas: 150000, gasPriceGwei: 20 },
  polygon: { avgGas: 150000, gasPriceGwei: 30 },
  arbitrum: { avgGas: 300000, gasPriceGwei: 0.1 },
  optimism: { avgGas: 200000, gasPriceGwei: 0.5 },
  base: { avgGas: 200000, gasPriceGwei: 0.5 },
  bsc: { avgGas: 150000, gasPriceGwei: 3 },
  avalanche: { avgGas: 150000, gasPriceGwei: 25 }
};

// Native token prices (approximate)
const NATIVE_PRICES: Record<string, number> = {
  ethereum: 3500,
  polygon: 0.5,
  arbitrum: 3500,
  optimism: 3500,
  base: 3500,
  bsc: 600,
  avalanche: 35
};

// Create agent app
const app = new Hono();

// Health endpoint
app.get('/health', (c) => {
  return c.json({ ok: true, version: '1.0.0', name: 'cross-dex-arbitrage-alert-v2' });
});

// Entrypoints list
app.get('/entrypoints', (c) => {
  return c.json({
    items: [
      { key: 'find_arbitrage', description: 'Find cross-DEX arbitrage opportunities', streaming: false },
      { key: 'get_quote', description: 'Get DEX quote for a token pair', streaming: false },
      { key: 'supported_chains', description: 'List supported chains and tokens', streaming: false },
      { key: 'echo', description: 'Health check', streaming: false }
    ]
  });
});

// Agent card
app.get('/.well-known/agent.json', (c) => {
  return c.json({
    name: 'cross-dex-arbitrage-alert-v2',
    version: '1.0.0',
    description: 'Detect cross-DEX token price spreads for arbitrage opportunities',
    skills: [
      {
        id: 'find_arbitrage',
        name: 'find_arbitrage',
        description: 'Find profitable cross-DEX arbitrage opportunities',
        inputSchema: {
          type: 'object',
          properties: {
            token_in: { type: 'string', description: 'Input token address or symbol' },
            token_out: { type: 'string', description: 'Output token address or symbol' },
            amount_in: { type: 'string', description: 'Amount to swap' },
            chains: { type: 'array', items: { type: 'string' }, description: 'Chains to scan' },
            min_spread_bps: { type: 'number', description: 'Minimum spread in basis points' }
          }
        }
      }
    ]
  });
});

// Get quote from 0x API
async function get0xQuote(
  chainId: string,
  tokenIn: string,
  tokenOut: string,
  amount: string
): Promise<{ outputAmount: string; gas: string; price: number } | null> {
  try {
    const url = `https://api.0x.org/swap/v1.quote?chainId=${chainId}&fromTokenAddress=${tokenIn}&toTokenAddress=${tokenOut}&amount=${amount}&slippagePercentage=0.01`;
    
    const response = await fetch(url, {
      headers: {
        '0x-api-key': 'demo' // Free tier
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      outputAmount: data.toAmount,
      gas: data.gas,
      price: parseFloat(data.price) || 0
    };
  } catch (error) {
    return null;
  }
}

// Get quote from 1inch API
async function get1inchQuote(
  chainId: string,
  tokenIn: string,
  tokenOut: string,
  amount: string
): Promise<{ outputAmount: string; gas: string; price: number } | null> {
  try {
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${tokenIn}&dst=${tokenOut}&amount=${amount}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer demo',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      outputAmount: data.dstAmount,
      gas: data.gas || '150000',
      price: 0
    };
  } catch (error) {
    return null;
  }
}

// Calculate gas cost in USD
function calculateGasCost(chain: string): number {
  const gasConfig = GAS_COSTS[chain];
  if (!gasConfig) return 0;
  
  const gasCostWei = gasConfig.avgGas * gasConfig.gasPriceGwei * 1e9;
  const gasCostEth = gasCostWei / 1e18;
  const nativePrice = NATIVE_PRICES[chain] || 0;
  
  return gasCostEth * nativePrice;
}

// Find arbitrage opportunities
app.post('/entrypoints/find_arbitrage/invoke', async (c) => {
  const body = await c.req.json();
  const tokenIn = body.token_in || body.input?.token_in || 'USDC';
  const tokenOut = body.token_out || body.input?.token_out || 'WETH';
  const amountIn = body.amount_in || body.input?.amount_in || '1000000000'; // 1000 USDC
  const chains = body.chains || body.input?.chains || ['ethereum', 'arbitrum', 'base'];
  const minSpreadBps = body.min_spread_bps || body.input?.min_spread_bps || 50; // 0.5%

  const quotes: any[] = [];

  for (const chain of chains) {
    const tokens = COMMON_TOKENS[chain];
    if (!tokens) continue;

    const tokenInInfo = tokens[tokenIn.toUpperCase()] || { address: tokenIn, decimals: 18, symbol: tokenIn };
    const tokenOutInfo = tokens[tokenOut.toUpperCase()] || { address: tokenOut, decimals: 18, symbol: tokenOut };

    if (!tokenInInfo.address || !tokenOutInfo.address) continue;

    // Get quote from 0x
    const chainId = AGGREGATOR_APIS['0x'].chains[chain as keyof typeof AGGREGATOR_APIS['0x']['chains']];
    if (!chainId) continue;

    const quote = await get0xQuote(chainId, tokenInInfo.address, tokenOutInfo.address, amountIn);
    
    if (quote) {
      const gasCostUsd = calculateGasCost(chain);
      const outputAmount = parseFloat(quote.outputAmount) / Math.pow(10, tokenOutInfo.decimals);
      const inputAmount = parseFloat(amountIn) / Math.pow(10, tokenInInfo.decimals);
      
      quotes.push({
        chain,
        input_token: tokenInInfo.symbol,
        output_token: tokenOutInfo.symbol,
        input_amount: inputAmount,
        output_amount: outputAmount,
        price_impact: quote.price,
        gas_cost_usd: Math.round(gasCostUsd * 100) / 100,
        aggregator: '0x'
      });
    }
  }

  // Find best and compare
  if (quotes.length < 2) {
    return c.json({
      run_id: crypto.randomUUID(),
      status: 'completed',
      output: {
        message: 'Insufficient quotes for arbitrage comparison',
        quotes,
        best_route: null,
        alt_routes: []
      },
      usage: { total_tokens: 100 }
    });
  }

  // Sort by output amount (descending)
  quotes.sort((a, b) => b.output_amount - a.output_amount);

  const bestQuote = quotes[0];
  const worstQuote = quotes[quotes.length - 1];

  // Calculate spread
  const spreadBps = ((bestQuote.output_amount - worstQuote.output_amount) / worstQuote.output_amount) * 10000;
  const netSpreadBps = spreadBps - ((bestQuote.gas_cost_usd + worstQuote.gas_cost_usd) / bestQuote.input_amount * 10000);

  // Build arbitrage route
  const arbitrageRoutes = [];
  
  if (netSpreadBps >= minSpreadBps) {
    arbitrageRoutes.push({
      buy_chain: worstQuote.chain,
      sell_chain: bestQuote.chain,
      token_pair: `${bestQuote.input_token}/${bestQuote.output_token}`,
      gross_spread_bps: Math.round(spreadBps * 100) / 100,
      net_spread_bps: Math.round(netSpreadBps * 100) / 100,
      est_profit_usd: Math.round((netSpreadBps / 10000) * bestQuote.input_amount * 100) / 100,
      total_gas_cost_usd: bestQuote.gas_cost_usd + worstQuote.gas_cost_usd,
      profitable: true
    });
  }

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      best_route: arbitrageRoutes.length > 0 ? arbitrageRoutes[0] : null,
      alt_routes: arbitrageRoutes.slice(1),
      quotes_by_chain: quotes,
      net_spread_bps: Math.round(netSpreadBps * 100) / 100,
      est_fill_cost: bestQuote.gas_cost_usd,
      spread_threshold_met: netSpreadBps >= minSpreadBps
    },
    usage: { total_tokens: JSON.stringify(quotes).length }
  });
});

// Get single quote
app.post('/entrypoints/get_quote/invoke', async (c) => {
  const body = await c.req.json();
  const chain = body.chain || body.input?.chain || 'ethereum';
  const tokenIn = body.token_in || body.input?.token_in || 'USDC';
  const tokenOut = body.token_out || body.input?.token_out || 'WETH';
  const amountIn = body.amount_in || body.input?.amount_in || '1000000000';

  const tokens = COMMON_TOKENS[chain];
  if (!tokens) {
    return c.json({ error: 'Unsupported chain' }, 400);
  }

  const tokenInInfo = tokens[tokenIn.toUpperCase()];
  const tokenOutInfo = tokens[tokenOut.toUpperCase()];

  if (!tokenInInfo || !tokenOutInfo) {
    return c.json({ error: 'Token not found' }, 400);
  }

  const chainId = AGGREGATOR_APIS['0x'].chains[chain as keyof typeof AGGREGATOR_APIS['0x']['chains']];
  const quote = await get0xQuote(chainId, tokenInInfo.address, tokenOutInfo.address, amountIn);

  if (!quote) {
    return c.json({ error: 'Failed to get quote' }, 500);
  }

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      chain,
      token_in: tokenInInfo.symbol,
      token_out: tokenOutInfo.symbol,
      input_amount: parseFloat(amountIn) / Math.pow(10, tokenInInfo.decimals),
      output_amount: parseFloat(quote.outputAmount) / Math.pow(10, tokenOutInfo.decimals),
      price: quote.price,
      gas_cost_usd: calculateGasCost(chain)
    },
    usage: { total_tokens: 100 }
  });
});

// Supported chains
app.post('/entrypoints/supported_chains/invoke', async (c) => {
  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      chains: Object.keys(AGGREGATOR_APIS['0x'].chains),
      common_tokens: Object.entries(COMMON_TOKENS).map(([chain, tokens]) => ({
        chain,
        tokens: Object.values(tokens).map(t => t.symbol)
      }))
    },
    usage: { total_tokens: 100 }
  });
});

// Echo endpoint
app.post('/entrypoints/echo/invoke', async (c) => {
  const body = await c.req.json();
  const text = body.text || body.input?.text || 'Cross DEX Arbitrage Alert v2 is operational';

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      text,
      timestamp: new Date().toISOString(),
      supported_chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche']
    },
    usage: { total_tokens: text.length }
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head><title>Cross DEX Arbitrage Alert v2</title></head>
    <body>
      <h1>Cross DEX Arbitrage Alert v2</h1>
      <p>Detect cross-DEX token price spreads for arbitrage opportunities.</p>
      <h2>Entrypoints</h2>
      <ul>
        <li><code>POST /entrypoints/find_arbitrage/invoke</code> - Find arbitrage opportunities</li>
        <li><code>POST /entrypoints/get_quote/invoke</code> - Get DEX quote</li>
        <li><code>POST /entrypoints/supported_chains/invoke</code> - List supported chains</li>
        <li><code>POST /entrypoints/echo/invoke</code> - Health check</li>
      </ul>
      <h2>Supported Chains</h2>
      <ul>
        <li>Ethereum</li>
        <li>Polygon</li>
        <li>Arbitrum</li>
        <li>Optimism</li>
        <li>Base</li>
        <li>BSC</li>
        <li>Avalanche</li>
      </ul>
    </body>
    </html>
  `);
});

export default app;