import { formatUnits, parseGwei } from 'viem';
import type { BusyLevel } from './types.js';

export const WEI_PER_GWEI = 1_000_000_000n;

export function calldataGasUnits(calldataSizeBytes: number): number {
  // Conservative EVM worst case: non-zero calldata byte costs 16 gas.
  return calldataSizeBytes * 16;
}

export function percentile(values: bigint[], p: number): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function suggestPriorityFee(rewards: bigint[][] | undefined, fallbackGasPrice: bigint): bigint {
  const flattened = (rewards ?? []).flat().filter((value) => value > 0n);
  if (flattened.length > 0) return percentile(flattened, 60);
  const oneGwei = parseGwei('1');
  const fivePercent = fallbackGasPrice / 20n;
  return fivePercent > oneGwei ? fivePercent : oneGwei;
}

export function classifyBusyLevel(gasUsedRatio: number[] | undefined, baseFeeTrendPct: number | null): BusyLevel {
  if (!gasUsedRatio || gasUsedRatio.length === 0) return 'unknown';
  const avg = gasUsedRatio.reduce((sum, value) => sum + value, 0) / gasUsedRatio.length;
  if (avg >= 0.92 || (baseFeeTrendPct !== null && baseFeeTrendPct > 25)) return 'congested';
  if (avg >= 0.75 || (baseFeeTrendPct !== null && baseFeeTrendPct > 10)) return 'high';
  if (avg >= 0.45) return 'medium';
  return 'low';
}

export function baseFeeTrendPct(baseFees: bigint[]): number | null {
  if (baseFees.length < 2 || baseFees[0] === 0n) return null;
  const first = Number(baseFees[0]);
  const last = Number(baseFees[baseFees.length - 1]);
  return ((last - first) / first) * 100;
}

export function estimateFeeWei(totalGasUnits: number, gasPriceWei: bigint): bigint {
  return BigInt(totalGasUnits) * gasPriceWei;
}

export function weiToNativeString(wei: bigint, decimals = 18): string {
  return formatUnits(wei, decimals);
}

export function weiToGweiNumber(wei: bigint): number {
  return Number(wei) / Number(WEI_PER_GWEI);
}

export function roundUsd(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 1_000_000) / 1_000_000;
}