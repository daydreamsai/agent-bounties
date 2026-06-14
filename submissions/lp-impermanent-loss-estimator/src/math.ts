export function normalizeWeights(weights: number[]): number[] {
  if (weights.length < 2) throw new Error('token_weights must contain at least two weights');
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('token_weights must be positive finite numbers');
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

export function weightedImpermanentLossPercent(priceRelatives: number[], rawWeights: number[]): number {
  if (priceRelatives.length !== rawWeights.length) {
    throw new Error('priceRelatives and token_weights must have the same length');
  }
  if (priceRelatives.some((relative) => !Number.isFinite(relative) || relative <= 0)) {
    throw new Error('price relatives must be positive finite numbers');
  }
  const weights = normalizeWeights(rawWeights);
  const poolValueRelative = priceRelatives.reduce((product, relative, index) => product * Math.pow(relative, weights[index]), 1);
  const holdValueRelative = priceRelatives.reduce((sum, relative, index) => sum + weights[index] * relative, 0);
  return (poolValueRelative / holdValueRelative - 1) * 100;
}

export function feeAprFromWindow(args: {
  volumeUsd: number;
  tvlUsd: number;
  feeBps: number;
  windowHours: number;
}): number {
  if (args.tvlUsd <= 0) throw new Error('tvlUsd must be positive');
  if (args.windowHours <= 0) throw new Error('windowHours must be positive');
  const feeRate = args.feeBps / 10_000;
  const feesWindow = args.volumeUsd * feeRate;
  return (feesWindow / args.tvlUsd) * (24 / args.windowHours) * 365 * 100;
}

export function annualizedIlDrag(ilPercent: number, windowHours: number): number {
  if (windowHours <= 0) throw new Error('windowHours must be positive');
  return ilPercent * (24 / windowHours) * 365;
}

export function round(value: number | null, decimals = 6): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
