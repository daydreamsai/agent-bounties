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

export type IlBacktestCase = {
  name: string;
  token_weights: number[];
  price_relatives: number[];
  expected_IL_percent: number;
  actual_IL_percent: number;
  absolute_error_pct_points: number;
  relative_error_pct: number | null;
  pass: boolean;
};

export type IlBacktestSummary = {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  max_absolute_error_pct_points: number;
  max_relative_error_pct: number;
  relative_error_threshold_pct: number;
  cases: IlBacktestCase[];
};

const IL_BACKTEST_FIXTURES = [
  {
    name: '50/50 constant product 4x price move',
    token_weights: [0.5, 0.5],
    price_relatives: [4, 1],
    expected_IL_percent: -20
  },
  {
    name: '50/50 constant product 0.25x price move',
    token_weights: [0.5, 0.5],
    price_relatives: [0.25, 1],
    expected_IL_percent: -20
  },
  {
    name: '50/50 constant product 1.21x price move',
    token_weights: [0.5, 0.5],
    price_relatives: [1.21, 1],
    expected_IL_percent: -0.452488687783
  },
  {
    name: '80/20 weighted pool 4x price move',
    token_weights: [0.8, 0.2],
    price_relatives: [4, 1],
    expected_IL_percent: -10.840201969977
  },
  {
    name: 'weighted pool equal price movement',
    token_weights: [0.8, 0.2],
    price_relatives: [2, 2],
    expected_IL_percent: 0
  },
  {
    name: '50/50 constant product 1.01x small move',
    token_weights: [0.5, 0.5],
    price_relatives: [1.01, 1],
    expected_IL_percent: -0.001237600787
  }
] as const;

export function buildIlBacktestSummary(relativeErrorThresholdPct = 10): IlBacktestSummary {
  const cases = IL_BACKTEST_FIXTURES.map((fixture) => {
    const actual = weightedImpermanentLossPercent([...fixture.price_relatives], [...fixture.token_weights]);
    const absoluteError = Math.abs(actual - fixture.expected_IL_percent);
    const relativeError =
      Math.abs(fixture.expected_IL_percent) > 0 ? (absoluteError / Math.abs(fixture.expected_IL_percent)) * 100 : null;
    const pass = relativeError === null ? absoluteError <= 1e-9 : relativeError <= relativeErrorThresholdPct;
    return {
      name: fixture.name,
      token_weights: [...fixture.token_weights],
      price_relatives: [...fixture.price_relatives],
      expected_IL_percent: round(fixture.expected_IL_percent, 12) ?? fixture.expected_IL_percent,
      actual_IL_percent: round(actual, 12) ?? actual,
      absolute_error_pct_points: round(absoluteError, 12) ?? absoluteError,
      relative_error_pct: round(relativeError, 12),
      pass
    };
  });

  const relativeErrors = cases
    .map((testCase) => testCase.relative_error_pct)
    .filter((error): error is number => error !== null);
  const passCount = cases.filter((testCase) => testCase.pass).length;

  return {
    case_count: cases.length,
    pass_count: passCount,
    pass_rate_pct: round((passCount / cases.length) * 100, 6) ?? 0,
    max_absolute_error_pct_points: round(Math.max(...cases.map((testCase) => testCase.absolute_error_pct_points)), 12) ?? 0,
    max_relative_error_pct: round(Math.max(...relativeErrors), 12) ?? 0,
    relative_error_threshold_pct: relativeErrorThresholdPct,
    cases
  };
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
