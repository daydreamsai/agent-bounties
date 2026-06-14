import { fetchPoolOhlcv, fetchPoolSnapshot, priceRelativeFromOhlcv, volumeFromOhlcv, volumeFromSnapshot } from './gecko.js';
import {
  annualizedIlDrag,
  buildIlBacktestSummary,
  feeAprFromWindow,
  normalizeWeights,
  round,
  weightedImpermanentLossPercent
} from './math.js';
import { fetchOnchainFallback } from './onchain.js';
import { inputSchema, type LpIlInput, type LpIlOutput } from './types.js';

export async function runLpIlEstimator(rawInput: unknown): Promise<LpIlOutput> {
  const input = inputSchema.parse(rawInput);
  return estimateLpIl(input);
}

export async function estimateLpIl(input: LpIlInput): Promise<LpIlOutput> {
  const network = input.network || 'base';
  const windowHours = input.window_hours || 24;
  let feeBps = input.fee_bps;
  const weights = normalizeWeights(input.token_weights || [0.5, 0.5]);
  const notes: string[] = [];
  const dataSources = new Set<string>();

  if (input.deposit_amounts.length !== weights.length) {
    throw new Error('deposit_amounts length must match token_weights length');
  }

  let tvlUsd: number | null = null;
  let volumeWindow: number | null = null;
  let priceRatioStart: number | null = null;
  let priceRatioEnd: number | null = null;
  let priceRelative: number | null = null;

  try {
    const snapshot = await fetchPoolSnapshot(network, input.pool_address);
    dataSources.add(`geckoterminal:pool:${network}`);
    tvlUsd = snapshot.reserveUsd;
    volumeWindow = volumeFromSnapshot(snapshot, windowHours);
    feeBps = feeBps ?? snapshot.feeBps ?? undefined;
  } catch (error) {
    notes.push(`pool snapshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const points = await fetchPoolOhlcv(network, input.pool_address, windowHours);
    if (points.length > 0) {
      dataSources.add(`geckoterminal:ohlcv:${network}`);
      volumeWindow = volumeFromOhlcv(points, windowHours) ?? volumeWindow;
      const price = priceRelativeFromOhlcv(points, windowHours);
      if (price) {
        priceRatioStart = price.start;
        priceRatioEnd = price.end;
        priceRelative = price.relative;
      }
    }
  } catch (error) {
    notes.push(`pool OHLCV unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (priceRelative === null || tvlUsd === null || feeBps === undefined) {
    try {
      const fallback = await fetchOnchainFallback(network, input.pool_address, windowHours);
      for (const source of fallback.dataSources) dataSources.add(source);
      tvlUsd = tvlUsd ?? fallback.tvlUsd;
      feeBps = feeBps ?? fallback.feeBps ?? undefined;
      priceRatioStart = priceRatioStart ?? fallback.priceRatioStart;
      priceRatioEnd = priceRatioEnd ?? fallback.priceRatioEnd;
      priceRelative = priceRelative ?? fallback.priceRelative;
      notes.push(`on-chain fallback resolved pool tokens ${fallback.token0}/${fallback.token1} and DefiLlama token prices`);
    } catch (error) {
      notes.push(`on-chain fallback unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let ilPercent = 0;
  if (priceRelative !== null) {
    const relatives = weights.length === 2 ? [priceRelative, 1] : [priceRelative, ...weights.slice(1).map(() => 1)];
    ilPercent = weightedImpermanentLossPercent(relatives, weights);
  } else {
    notes.push('price ratio unavailable; IL_percent is reported as 0 because no historical pool price movement could be observed');
  }

  let feeApr: number | null = null;
  const feeBpsUsed = feeBps ?? 30;
  if (volumeWindow !== null && tvlUsd !== null && tvlUsd > 0) {
    feeApr = feeAprFromWindow({ volumeUsd: volumeWindow, tvlUsd, feeBps: feeBpsUsed, windowHours });
  } else {
    notes.push('fee_apr_est unavailable because volume_window or TVL was not observed');
  }

  const ilAnnualized = annualizedIlDrag(ilPercent, windowHours);
  const netApr = feeApr === null ? null : feeApr + ilAnnualized;
  const confidence = confidenceScore({
    hasPrice: priceRelative !== null,
    hasVolume: volumeWindow !== null,
    hasTvl: tvlUsd !== null,
    notes
  });

  if (input.fee_bps === undefined && feeBps === undefined) {
    notes.push('fee_bps defaulted to 30 bps; pass fee_bps for exact pool fee tier when known');
  }
  if (weights.length > 2) {
    notes.push('multi-token IL uses observed first-pair pool price movement for token 0 and assumes other relative prices are unchanged unless a richer price feed is added');
  }

  return {
    pool_address: input.pool_address,
    network,
    token_weights: weights,
    deposit_amounts: input.deposit_amounts,
    window_hours: windowHours,
    IL_percent: round(ilPercent, 6) ?? 0,
    fee_apr_est: round(feeApr, 6),
    volume_window: round(volumeWindow, 2),
    tvl_usd: round(tvlUsd, 2),
    net_apr_after_il_est: round(netApr, 6),
    price_ratio_start: round(priceRatioStart, 12),
    price_ratio_end: round(priceRatioEnd, 12),
    fee_bps_used: feeBpsUsed,
    notes,
    data_sources: [...dataSources].sort(),
    backtest_summary: buildIlBacktestSummary(),
    confidence
  };
}

function confidenceScore(args: { hasPrice: boolean; hasVolume: boolean; hasTvl: boolean; notes: string[] }): number {
  let score = 0.25;
  if (args.hasPrice) score += 0.35;
  if (args.hasVolume) score += 0.2;
  if (args.hasTvl) score += 0.15;
  if (args.notes.length === 0) score += 0.05;
  return Math.min(1, Math.round(score * 100) / 100);
}
