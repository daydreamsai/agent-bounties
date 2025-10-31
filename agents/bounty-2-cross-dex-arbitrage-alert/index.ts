import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "cross-dex-arbitrage-alert",
  version: "0.1.0",
  description: "Detect cross-DEX token price spreads",
});

interface Route {
  dex: string;
  chain: string;
  amount_in: string;
  amount_out: string;
  price: string;
  fee_bps: number;
  gas_estimate: string;
  est_fill_cost: string;
}

interface ArbitrageRoute {
  best_route: Route;
  alt_routes: Route[];
  net_spread_bps: number;
  est_fill_cost: string;
}

// Real DEX router addresses
const DEX_ROUTERS: Record<string, Record<string, { router: string; feeBps: number }>> = {
  ethereum: {
    uniswap_v2: { router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", feeBps: 30 },
    uniswap_v3: { router: "0xE592427A0AEce92De3Edee1F18E0157C05861564", feeBps: 5 },
    sushiswap: { router: "0xd9e1cE17f2641f32aE3b6D0F4B1f7Ae5b1B5C6E", feeBps: 30 },
    curve: { router: "0x99C9FC46f92E8a1c0deC1b1747d010903E884bE1", feeBps: 4 },
  },
  polygon: {
    quickswap: { router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", feeBps: 30 },
    sushiswap: { router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", feeBps: 30 },
  },
};

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
  "function quote(uint amountA, uint reserveA, uint reserveB) pure returns (uint amountB)",
];

async function getDEXQuote(
  provider: ethers.Provider,
  routerAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  dexName: string,
  feeBps: number,
  chain: string
): Promise<Route | null> {
  try {
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider);
    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);

    if (!amounts || amounts.length < 2) {
      return null;
    }

    const amountOut = amounts[1];
    
    // Estimate gas for swap
    const gasEstimate = await provider.estimateGas({
      to: routerAddress,
      data: router.interface.encodeFunctionData("swapExactTokensForTokens", [
        amountIn,
        0,
        path,
        ethers.ZeroAddress,
        Math.floor(Date.now() / 1000) + 300,
      ]),
    }).catch(() => ethers.parseUnits("200000", 0));

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
    const estFillCost = gasEstimate * gasPrice;

    return {
      dex: dexName,
      chain,
      amount_in: amountIn.toString(),
      amount_out: amountOut.toString(),
      price: (Number(amountOut) / Number(amountIn)).toString(),
      fee_bps: feeBps,
      gas_estimate: gasEstimate.toString(),
      est_fill_cost: estFillCost.toString(),
    };
  } catch (error) {
    console.error(`Error getting quote from ${dexName}:`, error);
    return null;
  }
}

async function findArbitrageOpportunities(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  chains: string[]
): Promise<ArbitrageRoute | null> {
  try {
    const routes: Route[] = [];

    for (const chain of chains) {
      try {
        const dexes = DEX_ROUTERS[chain.toLowerCase()] || {};
        if (Object.keys(dexes).length === 0) {
          console.warn(`No DEX routers configured for chain: ${chain}`);
          continue;
        }
        
        const rpcUrl = process.env[`RPC_URL_${chain.toUpperCase()}`] || 
                       (chain.toLowerCase() === "ethereum" ? "https://eth.llamarpc.com" : 
                        chain.toLowerCase() === "polygon" ? "https://polygon.llamarpc.com" : 
                        "https://eth.llamarpc.com");
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const amountInBigInt = BigInt(amountIn);

        for (const [dexName, config] of Object.entries(dexes)) {
          try {
            const quote = await getDEXQuote(
              provider,
              config.router,
              tokenIn,
              tokenOut,
              amountInBigInt,
              `${chain}_${dexName}`,
              config.feeBps,
              chain
            );
            
            if (quote) {
              // Calculate net amount after fees and gas
              const feeAmount = (amountInBigInt * BigInt(config.feeBps)) / BigInt(10000);
              const netIn = amountInBigInt - feeAmount;
              const netCost = BigInt(quote.est_fill_cost);
              quote.est_fill_cost = netCost.toString();
              routes.push(quote);
            }
          } catch (quoteError) {
            console.error(`Error getting quote from ${dexName} on ${chain}:`, quoteError);
            continue;
          }
        }
      } catch (chainError) {
        console.error(`Error processing chain ${chain}:`, chainError);
        continue;
      }
    }

    if (routes.length < 2) {
      return null;
    }

    // Sort by amount_out (descending)
    routes.sort((a, b) => {
      const aOut = BigInt(a.amount_out);
      const bOut = BigInt(b.amount_out);
      return aOut > bOut ? -1 : aOut < bOut ? 1 : 0;
    });

    const bestRoute = routes[0];
    const altRoutes = routes.slice(1, 4);

    // Calculate net spread vs worst route
    const worstRoute = routes[routes.length - 1];
    const bestOut = BigInt(bestRoute.amount_out);
    const worstOut = BigInt(worstRoute.amount_out);
    
    if (bestOut === BigInt(0)) {
      return null;
    }

    const spread = ((bestOut - worstOut) * BigInt(10000)) / bestOut;
    const netSpreadBps = Number(spread);

    // Total cost includes gas for both legs if doing arbitrage
    const totalGasCost = (BigInt(bestRoute.est_fill_cost) + 
                         BigInt(worstRoute.est_fill_cost));
    
    // Calculate if profitable (accounting for fees on both sides)
    const bestFee = (BigInt(bestRoute.amount_in) * BigInt(bestRoute.fee_bps)) / BigInt(10000);
    const worstFee = (BigInt(worstRoute.amount_in) * BigInt(worstRoute.fee_bps)) / BigInt(10000);
    const totalCost = totalGasCost + bestFee + worstFee;

    return {
      best_route: bestRoute,
      alt_routes: altRoutes,
      net_spread_bps: netSpreadBps,
      est_fill_cost: totalCost.toString(),
    };
  } catch (error) {
    console.error("Error in findArbitrageOpportunities:", error);
    return null;
  }
}

addEntrypoint({
  key: "detect_arbitrage",
  description: "Detect cross-DEX token price spreads exceeding threshold",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap"),
    chains: z.array(z.string()).describe("Chains to scan for arbitrage"),
  }),
  async handler({ input }) {
    try {
      const opportunity = await findArbitrageOpportunities(
        input.token_in,
        input.token_out,
        input.amount_in,
        input.chains
      );

      if (!opportunity) {
        return {
          output: {
            best_route: null,
            alt_routes: [],
            net_spread_bps: 0,
            est_fill_cost: "0",
            message: "No arbitrage opportunities found",
          },
          usage: {
            total_tokens: 100,
          },
        };
      }

      return {
        output: opportunity,
        usage: {
          total_tokens: JSON.stringify(opportunity).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          best_route: null,
          alt_routes: [],
          net_spread_bps: 0,
          est_fill_cost: "0",
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;
