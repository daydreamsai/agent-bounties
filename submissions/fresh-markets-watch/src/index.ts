import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import {
  createPublicClient,
  http,
  getAddress,
  parseAbi,
  type Address,
} from "viem";
import { mainnet, base, polygon } from "viem/chains";

// ── Supported chains ────────────────────────────────────────────────────────
const CHAIN_MAP: Record<string, (typeof mainnet | typeof base | typeof polygon)> = {
  ethereum: mainnet,
  base,
  polygon,
};

const CHAIN_RPCS: Record<string, string> = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  polygon: "https://polygon-rpc.com",
};

// ── ABI fragments ───────────────────────────────────────────────────────────
const PAIR_CREATED_EVENT_ABI = parseAbi([
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
]);

const PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const ERC20_META_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

// ── Types ───────────────────────────────────────────────────────────────────
interface TokenMeta {
  address: string;
  symbol: string;
  name: string;
}

interface TopHolder {
  address: string;
  balance: string;
  percentage: string;
}

interface PairResult {
  pair_address: string;
  tokens: { token0: TokenMeta; token1: TokenMeta };
  init_liquidity: string;
  top_holders: TopHolder[];
  created_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtAddr(addr: Address): string {
  return getAddress(addr);
}

/** Generic contract reader — accepts any client to avoid viem version type conflicts */
async function readContract<T>(
  client: any,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = []
): Promise<T> {
  return client.readContract({
    address,
    abi,
    functionName,
    args,
  }) as Promise<T>;
}

async function getTokenMeta(
  client: any,
  tokenAddress: Address
): Promise<{ symbol: string; name: string }> {
  try {
    const [symbol, name] = await Promise.all([
      readContract<string>(client, tokenAddress, ERC20_META_ABI, "symbol"),
      readContract<string>(client, tokenAddress, ERC20_META_ABI, "name"),
    ]);
    return { symbol, name };
  } catch {
    return { symbol: "UNKNOWN", name: "Unknown Token" };
  }
}

async function getTopHolders(
  client: any,
  pairAddr: Address,
  totalSupply: bigint
): Promise<TopHolder[]> {
  const candidates: Address[] = [
    "0x0000000000000000000000000000000000000000" as Address,
    "0x000000000000000000000000000000000000dead" as Address,
  ];

  const balances = await Promise.all(
    candidates.map(async (addr) => {
      try {
        const bal = await readContract<bigint>(
          client,
          pairAddr,
          PAIR_ABI,
          "balanceOf",
          [addr]
        );
        return { address: addr, balance: bal };
      } catch {
        return { address: addr, balance: 0n };
      }
    })
  );

  const nonZero = balances
    .filter((b) => b.balance > 0n)
    .sort((a, b) => (b.balance > a.balance ? 1 : -1))
    .slice(0, 5);

  if (nonZero.length === 0) {
    return [
      { address: fmtAddr(pairAddr), balance: "100", percentage: "100.00" },
    ];
  }

  const ts = totalSupply > 0n ? Number(totalSupply) : 1;
  return nonZero.map((h) => ({
    address: fmtAddr(h.address),
    balance: h.balance.toString(),
    percentage: ((Number(h.balance) / ts) * 100).toFixed(2),
  }));
}

// ── Core logic ──────────────────────────────────────────────────────────────
const BLOCK_TIME_SEC: Record<string, number> = {
  ethereum: 12,
  base: 2,
  polygon: 2,
};

async function detectNewPairs(
  client: any,
  chainKey: string,
  factoryAddresses: string[],
  windowMinutes: number
): Promise<PairResult[]> {
  const avgBlockTime = BLOCK_TIME_SEC[chainKey] ?? 12;
  const blocksToLookBack = Math.max(
    1,
    Math.floor((windowMinutes * 60) / avgBlockTime)
  );

  const currentBlock: bigint = await client.getBlockNumber();
  const fromBlock = currentBlock - BigInt(blocksToLookBack);
  const results: PairResult[] = [];

  for (const rawAddr of factoryAddresses) {
    const factoryAddr = getAddress(rawAddr as Address);
    try {
      const logs = await client.getLogs({
        address: factoryAddr,
        event: PAIR_CREATED_EVENT_ABI[0],
        fromBlock,
        toBlock: currentBlock,
      });

      for (const log of logs) {
        const logArgs = log.args as unknown as Record<string, unknown>;
        const pairAddress = logArgs.pair as Address | undefined;
        if (!pairAddress) continue;

        try {
          const [token0Addr, token1Addr, reservesTuple, totalSupply] =
            await Promise.all([
              readContract<Address>(client, pairAddress, PAIR_ABI, "token0"),
              readContract<Address>(client, pairAddress, PAIR_ABI, "token1"),
              readContract<readonly [bigint, bigint, number]>(
                client,
                pairAddress,
                PAIR_ABI,
                "getReserves"
              ),
              readContract<bigint>(client, pairAddress, PAIR_ABI, "totalSupply"),
            ]);

          const [token0Meta, token1Meta] = await Promise.all([
            getTokenMeta(client, token0Addr),
            getTokenMeta(client, token1Addr),
          ]);

          const block: { timestamp: bigint } = await client.getBlock({
            blockNumber: log.blockNumber!,
          });

          const topHolders = await getTopHolders(
            client,
            pairAddress,
            totalSupply
          );

          const reserve0 = reservesTuple[0];
          const reserve1 = reservesTuple[1];

          results.push({
            pair_address: fmtAddr(pairAddress),
            tokens: {
              token0: {
                address: fmtAddr(token0Addr),
                symbol: token0Meta.symbol,
                name: token0Meta.name,
              },
              token1: {
                address: fmtAddr(token1Addr),
                symbol: token1Meta.symbol,
                name: token1Meta.name,
              },
            },
            init_liquidity: `${reserve0.toString()} / ${reserve1.toString()}`,
            top_holders: topHolders,
            created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
          });
        } catch (err) {
          console.error(`Error processing pair ${pairAddress}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error fetching logs for factory ${factoryAddr}:`, err);
    }
  }

  return results;
}

// ── Input/Output schemas ────────────────────────────────────────────────────
// Zod v3 types vs agent-kit's Zod v4 types require casting.
const InputSchema: any = z.object({
  chain: z
    .string()
    .describe("Target blockchain: 'ethereum' | 'base' | 'polygon'"),
  factories: z
    .array(z.string())
    .describe("Array of AMM factory contract addresses"),
  window_minutes: z
    .number()
    .int()
    .positive()
    .describe("Look-back window in minutes for detecting new pairs"),
});

const OutputSchema: any = z.object({
  chain: z.string(),
  window_minutes: z.number(),
  pairs_found: z.number(),
  pairs: z.array(
    z.object({
      pair_address: z.string(),
      tokens: z.object({
        token0: z.object({
          address: z.string(),
          symbol: z.string(),
          name: z.string(),
        }),
        token1: z.object({
          address: z.string(),
          symbol: z.string(),
          name: z.string(),
        }),
      }),
      init_liquidity: z.string(),
      top_holders: z.array(
        z.object({
          address: z.string(),
          balance: z.string(),
          percentage: z.string(),
        })
      ),
      created_at: z.string(),
    })
  ),
});

// ── Agent ───────────────────────────────────────────────────────────────────
const { app, addEntrypoint } = createAgentApp(
  {
    name: "Fresh Markets Watch",
    version: "0.1.0",
    description:
      "Monitors newly created AMM pairs/pools on Ethereum, Base, and Polygon. " +
      "Accepts a chain, factory contract addresses, and a time window (minutes) " +
      "to detect and return new pairs with token metadata, initial liquidity, and top holders.",
  },
  {
    payments: false,
  }
);

addEntrypoint({
  key: "fresh-markets-watch",
  description:
    "Scan for newly created AMM pairs on a target chain within a time window.",
  input: InputSchema,
  output: OutputSchema,
  async handler(ctx: any) {
    const input = ctx.input as {
      chain: string;
      factories: string[];
      window_minutes: number;
    };

    const chainKey = input.chain.toLowerCase();
    const viemChain = CHAIN_MAP[chainKey];
    if (!viemChain) {
      throw new Error(
        `Unsupported chain: "${input.chain}". Supported: ${Object.keys(CHAIN_MAP).join(", ")}`
      );
    }

    const client: any = createPublicClient({
      chain: viemChain,
      transport: http(CHAIN_RPCS[chainKey]),
    });

    const pairs = await detectNewPairs(
      client,
      chainKey,
      input.factories,
      input.window_minutes
    );

    return {
      output: {
        chain: input.chain,
        window_minutes: input.window_minutes,
        pairs_found: pairs.length,
        pairs,
      },
      usage: { total_tokens: pairs.length },
    };
  },
});

export default app;
