import { formatUnits, parseGwei } from 'viem';
import type { BusyLevel, GasRouteCalculationEvidence } from './types.js';

export const WEI_PER_GWEI = 1_000_000_000n;

export function calldataGasUnits(calldataSizeBytes: number): number {
  // Conservative EVM worst case: non-zero calldata byte costs 16 gas.
  return calldataSizeBytes * 16;
}

export function totalGasUnits(executionGasUnits: number, calldataSizeBytes: number): number {
  return executionGasUnits + calldataGasUnits(calldataSizeBytes);
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

export function gasEstimateErrorPct(estimatedGasUnits: number, observedGasUsed: number): number {
  if (observedGasUsed <= 0) throw new Error('observedGasUsed must be positive');
  return Math.abs(estimatedGasUnits - observedGasUsed) / observedGasUsed * 100;
}

export function buildGasRouteCalculationEvidence(): GasRouteCalculationEvidence {
  const calldataGas = calldataGasUnits(256);
  const totalGas = totalGasUnits(120000, 256);
  const feeWei = estimateFeeWei(totalGas, parseGwei('2'));
  const feeNative = weiToNativeString(feeWei);
  const feeUsd = roundUsd(Number(feeNative) * 2500);
  const receiptError = gasEstimateErrorPct(totalGas, 124000);
  const cases = [
    {
      name: 'calldata gas uses 16 gas per non-zero byte',
      expected: 4096,
      actual: calldataGas,
      gas_error_pct: null,
      pass: calldataGas === 4096
    },
    {
      name: 'fee_native multiplies total gas by gas price',
      expected: '0.000248192',
      actual: feeNative,
      gas_error_pct: null,
      pass: feeNative === '0.000248192'
    },
    {
      name: 'fee_usd converts native fee with supplied native USD price',
      expected: 0.62048,
      actual: feeUsd ?? 0,
      gas_error_pct: null,
      pass: feeUsd === 0.62048
    },
    {
      name: 'total gas estimate compared with receipt gasUsed fixture',
      expected: 124000,
      actual: totalGas,
      gas_error_pct: Math.round(receiptError * 1_000_000) / 1_000_000,
      pass: receiptError < 1
    }
  ];
  const passCount = cases.filter((testCase) => testCase.pass).length;
  const gasErrors = cases
    .map((testCase) => testCase.gas_error_pct)
    .filter((error): error is number => error !== null);
  const within5PctCases = cases.filter((testCase) => testCase.gas_error_pct !== null);
  const within5PctPassCount = within5PctCases.filter((testCase) => (testCase.gas_error_pct ?? Number.POSITIVE_INFINITY) <= 5).length;
  return {
    case_count: cases.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / cases.length) * 10000) / 100,
    max_gas_error_pct: Math.max(0, ...gasErrors),
    within_5pct_case_count: within5PctCases.length,
    within_5pct_pass_count: within5PctPassCount,
    within_5pct_threshold_pct: 5,
    cases
  };
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
