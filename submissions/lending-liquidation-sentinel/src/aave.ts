import type { LendingPositionRisk, PositionInput } from './types.js';

const RAY = 10n ** 18n;
const BASE_DECIMALS = 8;
const GET_USER_ACCOUNT_DATA_SELECTOR = '0xbf92857c';

interface ProtocolConfig {
  id: string;
  chain: string;
  rpcUrl: string;
  pool: string;
}

export const protocols: Record<string, ProtocolConfig> = {
  'aave-v3-base': {
    id: 'aave-v3-base',
    chain: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
  },
  'aave-v3-arbitrum': {
    id: 'aave-v3-arbitrum',
    chain: 'arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    pool: '0x794a61358D6845594F94dc1Db02A252b5b4814aD'
  }
};

interface AccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

function encodeGetUserAccountData(wallet: string): string {
  return `${GET_USER_ACCOUNT_DATA_SELECTOR}${wallet.slice(2).padStart(64, '0')}`;
}

function decodeUintWords(hex: string): bigint[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const words: bigint[] = [];
  for (let i = 0; i < clean.length; i += 64) words.push(BigInt(`0x${clean.slice(i, i + 64) || '0'}`));
  return words;
}

function baseToUsd(value: bigint): number {
  return Number(value) / 10 ** BASE_DECIMALS;
}

function healthFactorToNumber(value: bigint): number | null {
  if (value >= (2n ** 256n - 1n) / 2n) return null;
  return Number(value) / Number(RAY);
}

function bufferPercent(healthFactor: number | null): number | null {
  if (healthFactor === null) return null;
  return Math.round((healthFactor - 1) * 10000) / 100;
}

export function calculateLiquidationPrice(position: PositionInput): number | null {
  const required = [position.collateral_amount, position.debt_amount, position.debt_price_usd, position.liquidation_threshold];
  if (required.some((value) => value === undefined)) return null;
  const collateralAmount = position.collateral_amount as number;
  const debtAmount = position.debt_amount as number;
  const debtPrice = position.debt_price_usd as number;
  const liquidationThreshold = position.liquidation_threshold as number;
  return Math.round(((debtAmount * debtPrice) / (collateralAmount * liquidationThreshold)) * 10000) / 10000;
}

export type LiquidationPriceFixture = {
  name: string;
  position: PositionInput;
  expected_liq_price: number | null;
  actual_liq_price: number | null;
  absolute_error_usd: number | null;
  pass: boolean;
};

export type PreLiquidationAlertFixture = {
  name: string;
  alert_threshold: number;
  liquidation_price: number;
  first_alert_price: number | null;
  first_alert_health_factor: number | null;
  crosses_before_liquidation: boolean;
  pass: boolean;
};

export type LiquidationCalculationEvidence = {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  max_absolute_error_usd: number;
  cases: LiquidationPriceFixture[];
  pre_liquidation_alert_case_count: number;
  pre_liquidation_alert_pass_count: number;
  pre_liquidation_alert_cases: PreLiquidationAlertFixture[];
};

const LIQUIDATION_PRICE_FIXTURES = [
  {
    name: '1 ETH collateral, 1000 USDC debt, 80% LT',
    position: { collateral_symbol: 'ETH', debt_symbol: 'USDC', collateral_amount: 1, debt_amount: 1000, debt_price_usd: 1, liquidation_threshold: 0.8 },
    expected_liq_price: 1250
  },
  {
    name: '2 ETH collateral, 1500 USDC debt, 75% LT',
    position: { collateral_symbol: 'ETH', debt_symbol: 'USDC', collateral_amount: 2, debt_amount: 1500, debt_price_usd: 1, liquidation_threshold: 0.75 },
    expected_liq_price: 1000
  },
  {
    name: '0.1 WBTC collateral, 4000 USDC debt, 80% LT',
    position: { collateral_symbol: 'WBTC', debt_symbol: 'USDC', collateral_amount: 0.1, debt_amount: 4000, debt_price_usd: 1, liquidation_threshold: 0.8 },
    expected_liq_price: 50000
  },
  {
    name: '1000 stable collateral, 750 USDC debt, 90% LT',
    position: { collateral_symbol: 'USDC', debt_symbol: 'USDC', collateral_amount: 1000, debt_amount: 750, debt_price_usd: 1, liquidation_threshold: 0.9 },
    expected_liq_price: 0.8333
  },
  {
    name: 'missing liquidation threshold returns null',
    position: { collateral_symbol: 'ETH', debt_symbol: 'USDC', collateral_amount: 1, debt_amount: 1000, debt_price_usd: 1 },
    expected_liq_price: null
  }
] as const;

const PRE_LIQUIDATION_ALERT_FIXTURES = [
  {
    name: 'ETH collateral alert fires at HF 1.2 before liquidation',
    position: { collateral_symbol: 'ETH', debt_symbol: 'USDC', collateral_amount: 1, debt_amount: 1000, debt_price_usd: 1, liquidation_threshold: 0.8 },
    alert_threshold: 1.2,
    observed_prices: [1800, 1600, 1500, 1400, 1250]
  },
  {
    name: 'WBTC collateral alert fires at HF 1.1 before liquidation',
    position: { collateral_symbol: 'WBTC', debt_symbol: 'USDC', collateral_amount: 0.1, debt_amount: 4000, debt_price_usd: 1, liquidation_threshold: 0.8 },
    alert_threshold: 1.1,
    observed_prices: [70000, 60000, 55000, 50000]
  }
] as const;

export function buildLiquidationCalculationEvidence(): LiquidationCalculationEvidence {
  const cases = LIQUIDATION_PRICE_FIXTURES.map((fixture) => {
    const actual = calculateLiquidationPrice(fixture.position);
    const absoluteError = actual === null || fixture.expected_liq_price === null ? null : Math.abs(actual - fixture.expected_liq_price);
    const pass = fixture.expected_liq_price === null ? actual === null : absoluteError !== null && absoluteError <= 0.0001;
    return {
      name: fixture.name,
      position: fixture.position,
      expected_liq_price: fixture.expected_liq_price,
      actual_liq_price: actual,
      absolute_error_usd: absoluteError,
      pass
    };
  });
  const numericErrors = cases
    .map((testCase) => testCase.absolute_error_usd)
    .filter((error): error is number => error !== null);
  const passCount = cases.filter((testCase) => testCase.pass).length;
  const preLiquidationAlertCases = PRE_LIQUIDATION_ALERT_FIXTURES.map((fixture) => buildPreLiquidationAlertFixture(fixture));
  const alertPassCount = preLiquidationAlertCases.filter((testCase) => testCase.pass).length;
  return {
    case_count: cases.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / cases.length) * 10000) / 100,
    max_absolute_error_usd: Math.max(0, ...numericErrors),
    cases,
    pre_liquidation_alert_case_count: preLiquidationAlertCases.length,
    pre_liquidation_alert_pass_count: alertPassCount,
    pre_liquidation_alert_cases: preLiquidationAlertCases
  };
}

function buildPreLiquidationAlertFixture(fixture: {
  name: string;
  position: PositionInput;
  alert_threshold: number;
  observed_prices: readonly number[];
}): PreLiquidationAlertFixture {
  const liquidationPrice = calculateLiquidationPrice(fixture.position);
  if (liquidationPrice === null) {
    return {
      name: fixture.name,
      alert_threshold: fixture.alert_threshold,
      liquidation_price: 0,
      first_alert_price: null,
      first_alert_health_factor: null,
      crosses_before_liquidation: false,
      pass: false
    };
  }
  const firstAlert = fixture.observed_prices
    .map((price) => ({ price, healthFactor: healthFactorAtCollateralPrice(fixture.position, price) }))
    .find((point) => point.healthFactor !== null && point.healthFactor <= fixture.alert_threshold && point.healthFactor > 1);
  const firstAlertHealthFactor = firstAlert?.healthFactor ?? null;
  const crossesBeforeLiquidation = firstAlert !== undefined && firstAlert.price > liquidationPrice && firstAlertHealthFactor !== null && firstAlertHealthFactor > 1;
  return {
    name: fixture.name,
    alert_threshold: fixture.alert_threshold,
    liquidation_price: liquidationPrice,
    first_alert_price: firstAlert?.price ?? null,
    first_alert_health_factor: firstAlertHealthFactor === null ? null : Math.round(firstAlertHealthFactor * 10000) / 10000,
    crosses_before_liquidation: crossesBeforeLiquidation,
    pass: crossesBeforeLiquidation
  };
}

export function healthFactorAtCollateralPrice(position: PositionInput, collateralPriceUsd: number): number | null {
  const required = [position.collateral_amount, position.debt_amount, position.debt_price_usd, position.liquidation_threshold];
  if (required.some((value) => value === undefined)) return null;
  const collateralAmount = position.collateral_amount as number;
  const debtAmount = position.debt_amount as number;
  const debtPrice = position.debt_price_usd as number;
  const liquidationThreshold = position.liquidation_threshold as number;
  return (collateralAmount * collateralPriceUsd * liquidationThreshold) / (debtAmount * debtPrice);
}

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'lending-liquidation-sentinel/0.1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC HTTP ${response.status}`);
  return payload.result as T;
}

export async function fetchAaveAccountRisk(protocolId: string, wallet: string, alertThreshold: number, positions: PositionInput[]): Promise<LendingPositionRisk> {
  const protocol = protocols[protocolId];
  if (!protocol) throw new Error(`Unsupported protocol_id: ${protocolId}`);
  const result = await rpcCall<string>(protocol.rpcUrl, 'eth_call', [{ to: protocol.pool, data: encodeGetUserAccountData(wallet) }, 'latest']);
  const words = decodeUintWords(result);
  if (words.length < 6) throw new Error(`Unexpected getUserAccountData result for ${protocolId}`);
  const data: AccountData = {
    totalCollateralBase: words[0],
    totalDebtBase: words[1],
    availableBorrowsBase: words[2],
    currentLiquidationThreshold: words[3],
    ltv: words[4],
    healthFactor: words[5]
  };
  const healthFactor = healthFactorToNumber(data.healthFactor);
  const selectedPosition = positions.find((position) => !position.protocol_id || position.protocol_id === protocolId);
  const notes = ['Aave V3 aggregate account data is read directly from Pool.getUserAccountData.'];
  if (!selectedPosition) notes.push('liq_price is null because no single collateral/debt position details were supplied.');
  return {
    protocol_id: protocolId,
    chain: protocol.chain,
    health_factor: healthFactor,
    liq_price: selectedPosition ? calculateLiquidationPrice(selectedPosition) : null,
    buffer_percent: bufferPercent(healthFactor),
    alert_threshold_hit: healthFactor !== null && healthFactor <= alertThreshold,
    total_collateral_usd: baseToUsd(data.totalCollateralBase),
    total_debt_usd: baseToUsd(data.totalDebtBase),
    available_borrow_usd: baseToUsd(data.availableBorrowsBase),
    current_liquidation_threshold_bps: Number(data.currentLiquidationThreshold),
    ltv_bps: Number(data.ltv),
    data_source: `${protocol.id}:Pool.getUserAccountData`,
    notes
  };
}

export const testInternals = {
  encodeGetUserAccountData,
  decodeUintWords,
  healthFactorToNumber,
  bufferPercent,
  baseToUsd,
  healthFactorAtCollateralPrice,
  calculateLiquidationPrice,
  buildLiquidationCalculationEvidence
};
