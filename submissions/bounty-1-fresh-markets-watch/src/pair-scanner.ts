import { createPublicClient, http, type Address, parseAbiItem } from "viem";
import { base } from "viem/chains";

type NewPair = {
  pair_address: string;
  tokens: string[];
  factory: string;
  factory_name: string;
  created_at: string;
  block_number: number;
};

// Known AMM factories on Base
const DEFAULT_FACTORIES: Record<string, { address: Address; name: string; event: string }> = {
  uniswap_v3: {
    address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    name: "Uniswap V3",
    event: "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
  },
  uniswap_v2: {
    address: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    name: "Uniswap V2",
    event: "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
  },
  aerodrome: {
    address: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    name: "Aerodrome",
    event: "event PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256)",
  },
};

function getClient() {
  return createPublicClient({ chain: base, transport: http("https://1rpc.io/base") });
}

export async function scanNewPairs(
  chain: string,
  windowMinutes: number,
  factoryAddresses?: string[]
): Promise<NewPair[]> {
  if (chain !== "base") return []; // Only Base supported for now

  const client = getClient();
  const latest = await client.getBlockNumber();
  
  // Base ~2s blocks, so blocks in window
  const blocksInWindow = BigInt(Math.ceil((windowMinutes * 60) / 2));
  const fromBlock = latest - blocksInWindow;

  const pairs: NewPair[] = [];

  // Determine which factories to scan
  const factories = factoryAddresses
    ? Object.entries(DEFAULT_FACTORIES).filter(([, f]) =>
        factoryAddresses.some((a) => a.toLowerCase() === f.address.toLowerCase())
      )
    : Object.entries(DEFAULT_FACTORIES);

  for (const [key, factory] of factories) {
    try {
      const eventAbi = parseAbiItem(factory.event);
      const logs = await client.getLogs({
        address: factory.address,
        event: eventAbi as any,
        fromBlock,
        toBlock: latest,
      });

      for (const log of logs) {
        const args = log.args as any;
        const pairAddress = args.pool || args.pair || "";
        const token0 = args.token0 || "";
        const token1 = args.token1 || "";

        // Get block timestamp
        let createdAt = new Date().toISOString();
        try {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          createdAt = new Date(Number(block.timestamp) * 1000).toISOString();
        } catch {}

        pairs.push({
          pair_address: pairAddress,
          tokens: [token0, token1],
          factory: factory.address,
          factory_name: factory.name,
          created_at: createdAt,
          block_number: Number(log.blockNumber),
        });
      }
    } catch (e) {
      // Factory might not have events in this range
    }
  }

  // Sort by block number descending (newest first)
  pairs.sort((a, b) => b.block_number - a.block_number);
  return pairs;
}
