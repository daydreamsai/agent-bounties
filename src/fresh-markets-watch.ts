#!/usr/bin/env bun

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

const UNISWAP_V2_FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
];

const UNISWAP_V3_FACTORY_ABI = [
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

interface NewPair {
  pair_address: string;
  tokens: { address: string; symbol: string }[];
  init_liquidity: string;
  top_holders: string[];
  created_at: string;
}

async function fetchNewPairsV2(
  provider: ethers.Provider,
  factoryAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<NewPair[]> {
  const factory = new ethers.Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);
  
  const filter = factory.filters.PairCreated();
  const events = await factory.queryFilter(filter, fromBlock, toBlock);
  
  const pairs: NewPair[] = [];
  
  for (const event of events) {
    if (!("args" in event)) continue;
    
    const { token0, token1, pair } = event.args;
    
    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
    const pairContract = new ethers.Contract(pair, PAIR_ABI, provider);
    
    const [symbol0, symbol1, reserves] = await Promise.all([
      token0Contract.symbol().catch(() => "UNKNOWN"),
      token1Contract.symbol().catch(() => "UNKNOWN"),
      pairContract.getReserves(),
    ]);
    
    const initLiquidity = reserves[0].toString();
    
    pairs.push({
      pair_address: pair,
      tokens: [
        { address: token0, symbol: symbol0 },
        { address: token1, symbol: symbol1 },
      ],
      init_liquidity: initLiquidity,
      top_holders: [],
      created_at: new Date().toISOString(),
    });
  }
  
  return pairs;
}

async function fetchNewPoolsV3(
  provider: ethers.Provider,
  factoryAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<NewPair[]> {
  const factory = new ethers.Contract(factoryAddress, UNISWAP_V3_FACTORY_ABI, provider);
  
  const filter = factory.filters.PoolCreated();
  const events = await factory.queryFilter(filter, fromBlock, toBlock);
  
  const pools: NewPair[] = [];
  
  for (const event of events) {
    if (!("args" in event)) continue;
    
    const { token0, token1, pool } = event.args;
    
    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
    
    const [symbol0, symbol1] = await Promise.all([
      token0Contract.symbol().catch(() => "UNKNOWN"),
      token1Contract.symbol().catch(() => "UNKNOWN"),
    ]);
    
    pools.push({
      pair_address: pool,
      tokens: [
        { address: token0, symbol: symbol0 },
        { address: token1, symbol: symbol1 },
      ],
      init_liquidity: "0",
      top_holders: [],
      created_at: new Date().toISOString(),
    });
  }
  
  return pools;
}

addEntrypoint({
  key: "fresh-markets-watch",
  description: "List new AMM pairs or pools in the last few minutes",
  input: z.object({
    chain: z.string().describe("Target blockchain (e.g., 'ethereum', 'bsc', 'polygon')"),
    factories: z.array(z.string()).describe("AMM factory contracts to monitor"),
    window_minutes: z.number().default(5).describe("Time window to scan in minutes"),
  }),
  async handler({ input }) {
    const { chain, factories, window_minutes } = input;
    
    const rpcUrls: Record<string, string> = {
      ethereum: "https://eth.llamarpc.com",
      bsc: "https://bsc-dataseed.binance.org",
      polygon: "https://polygon-rpc.com",
      arbitrum: "https://arb1.arbitrum.io/rpc",
      optimism: "https://mainnet.optimism.io",
    };
    
    const rpcUrl = rpcUrls[chain.toLowerCase()];
    if (!rpcUrl) {
      return {
        output: { error: `Unsupported chain: ${chain}` },
        usage: { total_tokens: "0" },
      };
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    const blocksPerMinute = chain.toLowerCase() === "ethereum" ? 5 : 20;
    const fromBlock = currentBlock - (window_minutes * blocksPerMinute);
    
    const allPairs: NewPair[] = [];
    
    for (const factoryAddress of factories) {
      try {
        const [v2Pairs, v3Pools] = await Promise.all([
          fetchNewPairsV2(provider, factoryAddress, fromBlock, currentBlock),
          fetchNewPoolsV3(provider, factoryAddress, fromBlock, currentBlock),
        ]);
        
        allPairs.push(...v2Pairs, ...v3Pools);
      } catch (error) {
        console.error(`Error querying factory ${factoryAddress}:`, error);
      }
    }
    
    return {
      output: {
        chain,
        window_minutes,
        from_block: fromBlock,
        to_block: currentBlock,
        new_pairs: allPairs,
        total_found: allPairs.length,
      },
      usage: { total_tokens: String(allPairs.length * 100) },
    };
  },
});

export default app;
