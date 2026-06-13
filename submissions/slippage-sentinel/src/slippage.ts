import { createPublicClient, decodeEventLog, formatUnits, http, parseAbi, parseAbiItem } from 'viem';
import { chainConfigs, rpcUrlsFor } from './chains.js';
import { slippageInputSchema, type PoolDepth, type SlippageInput, type SlippageOutput, type SupportedChain, type TradeSample } from './types.js';

const GECKO_NETWORKS: Record<SupportedChain, string> = {
  ethereum: 'eth',
  base: 'base',
  polygon: 'polygon_pos',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  bsc: 'bsc',
  avalanche: 'avax'
};

interface GeckoPool {
  id: string;
  attributes?: {
    address?: string;
    name?: string;
    pool_name?: string;
    reserve_in_usd?: string;
    volume_usd?: Record<string, string>;
    price_change_percentage?: Record<string, string>;
    pool_fee_percentage?: string | null;
  };
  relationships?: { dex?: { data?: { id?: string } } };
}

interface GeckoTrade {
  attributes?: {
    block_number?: number;
    tx_hash?: string;
    block_timestamp?: string;
    kind?: string;
    volume_in_usd?: string;
  };
}

const POOL_ABI = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
]);

const ERC20_ABI = parseAbi(['function decimals() view returns (uint8)', 'function symbol() view returns (string)']);
const SWAP_EVENT = parseAbiItem('event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)');

const STABLECOINS: Partial<Record<SupportedChain, Set<string>>> = {
  ethereum: new Set(['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0xdac17f958d2ee523a2206206994597c13d831ec7', '0x6b175474e89094c44da98b954eedeac495271d0f']),
  base: new Set(['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2']),
  polygon: new Set(['0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', '0x2791bca1f2de4661ed88a30c99a7a9449aa84174']),
  arbitrum: new Set(['0xaf88d065e77c8cc2239327c5edb3a432268e5831', '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8']),
  optimism: new Set(['0x0b2c639c533813f4aa9d7837caf62653d097ff85', '0x7f5c764cbc14f9669b88837ca1490cca17c31607']),
  bsc: new Set(['0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', '0x55d398326f99059ff775485246999027b3197955']),
  avalanche: new Set(['0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'])
};

const KNOWN_TOKENS: Record<string, { decimals: number; symbol: string }> = {
  '0x4200000000000000000000000000000000000006': { decimals: 18, symbol: 'WETH' },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { decimals: 6, symbol: 'USDC' },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { decimals: 6, symbol: 'USDC' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { decimals: 6, symbol: 'USDT' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { decimals: 18, symbol: 'DAI' },
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { decimals: 6, symbol: 'USDC' },
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { decimals: 6, symbol: 'USDC' },
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': { decimals: 6, symbol: 'USDC' }
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function percentile(values: number[], p: number): number | null {
  const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (filtered.length === 0) return null;
  const idx = Math.min(filtered.length - 1, Math.max(0, Math.ceil((p / 100) * filtered.length) - 1));
  return filtered[idx];
}

export function estimatePriceImpactBps(amountUsd: number, reserveUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !Number.isFinite(reserveUsd) || reserveUsd <= 0) return 10000;
  // Constant-product approximation for small swaps: amount / effective side liquidity.
  const sideReserveUsd = reserveUsd / 2;
  return Math.ceil((amountUsd / (sideReserveUsd + amountUsd)) * 10000);
}

export function deriveSafeSlippageBps(args: {
  impactBps: number;
  feeBps: number | null;
  volatility1hPct: number | null;
  recentTradeP95Usd: number | null;
  amountUsd: number;
}): number {
  const feeBps = args.feeBps ?? 30;
  const volatilityBuffer = args.volatility1hPct === null ? 20 : Math.ceil(Math.abs(args.volatility1hPct) * 100 * 0.35);
  const flowBuffer = args.recentTradeP95Usd && args.amountUsd > 0 ? Math.ceil(Math.min(250, (args.recentTradeP95Usd / args.amountUsd) * 8)) : 20;
  const recommendation = args.impactBps + feeBps + volatilityBuffer + flowBuffer + 10;
  return Math.max(5, Math.min(3000, recommendation));
}

function parseAmountInUsd(input: SlippageInput, pool: GeckoPool): number {
  const rawAmount = Number(input.amount_in);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error('amount_in must be a positive decimal string or number');

  const attrs = pool.attributes ?? {};
  const basePrice = numberOrNull((attrs as { base_token_price_usd?: string }).base_token_price_usd);
  const quotePrice = numberOrNull((attrs as { quote_token_price_usd?: string }).quote_token_price_usd);
  const poolName = `${attrs.name ?? attrs.pool_name ?? ''}`.toLowerCase();
  const tokenIn = input.token_in.toLowerCase();

  // GeckoTerminal pool names do not always expose relationship token addresses on pool-by-token responses.
  // For stablecoins and WETH/cbBTC pairs, using price fields gives a defensible USD amount estimate.
  if (poolName.includes('usdc') || poolName.includes('usdt') || poolName.includes('dai')) {
    if (tokenIn.endsWith('833589fcd6edb6e08f4c7c32d4f71b54bda02913') || tokenIn.endsWith('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')) return rawAmount;
  }
  const price = basePrice ?? quotePrice ?? 1;
  return rawAmount * price;
}

function isStable(chain: SupportedChain, address: string): boolean {
  return STABLECOINS[chain]?.has(address.toLowerCase()) ?? false;
}

function numFromUnits(value: bigint, decimals: number): number {
  return Number(formatUnits(value, decimals));
}

async function tokenMeta(client: ReturnType<typeof createPublicClient>, address: `0x${string}`, fallbackSymbol: string): Promise<{ decimals: number; symbol: string }> {
  const known = KNOWN_TOKENS[address.toLowerCase()];
  if (known) return known;
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => fallbackSymbol)
  ]);
  return { decimals, symbol };
}

async function onChainPoolHint(input: SlippageInput): Promise<{ depth: PoolDepth; p95: number | null; amountUsd: number; source: string; warnings: string[] }> {
  const poolAddress = input.route_hint?.pool_address;
  if (!poolAddress) throw new Error('on-chain pool fallback requires route_hint.pool_address');
  const config = chainConfigs[input.chain];
  const errors: string[] = [];

  for (const rpcUrl of rpcUrlsFor(config)) {
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 10000 }) });
    try {
      const [token0Raw, token1Raw, reserves] = await Promise.all([
        client.readContract({ address: poolAddress as `0x${string}`, abi: POOL_ABI, functionName: 'token0' }),
        client.readContract({ address: poolAddress as `0x${string}`, abi: POOL_ABI, functionName: 'token1' }),
        client.readContract({ address: poolAddress as `0x${string}`, abi: POOL_ABI, functionName: 'getReserves' })
      ]);
      const token0 = token0Raw.toLowerCase();
      const token1 = token1Raw.toLowerCase();
      const [meta0, meta1] = await Promise.all([tokenMeta(client, token0Raw, 'TOKEN0'), tokenMeta(client, token1Raw, 'TOKEN1')]);
      const reserve0 = numFromUnits(reserves[0], meta0.decimals);
      const reserve1 = numFromUnits(reserves[1], meta1.decimals);
      const tokenIn = input.token_in.toLowerCase();
      const stable0 = isStable(input.chain, token0);
      const stable1 = isStable(input.chain, token1);
      if (!stable0 && !stable1) throw new Error('on-chain fallback currently needs one stablecoin side to express depth in USD');

      const stableReserve = stable0 ? reserve0 : reserve1;
      const otherReserve = stable0 ? reserve1 : reserve0;
      const otherUsd = otherReserve > 0 ? stableReserve / otherReserve : 0;
      const amountRaw = Number(input.amount_in);
      if (!Number.isFinite(amountRaw) || amountRaw <= 0) throw new Error('amount_in must be positive');
      const amountUsd = (tokenIn === token0 && stable0) || (tokenIn === token1 && stable1) ? amountRaw : amountRaw * otherUsd;
      const reserveUsd = stableReserve * 2;

      let volumes: number[] = [];
      const warnings: string[] = [];
      try {
        const blockNumber = await client.getBlockNumber();
        const fromBlock = blockNumber > 8000n ? blockNumber - 8000n : 0n;
        const logs = await client.getLogs({ address: poolAddress as `0x${string}`, event: SWAP_EVENT, fromBlock, toBlock: blockNumber });
        volumes = logs.flatMap((log) => {
          try {
            const decoded = decodeEventLog({ abi: [SWAP_EVENT], data: log.data, topics: log.topics });
            const args = decoded.args as { amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint };
            const amount0 = numFromUnits(args.amount0In + args.amount0Out, meta0.decimals);
            const amount1 = numFromUnits(args.amount1In + args.amount1Out, meta1.decimals);
            if (stable0) return [amount0 > 0 ? amount0 : amount1 * otherUsd];
            return [amount1 > 0 ? amount1 : amount0 * otherUsd];
          } catch {
            return [];
          }
        });
        if (logs.length === 0) warnings.push('No standard UniswapV2-style Swap logs found in the recent on-chain window; recent_trade_size_p95 is unavailable for this pool ABI.');
      } catch {
        warnings.push('Standard Swap log fetch or decode failed; recent_trade_size_p95 is unavailable for this pool ABI/RPC window.');
        volumes = [];
      }

      const depth: PoolDepth = {
        chain: input.chain,
        dex: input.route_hint?.dex ?? 'v2-compatible-pool',
        pool_address: poolAddress,
        pool_name: `${meta0.symbol} / ${meta1.symbol}`,
        reserve_usd: reserveUsd,
        volume_24h_usd: null,
        price_change_1h_pct: null,
        price_change_24h_pct: null,
        estimated_price_impact_bps: estimatePriceImpactBps(amountUsd, reserveUsd),
        fee_bps: null,
        evidence_url: `${rpcUrl} eth_call/getLogs ${poolAddress}`
      };
      const p95 = percentile(volumes, 95);
      if (p95 === null && warnings.length === 0) warnings.push('No decodable recent swap volume samples found; flow buffer uses fallback.');
      return { depth, p95, amountUsd, source: `public_rpc:${new URL(rpcUrl).host}`, warnings };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`on-chain pool fallback failed: ${errors.join('; ')}`);
}

function poolToDepth(chain: SupportedChain, pool: GeckoPool, amountUsd: number): PoolDepth | null {
  const attrs = pool.attributes;
  if (!attrs?.address) return null;
  const reserveUsd = numberOrNull(attrs.reserve_in_usd) ?? 0;
  const feePct = numberOrNull(attrs.pool_fee_percentage);
  return {
    chain,
    dex: pool.relationships?.dex?.data?.id ?? 'unknown',
    pool_address: attrs.address,
    pool_name: attrs.name ?? attrs.pool_name ?? 'unknown pool',
    reserve_usd: reserveUsd,
    volume_24h_usd: numberOrNull(attrs.volume_usd?.h24),
    price_change_1h_pct: numberOrNull(attrs.price_change_percentage?.h1),
    price_change_24h_pct: numberOrNull(attrs.price_change_percentage?.h24),
    estimated_price_impact_bps: estimatePriceImpactBps(amountUsd, reserveUsd),
    fee_bps: feePct === null ? null : Math.round(feePct * 100),
    evidence_url: `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORKS[chain]}/pools/${attrs.address}`
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await withTimeout(fetch(url, { headers: { accept: 'application/json' } }), 12000, url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function fetchCandidatePools(input: SlippageInput): Promise<GeckoPool[]> {
  const network = GECKO_NETWORKS[input.chain];
  if (input.route_hint?.pool_address) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${input.route_hint.pool_address}`;
    const json = await fetchJson(url) as { data?: GeckoPool };
    return json.data ? [json.data] : [];
  }

  const tokenUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${input.token_in}/pools`;
  const json = await fetchJson(tokenUrl) as { data?: GeckoPool[] };
  const tokenOut = input.token_out.toLowerCase();
  const pools = (json.data ?? []).filter((pool) => JSON.stringify(pool).toLowerCase().includes(tokenOut));
  return (pools.length > 0 ? pools : (json.data ?? [])).slice(0, input.max_pools);
}

async function fetchTrades(chain: SupportedChain, poolAddress: string, windowHours: number): Promise<TradeSample[]> {
  const network = GECKO_NETWORKS[chain];
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/trades`;
  const json = await fetchJson(url) as { data?: GeckoTrade[] };
  const cutoffMs = Date.now() - windowHours * 60 * 60 * 1000;
  return (json.data ?? []).flatMap((trade) => {
    const attrs = trade.attributes;
    const volume = numberOrNull(attrs?.volume_in_usd);
    const timestamp = attrs?.block_timestamp;
    if (!attrs?.tx_hash || !timestamp || volume === null) return [];
    if (Date.parse(timestamp) < cutoffMs) return [];
    return [{ tx_hash: attrs.tx_hash, block_number: attrs.block_number ?? 0, timestamp, volume_usd: volume, kind: attrs.kind ?? 'unknown' }];
  });
}

export async function runSlippageSentinel(rawInput: unknown): Promise<SlippageOutput> {
  const input = slippageInputSchema.parse(rawInput);
  let pools: GeckoPool[] = [];
  const warnings: string[] = [];
  try {
    pools = await fetchCandidatePools(input);
  } catch (error) {
    warnings.push(`GeckoTerminal pool fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    if (input.route_hint?.pool_address) {
      const onChain = await onChainPoolHint(input);
      const minSafe = deriveSafeSlippageBps({
        impactBps: onChain.depth.estimated_price_impact_bps,
        feeBps: onChain.depth.fee_bps,
        volatility1hPct: null,
        recentTradeP95Usd: onChain.p95,
        amountUsd: onChain.amountUsd
      });
      return {
        min_safe_slip_bps: minSafe,
        pool_depths: [onChain.depth],
        recent_trade_size_p95: onChain.p95,
        route: { chain: onChain.depth.chain, dex: onChain.depth.dex, pool_address: onChain.depth.pool_address, pool_name: onChain.depth.pool_name },
        warnings: [...warnings, ...onChain.warnings],
        data_sources: [onChain.source, 'public_rpc:eth_getLogs']
      };
    }
  }
  if (pools.length === 0) throw new Error('No candidate pools found for token pair and route_hint');

  const firstAmountUsd = parseAmountInUsd(input, pools[0]);
  const depths = pools.map((pool) => poolToDepth(input.chain, pool, firstAmountUsd)).filter((pool): pool is PoolDepth => Boolean(pool));
  if (depths.length === 0) throw new Error('No usable pool depth data found');

  depths.sort((a, b) => b.reserve_usd - a.reserve_usd);
  const best = depths[0];
  let recentTradeP95: number | null = null;

  try {
    const trades = await fetchTrades(input.chain, best.pool_address, input.trade_window_hours);
    recentTradeP95 = percentile(trades.map((trade) => trade.volume_usd), 95);
    if (recentTradeP95 === null) warnings.push('No recent trade samples found in requested window; flow buffer uses fallback.');
  } catch (error) {
    warnings.push(`Recent trade sample fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    min_safe_slip_bps: deriveSafeSlippageBps({
      impactBps: best.estimated_price_impact_bps,
      feeBps: best.fee_bps,
      volatility1hPct: best.price_change_1h_pct,
      recentTradeP95Usd: recentTradeP95,
      amountUsd: firstAmountUsd
    }),
    pool_depths: depths,
    recent_trade_size_p95: recentTradeP95,
    route: { chain: best.chain, dex: best.dex, pool_address: best.pool_address, pool_name: best.pool_name },
    warnings,
    data_sources: ['geckoterminal:pools', 'geckoterminal:pool_trades']
  };
}
