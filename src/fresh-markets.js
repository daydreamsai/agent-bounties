import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, base, arbitrum, optimism, polygon, bsc } from "viem/chains";

const chains = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
};

const getClient = (chainName) => {
  const chain = chains[chainName.toLowerCase()];
  if (!chain) throw new Error(`Unsupported chain: ${chainName}`);
  return createPublicClient({
    chain,
    transport: http(),
  });
};

const UNISWAP_V2_FACTORY_ABI = parseAbiItem(
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
);

const UNISWAP_V3_FACTORY_ABI = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"
);

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes for discovery bots or yield scouts.",
});

addEntrypoint({
  key: "watch_markets",
  description: "List new AMM pairs or pools in the last N minutes",
  input: z.object({
    chain: z.string().describe("Target blockchain (e.g., 'ethereum', 'base')"),
    factories: z.array(z.string()).describe("AMM factory contracts to monitor"),
    window_minutes: z.number().describe("Time window to scan (minutes)"),
  }),
  async handler({ input }) {
    const client = getClient(input.chain);
    
    // Calculate block range
    // Assuming average block time of 12 seconds for Ethereum/EVM
    const blocksPerMinute = 5; 
    const blockWindow = Math.ceil(input.window_minutes * blocksPerMinute);
    
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock - BigInt(blockWindow);

    const results = [];

    for (const factory of input.factories) {
      try {
        // Try V2
        const v2Logs = await client.getLogs({
          address: factory,
          event: UNISWAP_V2_FACTORY_ABI,
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of v2Logs) {
          results.push({
            pair_address: log.args.pair,
            tokens: [log.args.token0, log.args.token1],
            type: "V2",
            factory: factory,
            created_at: Date.now(), // Approximate, ideally fetch block timestamp
            transactionHash: log.transactionHash,
          });
        }

        // Try V3
        const v3Logs = await client.getLogs({
          address: factory,
          event: UNISWAP_V3_FACTORY_ABI,
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of v3Logs) {
          results.push({
            pair_address: log.args.pool,
            tokens: [log.args.token0, log.args.token1],
            type: "V3",
            fee: log.args.fee,
            factory: factory,
            created_at: Date.now(), // Approximate
            transactionHash: log.transactionHash,
          });
        }
      } catch (e) {
        console.error(`Failed fetching logs for factory ${factory}:`, e);
      }
    }

    return {
      output: {
        chain: input.chain,
        window_minutes: input.window_minutes,
        new_pairs: results,
      },
      usage: { total_tokens: 150 },
    };
  },
});

export default app;