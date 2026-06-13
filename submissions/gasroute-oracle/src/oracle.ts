import { createPublicClient, formatGwei, http } from 'viem';
import { chainConfigs, rpcUrlsFor } from './chains.js';
import {
  baseFeeTrendPct,
  calldataGasUnits,
  classifyBusyLevel,
  estimateFeeWei,
  roundUsd,
  suggestPriorityFee,
  weiToGweiNumber,
  weiToNativeString
} from './fees.js';
import { gasRouteInputSchema, type ChainGasQuote, type GasRouteInput, type GasRouteOutput, type SupportedChain } from './types.js';

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

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'custom-rpc';
  }
}

async function fetchNativePrices(chains: SupportedChain[]): Promise<Record<string, number>> {
  const ids = [...new Set(chains.map((chain) => chainConfigs[chain].priceId))];
  const prices: Record<string, number> = {};

  try {
    const llamaIds = ids.map((id) => `coingecko:${id}`).join(',');
    const llamaUrl = `https://coins.llama.fi/prices/current/${llamaIds}`;
    const response = await withTimeout(fetch(llamaUrl, { headers: { accept: 'application/json' } }), 5000, 'DefiLlama price fetch');
    if (response.ok) {
      const json = await response.json() as { coins?: Record<string, { price?: number }> };
      for (const id of ids) {
        const price = json.coins?.[`coingecko:${id}`]?.price;
        if (typeof price === 'number' && Number.isFinite(price)) prices[id] = price;
      }
    }
  } catch {
    // Fall through to CoinGecko for missing values.
  }

  const missing = ids.filter((id) => prices[id] === undefined);
  if (missing.length > 0) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${missing.join(',')}&vs_currencies=usd`;
      const response = await withTimeout(fetch(url, { headers: { accept: 'application/json' } }), 5000, 'CoinGecko price fetch');
      if (response.ok) {
        const json = await response.json() as Record<string, { usd?: number }>;
        for (const id of missing) {
          const price = json[id]?.usd;
          if (typeof price === 'number' && Number.isFinite(price)) prices[id] = price;
        }
      }
    } catch {
      // Missing USD price is reported as null per quote instead of fabricated.
    }
  }

  return prices;
}

async function quoteChain(chain: SupportedChain, input: GasRouteInput, nativePriceUsd: number | undefined): Promise<ChainGasQuote> {
  const config = chainConfigs[chain];
  const urls = rpcUrlsFor(config);
  const totalGasUnits = input.gas_units_est + calldataGasUnits(input.calldata_size_bytes);
  const errors: string[] = [];

  for (const rpcUrl of urls) {
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 8000 }) });
    try {
      const blockNumber = await withTimeout(client.getBlockNumber(), 9000, `${chain} blockNumber`);
      try {
        const history = await withTimeout(client.getFeeHistory({ blockCount: 8, rewardPercentiles: [50, 75] }), 9000, `${chain} feeHistory`);
        const baseFees = history.baseFeePerGas ?? [];
        const lastBaseFee = baseFees.length > 0 ? baseFees[baseFees.length - 1] : 0n;
        const priorityFee = suggestPriorityFee(history.reward, lastBaseFee || 1_000_000_000n);
        const gasPriceWei = lastBaseFee + priorityFee;
        const feeWei = estimateFeeWei(totalGasUnits, gasPriceWei);
        const price = nativePriceUsd && Number.isFinite(nativePriceUsd) ? nativePriceUsd : null;
        const trend = baseFeeTrendPct(baseFees);
        return {
          chain,
          chain_id: config.chainId,
          native_symbol: config.nativeSymbol,
          fee_native: weiToNativeString(feeWei, config.nativeDecimals),
          fee_usd: roundUsd(price === null ? null : Number(weiToNativeString(feeWei, config.nativeDecimals)) * price),
          busy_level: classifyBusyLevel(history.gasUsedRatio, trend),
          tip_hint: formatGwei(priorityFee),
          base_fee_gwei: lastBaseFee ? weiToGweiNumber(lastBaseFee) : null,
          priority_fee_gwei: weiToGweiNumber(priorityFee),
          gas_price_gwei: weiToGweiNumber(gasPriceWei),
          gas_units_est: input.gas_units_est,
          calldata_size_bytes: input.calldata_size_bytes,
          calldata_gas_units: calldataGasUnits(input.calldata_size_bytes),
          total_gas_units: totalGasUnits,
          native_price_usd: price,
          block_number: blockNumber.toString(),
          evidence: { rpc_url_host: hostOf(rpcUrl), method: 'feeHistory', gas_used_ratio: history.gasUsedRatio, fetched_at: new Date().toISOString() }
        };
      } catch (feeHistoryError) {
        errors.push(`${hostOf(rpcUrl)} feeHistory: ${feeHistoryError instanceof Error ? feeHistoryError.message : String(feeHistoryError)}`);
        const gasPrice = await withTimeout(client.getGasPrice(), 9000, `${chain} gasPrice`);
        const feeWei = estimateFeeWei(totalGasUnits, gasPrice);
        const price = nativePriceUsd && Number.isFinite(nativePriceUsd) ? nativePriceUsd : null;
        return {
          chain,
          chain_id: config.chainId,
          native_symbol: config.nativeSymbol,
          fee_native: weiToNativeString(feeWei, config.nativeDecimals),
          fee_usd: roundUsd(price === null ? null : Number(weiToNativeString(feeWei, config.nativeDecimals)) * price),
          busy_level: 'unknown',
          tip_hint: formatGwei(gasPrice / 20n),
          base_fee_gwei: null,
          priority_fee_gwei: null,
          gas_price_gwei: weiToGweiNumber(gasPrice),
          gas_units_est: input.gas_units_est,
          calldata_size_bytes: input.calldata_size_bytes,
          calldata_gas_units: calldataGasUnits(input.calldata_size_bytes),
          total_gas_units: totalGasUnits,
          native_price_usd: price,
          block_number: blockNumber.toString(),
          evidence: { rpc_url_host: hostOf(rpcUrl), method: 'gasPrice', fetched_at: new Date().toISOString() }
        };
      }
    } catch (error) {
      errors.push(`${hostOf(rpcUrl)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`${chain} RPC quote failed: ${errors.join('; ')}`);
}

export async function runGasRouteOracle(rawInput: unknown): Promise<GasRouteOutput> {
  const input = gasRouteInputSchema.parse(rawInput);
  const prices = await fetchNativePrices(input.chain_set);
  const settled = await Promise.allSettled(input.chain_set.map((chain) => quoteChain(chain, input, prices[chainConfigs[chain].priceId])));
  const quotes: ChainGasQuote[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    if (result.status === 'fulfilled') quotes.push(result.value);
    else warnings.push(`${input.chain_set[i]} skipped: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  }

  if (quotes.length === 0) throw new Error(`No gas quotes available. ${warnings.join(' ')}`);

  quotes.sort((a, b) => {
    if (a.fee_usd !== null && b.fee_usd !== null) return a.fee_usd - b.fee_usd;
    return Number(a.fee_native) - Number(b.fee_native);
  });

  const best = quotes[0];
  return {
    chain: best.chain,
    fee_native: best.fee_native,
    fee_usd: best.fee_usd,
    busy_level: best.busy_level,
    tip_hint: best.tip_hint,
    quotes,
    warnings,
    data_sources: ['public_rpc:eth_feeHistory', 'public_rpc:eth_gasPrice_fallback', 'defillama:coins_price', 'coingecko:simple_price_fallback']
  };
}