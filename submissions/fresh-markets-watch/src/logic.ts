import {
  createPublicClient,
  http,
  parseAbiItem,
  type PublicClient,
  type Chain,
  type Address,
  formatUnits,
} from "viem";
import { mainnet, base, arbitrum, polygon, optimism, bsc } from "viem/chains";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
}

interface PairInfo {
  pair_address: string;
  tokens: TokenInfo[];
  init_liquidity: string;
  init_liquidity_usd: string;
  dex: string;
  created_at: string;
  block_number: number;
}

interface ScanResult {
  pairs: PairInfo[];
  chain: string;
  window_minutes: number;
  scanned_factories: number;
  queried_at: string;
}

interface ScanInput {
  chain: string;
  factories?: string[];
  window_minutes: number;
}

// ---------------------------------------------------------------------------
// Chain configuration
// ---------------------------------------------------------------------------

interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  dexScreenerChainId: string;
  avgBlockTimeSeconds: number;
  defaultFactories: { address: Address; dex: string }[];
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    chain: mainnet,
    rpcUrl: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    dexScreenerChainId: "ethereum",
    avgBlockTimeSeconds: 12,
    defaultFactories: [
      { address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", dex: "Uniswap V2" },
      { address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac", dex: "SushiSwap" },
    ],
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
    dexScreenerChainId: "base",
    avgBlockTimeSeconds: 2,
    defaultFactories: [
      { address: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", dex: "BaseSwap" },
      { address: "0x04C9f118d21e8B767D2e50C946f0cC9F6C367300", dex: "Aerodrome" },
    ],
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: process.env.ARB_RPC_URL || "https://arbitrum.llamarpc.com",
    dexScreenerChainId: "arbitrum",
    avgBlockTimeSeconds: 0.25,
    defaultFactories: [
      { address: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", dex: "SushiSwap" },
      { address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", dex: "Uniswap V3" },
    ],
  },
  polygon: {
    chain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
    dexScreenerChainId: "polygon",
    avgBlockTimeSeconds: 2,
    defaultFactories: [
      { address: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32", dex: "QuickSwap" },
      { address: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", dex: "SushiSwap" },
    ],
  },
  optimism: {
    chain: optimism,
    rpcUrl: process.env.OP_RPC_URL || "https://optimism.llamarpc.com",
    dexScreenerChainId: "optimism",
    avgBlockTimeSeconds: 2,
    defaultFactories: [
      { address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", dex: "Uniswap V3" },
    ],
  },
  bsc: {
    chain: bsc,
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc.llamarpc.com",
    dexScreenerChainId: "bsc",
    avgBlockTimeSeconds: 3,
    defaultFactories: [
      { address: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", dex: "PancakeSwap V2" },
      { address: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865", dex: "PancakeSwap V3" },
    ],
  },
};

// ---------------------------------------------------------------------------
// ABI fragments
// ---------------------------------------------------------------------------

const PAIR_CREATED_EVENT = parseAbiItem(
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
);

const ERC20_SYMBOL_ABI = parseAbiItem("function symbol() view returns (string)");
const ERC20_NAME_ABI = parseAbiItem("function name() view returns (string)");
const ERC20_DECIMALS_ABI = parseAbiItem("function decimals() view returns (uint8)");
const ERC20_BALANCE_ABI = parseAbiItem(
  "function balanceOf(address account) view returns (uint256)"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function fetchTokenInfo(
  client: PublicClient,
  tokenAddress: Address
): Promise<TokenInfo> {
  const [symbol, name] = await Promise.all([
    safeCall(
      () =>
        client.readContract({
          address: tokenAddress,
          abi: [ERC20_SYMBOL_ABI],
          functionName: "symbol",
        }) as Promise<string>,
      "UNKNOWN"
    ),
    safeCall(
      () =>
        client.readContract({
          address: tokenAddress,
          abi: [ERC20_NAME_ABI],
          functionName: "name",
        }) as Promise<string>,
      "Unknown Token"
    ),
  ]);

  return { address: tokenAddress, symbol, name };
}

async function fetchPairLiquidity(
  client: PublicClient,
  pairAddress: Address,
  token0: Address,
  token1: Address
): Promise<{ liquidity: string; decimals0: number; decimals1: number }> {
  const [balance0, balance1, decimals0, decimals1] = await Promise.all([
    safeCall(
      () =>
        client.readContract({
          address: token0,
          abi: [ERC20_BALANCE_ABI],
          functionName: "balanceOf",
          args: [pairAddress],
        }) as Promise<bigint>,
      0n
    ),
    safeCall(
      () =>
        client.readContract({
          address: token1,
          abi: [ERC20_BALANCE_ABI],
          functionName: "balanceOf",
          args: [pairAddress],
        }) as Promise<bigint>,
      0n
    ),
    safeCall(
      () =>
        client.readContract({
          address: token0,
          abi: [ERC20_DECIMALS_ABI],
          functionName: "decimals",
        }) as Promise<number>,
      18
    ),
    safeCall(
      () =>
        client.readContract({
          address: token1,
          abi: [ERC20_DECIMALS_ABI],
          functionName: "decimals",
        }) as Promise<number>,
      18
    ),
  ]);

  const formatted0 = formatUnits(balance0, decimals0);
  const formatted1 = formatUnits(balance1, decimals1);
  return {
    liquidity: `${formatted0} / ${formatted1}`,
    decimals0,
    decimals1,
  };
}

function estimateBlocksForWindow(
  windowMinutes: number,
  avgBlockTimeSeconds: number
): bigint {
  const totalSeconds = windowMinutes * 60;
  return BigInt(Math.ceil(totalSeconds / avgBlockTimeSeconds));
}

// ---------------------------------------------------------------------------
// On-chain scanner: fetches PairCreated events from factory contracts
// ---------------------------------------------------------------------------

async function scanOnChainPairs(
  config: ChainConfig,
  factories: { address: Address; dex: string }[],
  windowMinutes: number
): Promise<PairInfo[]> {
  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  }) as PublicClient;

  const currentBlock = await client.getBlockNumber();
  const blocksToScan = estimateBlocksForWindow(
    windowMinutes,
    config.avgBlockTimeSeconds
  );

  // Cap at 10000 blocks to stay within RPC limits on free tiers
  const maxBlocks = 10000n;
  const effectiveBlocks = blocksToScan < maxBlocks ? blocksToScan : maxBlocks;
  const fromBlock = currentBlock - effectiveBlocks;

  const pairs: PairInfo[] = [];

  for (const factory of factories) {
    try {
      const logs = await client.getLogs({
        address: factory.address,
        event: PAIR_CREATED_EVENT,
        fromBlock,
        toBlock: currentBlock,
      });

      // Process logs in batches to avoid overwhelming the RPC
      const BATCH_SIZE = 5;
      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (log) => {
            const token0Addr = log.args.token0 as Address;
            const token1Addr = log.args.token1 as Address;
            const pairAddr = log.args.pair as Address;
            const blockNum = Number(log.blockNumber);

            // Fetch token info and block timestamp concurrently
            const [token0Info, token1Info, block] = await Promise.all([
              fetchTokenInfo(client, token0Addr),
              fetchTokenInfo(client, token1Addr),
              safeCall(
                () => client.getBlock({ blockNumber: log.blockNumber }),
                null
              ),
            ]);

            const createdAt = block
              ? new Date(Number(block.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            // Check if the pair is within our time window
            if (block) {
              const blockTime = Number(block.timestamp) * 1000;
              const cutoff = Date.now() - windowMinutes * 60 * 1000;
              if (blockTime < cutoff) {
                return null; // Outside window
              }
            }

            // Fetch initial liquidity
            const liquidityInfo = await fetchPairLiquidity(
              client,
              pairAddr,
              token0Addr,
              token1Addr
            );

            return {
              pair_address: pairAddr,
              tokens: [token0Info, token1Info],
              init_liquidity: liquidityInfo.liquidity,
              init_liquidity_usd: "N/A", // On-chain only; enriched by DexScreener if available
              dex: factory.dex,
              created_at: createdAt,
              block_number: blockNum,
            } satisfies PairInfo;
          })
        );

        for (const result of batchResults) {
          if (result !== null) {
            pairs.push(result);
          }
        }
      }
    } catch (err) {
      // Log but continue scanning other factories
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[fresh-markets-watch] Error scanning factory ${factory.address} (${factory.dex}): ${msg}`
      );
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// DexScreener API scanner: fetches latest token profiles/boosts
// ---------------------------------------------------------------------------

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  liquidity: { usd: number; base: number; quote: number };
  pairCreatedAt: number;
  fdv: number;
  volume: { h24: number };
}

interface DexScreenerBoostToken {
  tokenAddress: string;
  chainId: string;
  url: string;
  icon: string;
  description: string;
  links: { label: string; url: string }[];
}

async function fetchDexScreenerLatest(
  chainId: string,
  windowMinutes: number
): Promise<PairInfo[]> {
  const pairs: PairInfo[] = [];
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  try {
    // Fetch latest boosted tokens to discover new pairs
    const boostRes = await fetch(
      "https://api.dexscreener.com/token-boosts/latest/v1",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!boostRes.ok) {
      console.error(
        `[fresh-markets-watch] DexScreener boost API returned ${boostRes.status}`
      );
      return pairs;
    }

    const boostData: DexScreenerBoostToken[] = await boostRes.json();

    // Filter tokens matching our target chain
    const chainTokens = boostData.filter(
      (t) => t.chainId.toLowerCase() === chainId.toLowerCase()
    );

    if (chainTokens.length === 0) {
      return pairs;
    }

    // Query pair data for discovered token addresses (batch by 30 max per DexScreener)
    const tokenAddresses = [
      ...new Set(chainTokens.map((t) => t.tokenAddress)),
    ];

    // DexScreener allows up to 30 addresses per call
    const DEXSCREENER_BATCH = 30;
    for (let i = 0; i < tokenAddresses.length; i += DEXSCREENER_BATCH) {
      const batch = tokenAddresses.slice(i, i + DEXSCREENER_BATCH);
      const joined = batch.join(",");

      try {
        const pairRes = await fetch(
          `https://api.dexscreener.com/tokens/v1/${chainId}/${joined}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!pairRes.ok) {
          console.error(
            `[fresh-markets-watch] DexScreener pairs API returned ${pairRes.status}`
          );
          continue;
        }

        const pairData: DexScreenerPair[] = await pairRes.json();

        if (!Array.isArray(pairData)) {
          continue;
        }

        for (const p of pairData) {
          // Filter by creation time
          if (!p.pairCreatedAt || p.pairCreatedAt < cutoff) {
            continue;
          }

          // Avoid duplicates by pair address
          if (pairs.some((existing) => existing.pair_address.toLowerCase() === p.pairAddress.toLowerCase())) {
            continue;
          }

          pairs.push({
            pair_address: p.pairAddress,
            tokens: [
              {
                address: p.baseToken.address,
                symbol: p.baseToken.symbol,
                name: p.baseToken.name,
              },
              {
                address: p.quoteToken.address,
                symbol: p.quoteToken.symbol,
                name: p.quoteToken.name,
              },
            ],
            init_liquidity: p.liquidity
              ? `${p.liquidity.base} / ${p.liquidity.quote}`
              : "0",
            init_liquidity_usd: p.liquidity?.usd
              ? `$${p.liquidity.usd.toLocaleString()}`
              : "$0",
            dex: p.dexId,
            created_at: new Date(p.pairCreatedAt).toISOString(),
            block_number: 0, // Not available from DexScreener
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[fresh-markets-watch] DexScreener pair fetch error: ${msg}`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[fresh-markets-watch] DexScreener boost fetch error: ${msg}`
    );
  }

  // Also query the latest profiles endpoint as a supplementary source
  try {
    const profileRes = await fetch(
      "https://api.dexscreener.com/token-profiles/latest/v1",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (profileRes.ok) {
      const profiles: DexScreenerBoostToken[] = await profileRes.json();
      const chainProfiles = profiles.filter(
        (t) => t.chainId.toLowerCase() === chainId.toLowerCase()
      );

      const newAddresses = chainProfiles
        .map((t) => t.tokenAddress)
        .filter(
          (addr) =>
            !pairs.some((p) =>
              p.tokens.some(
                (t) => t.address.toLowerCase() === addr.toLowerCase()
              )
            )
        );

      if (newAddresses.length > 0) {
        const uniqueAddrs = [...new Set(newAddresses)];
        for (let i = 0; i < uniqueAddrs.length; i += DEXSCREENER_BATCH) {
          const batch = uniqueAddrs.slice(i, i + DEXSCREENER_BATCH);
          const joined = batch.join(",");

          try {
            const pairRes = await fetch(
              `https://api.dexscreener.com/tokens/v1/${chainId}/${joined}`,
              {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(15000),
              }
            );

            if (!pairRes.ok) continue;

            const pairData: DexScreenerPair[] = await pairRes.json();
            if (!Array.isArray(pairData)) continue;

            for (const p of pairData) {
              if (!p.pairCreatedAt || p.pairCreatedAt < cutoff) continue;
              if (pairs.some((existing) => existing.pair_address.toLowerCase() === p.pairAddress.toLowerCase())) continue;

              pairs.push({
                pair_address: p.pairAddress,
                tokens: [
                  {
                    address: p.baseToken.address,
                    symbol: p.baseToken.symbol,
                    name: p.baseToken.name,
                  },
                  {
                    address: p.quoteToken.address,
                    symbol: p.quoteToken.symbol,
                    name: p.quoteToken.name,
                  },
                ],
                init_liquidity: p.liquidity
                  ? `${p.liquidity.base} / ${p.liquidity.quote}`
                  : "0",
                init_liquidity_usd: p.liquidity?.usd
                  ? `$${p.liquidity.usd.toLocaleString()}`
                  : "$0",
                dex: p.dexId,
                created_at: new Date(p.pairCreatedAt).toISOString(),
                block_number: 0,
              });
            }
          } catch {
            // Continue on error
          }
        }
      }
    }
  } catch {
    // Supplementary source; non-fatal
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Enrichment: cross-reference on-chain pairs with DexScreener for USD values
// ---------------------------------------------------------------------------

async function enrichWithDexScreener(
  pairs: PairInfo[],
  chainId: string
): Promise<PairInfo[]> {
  const needsEnrichment = pairs.filter(
    (p) => p.init_liquidity_usd === "N/A" && p.pair_address
  );

  if (needsEnrichment.length === 0) return pairs;

  // Query DexScreener for pair data in batches
  const BATCH_SIZE = 30;
  for (let i = 0; i < needsEnrichment.length; i += BATCH_SIZE) {
    const batch = needsEnrichment.slice(i, i + BATCH_SIZE);
    const addresses = batch.map((p) => p.pair_address).join(",");

    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${addresses}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const dsPairs: DexScreenerPair[] = data.pairs || data || [];

      if (!Array.isArray(dsPairs)) continue;

      for (const dsP of dsPairs) {
        const match = pairs.find(
          (p) =>
            p.pair_address.toLowerCase() === dsP.pairAddress.toLowerCase()
        );
        if (match && dsP.liquidity?.usd) {
          match.init_liquidity_usd = `$${dsP.liquidity.usd.toLocaleString()}`;
        }
        // Also update token symbols/names if they were UNKNOWN
        if (match) {
          if (match.tokens[0]?.symbol === "UNKNOWN" && dsP.baseToken?.symbol) {
            match.tokens[0].symbol = dsP.baseToken.symbol;
            match.tokens[0].name = dsP.baseToken.name;
          }
          if (match.tokens[1]?.symbol === "UNKNOWN" && dsP.quoteToken?.symbol) {
            match.tokens[1].symbol = dsP.quoteToken.symbol;
            match.tokens[1].name = dsP.quoteToken.name;
          }
        }
      }
    } catch {
      // Non-fatal enrichment failure
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function scanNewPairs(input: ScanInput): Promise<ScanResult> {
  const chainKey = input.chain.toLowerCase();
  const config = CHAIN_CONFIGS[chainKey];

  if (!config) {
    return {
      pairs: [],
      chain: input.chain,
      window_minutes: input.window_minutes,
      scanned_factories: 0,
      queried_at: new Date().toISOString(),
    };
  }

  // Determine which factories to scan
  const factories: { address: Address; dex: string }[] = input.factories
    ? input.factories.map((addr) => ({
        address: addr as Address,
        dex: "Custom",
      }))
    : config.defaultFactories;

  // Run on-chain scan and DexScreener scan concurrently
  const [onChainPairs, dexScreenerPairs] = await Promise.all([
    scanOnChainPairs(config, factories, input.window_minutes).catch((err) => {
      console.error(
        `[fresh-markets-watch] On-chain scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [] as PairInfo[];
    }),
    fetchDexScreenerLatest(config.dexScreenerChainId, input.window_minutes).catch(
      (err) => {
        console.error(
          `[fresh-markets-watch] DexScreener scan failed: ${err instanceof Error ? err.message : String(err)}`
        );
        return [] as PairInfo[];
      }
    ),
  ]);

  // Merge results, deduplicating by pair address
  const seenAddresses = new Set<string>();
  const mergedPairs: PairInfo[] = [];

  // On-chain pairs take priority (have block numbers)
  for (const pair of onChainPairs) {
    const key = pair.pair_address.toLowerCase();
    if (!seenAddresses.has(key)) {
      seenAddresses.add(key);
      mergedPairs.push(pair);
    }
  }

  // Add DexScreener pairs that are not already present
  for (const pair of dexScreenerPairs) {
    const key = pair.pair_address.toLowerCase();
    if (!seenAddresses.has(key)) {
      seenAddresses.add(key);
      mergedPairs.push(pair);
    }
  }

  // Enrich on-chain pairs with USD liquidity data from DexScreener
  const enrichedPairs = await enrichWithDexScreener(
    mergedPairs,
    config.dexScreenerChainId
  );

  // Sort by creation time, newest first
  enrichedPairs.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return timeB - timeA;
  });

  return {
    pairs: enrichedPairs,
    chain: input.chain,
    window_minutes: input.window_minutes,
    scanned_factories: factories.length,
    queried_at: new Date().toISOString(),
  };
}
