import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

// A basic factory ABI to decode PairCreated events (Uniswap V2)
const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "1.0.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

addEntrypoint({
  key: "fresh_markets",
  description: "List new AMM pairs or pools in the last N minutes",
  input: z.object({
    chain: z.string(),
    factories: z.array(z.string()),
    window_minutes: z.number()
  }),
  async handler({ input }) {
    // Determine RPC URL based on chain
    let rpcUrl = "https://cloudflare-eth.com";
    if (input.chain.toLowerCase() === "polygon") rpcUrl = "https://polygon-rpc.com";
    if (input.chain.toLowerCase() === "arbitrum") rpcUrl = "https://arb1.arbitrum.io/rpc";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Calculate block range
    const currentBlockNumber = await provider.getBlockNumber();
    const blocksPerMinute = input.chain.toLowerCase() === "polygon" ? 30 : 5; // Approximation
    const startBlock = currentBlockNumber - (input.window_minutes * blocksPerMinute);

    const pairs = [];
    
    for (const factoryAddress of input.factories) {
      const contract = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
      
      const filter = contract.filters.PairCreated();
      const logs = await contract.queryFilter(filter, startBlock, currentBlockNumber);
      
      for (const log of logs) {
        if ('args' in log) {
          pairs.push({
            pair_address: log.args.pair,
            tokens: [log.args.token0, log.args.token1],
            init_liquidity: "0", // Liquidity typically added in a separate transaction
            top_holders: [],     // Would require further indexing to track LP tokens
            created_at: new Date().toISOString()
          });
        }
      }
    }

    return {
      output: { pairs },
      usage: { total_tokens: pairs.length }
    };
  }
});

export default app;
