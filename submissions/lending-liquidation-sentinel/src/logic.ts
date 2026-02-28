import { createPublicClient, http, formatUnits, type PublicClient, type Address } from "viem";
import { base, mainnet } from "viem/chains";

// ---------------------------------------------------------------------------
// Aave V3 Pool ABI (only the view functions we need)
// ---------------------------------------------------------------------------

const AAVE_V3_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Protocol configuration
// ---------------------------------------------------------------------------

interface ProtocolConfig {
  poolAddress: Address;
  chain: typeof base | typeof mainnet;
  rpcUrl?: string;
}

const PROTOCOL_CONFIGS: Record<string, ProtocolConfig> = {
  aave_v3_base: {
    poolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    chain: base,
  },
  aave_v3: {
    poolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    chain: base,
  },
  aave_v3_ethereum: {
    poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    chain: mainnet,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitorInput {
  wallet: string;
  protocol_ids?: string[];
  positions?: Array<{ asset?: string; protocol_id?: string }>;
  alert_threshold?: number;
}

export interface PositionResult {
  protocol_id: string;
  chain: string;
  wallet: string;
  total_collateral_usd: string;
  total_debt_usd: string;
  available_borrows_usd: string;
  liquidation_threshold_bps: string;
  ltv_bps: string;
  health_factor: number;
  liq_price: number;
  buffer_percent: number;
  alert_threshold_hit: boolean;
  risk_level: "SAFE" | "WARNING" | "DANGER" | "LIQUIDATABLE";
  timestamp: string;
}

export interface MonitorResult {
  wallet: string;
  positions: PositionResult[];
  health_factor: number | null;
  liq_price: number | null;
  buffer_percent: number | null;
  alert_threshold_hit: boolean;
  summary: string;
}

export interface HealthResult {
  wallet: string;
  protocol_id: string;
  health_factor: number;
  liq_price: number;
  buffer_percent: number;
  alert_threshold_hit: boolean;
  risk_level: string;
  total_collateral_usd: string;
  total_debt_usd: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient(config: ProtocolConfig): PublicClient {
  const transport = config.rpcUrl
    ? http(config.rpcUrl)
    : http();

  return createPublicClient({
    chain: config.chain,
    transport,
  }) as PublicClient;
}

function classifyRisk(healthFactor: number): "SAFE" | "WARNING" | "DANGER" | "LIQUIDATABLE" {
  if (healthFactor < 1.0) return "LIQUIDATABLE";
  if (healthFactor < 1.1) return "DANGER";
  if (healthFactor < 1.5) return "WARNING";
  return "SAFE";
}

/**
 * Approximate the price drop percentage that would trigger liquidation.
 *
 * In Aave, liquidation happens when:
 *   collateral_value * liquidation_threshold <= debt_value
 *
 * So the collateral can drop by a factor of (debt / (collateral * liqThreshold))
 * before liquidation. The liquidation price ratio relative to current price:
 *   liq_price_ratio = totalDebt / (totalCollateral * liqThreshold)
 *
 * If the user's collateral is all one asset, the liquidation price =
 *   current_price * liq_price_ratio
 *
 * Since we don't know individual asset prices from getUserAccountData alone,
 * we express liq_price as the ratio: how much the portfolio must fall.
 * liq_price = 1.0 means liquidation at current prices.
 * liq_price = 0.8 means collateral must drop 20% to trigger liquidation.
 */
function computeLiquidationMetrics(
  totalCollateralBase: bigint,
  totalDebtBase: bigint,
  healthFactorRaw: bigint,
  liquidationThresholdBps: bigint,
): { healthFactor: number; liqPrice: number; bufferPercent: number } {
  // healthFactor is in 1e18 decimals
  const healthFactor = Number(formatUnits(healthFactorRaw, 18));

  // If no debt, health factor is effectively infinite
  if (totalDebtBase === 0n) {
    return {
      healthFactor: Infinity,
      liqPrice: 0,
      bufferPercent: 100,
    };
  }

  // liquidationThreshold is in basis points (e.g. 8250 = 82.5%)
  const liqThreshold = Number(liquidationThresholdBps) / 10000;

  // liqPrice ratio: how far collateral must drop relative to current value
  // liquidation triggers when collateral * liqThreshold = debt
  // so collateral_at_liq = debt / liqThreshold
  // liq_price_ratio = collateral_at_liq / current_collateral = debt / (collateral * liqThreshold)
  const collateral = Number(formatUnits(totalCollateralBase, 8));
  const debt = Number(formatUnits(totalDebtBase, 8));

  let liqPrice: number;
  if (collateral > 0 && liqThreshold > 0) {
    liqPrice = debt / (collateral * liqThreshold);
  } else {
    liqPrice = 1.0;
  }

  // bufferPercent: how much room before liquidation
  // If healthFactor = 1.5, buffer = 50% (position can absorb a 50% drop relative to threshold)
  // If healthFactor < 1.0, buffer is negative
  const bufferPercent = (healthFactor - 1.0) * 100;

  return { healthFactor, liqPrice, bufferPercent };
}

// ---------------------------------------------------------------------------
// Core monitoring functions
// ---------------------------------------------------------------------------

async function fetchAccountData(
  wallet: Address,
  protocolId: string,
): Promise<PositionResult> {
  const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
  if (!ADDRESS_REGEX.test(wallet)) {
    throw new Error(`Invalid wallet address: ${wallet}`);
  }

  const config = PROTOCOL_CONFIGS[protocolId];
  if (!config) {
    throw new Error(
      `Unsupported protocol: ${protocolId}. Supported: ${Object.keys(PROTOCOL_CONFIGS).join(", ")}`,
    );
  }

  const client = getClient(config);

  const result = await client.readContract({
    address: config.poolAddress,
    abi: AAVE_V3_POOL_ABI,
    functionName: "getUserAccountData",
    args: [wallet],
  });

  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactorRaw,
  ] = result;

  const { healthFactor, liqPrice, bufferPercent } = computeLiquidationMetrics(
    totalCollateralBase,
    totalDebtBase,
    healthFactorRaw,
    currentLiquidationThreshold,
  );

  // Aave V3 base values are in 8 decimals (USD with 8 decimals)
  const totalCollateralUsd = formatUnits(totalCollateralBase, 8);
  const totalDebtUsd = formatUnits(totalDebtBase, 8);
  const availableBorrowsUsd = formatUnits(availableBorrowsBase, 8);

  return {
    protocol_id: protocolId,
    chain: config.chain.name,
    wallet,
    total_collateral_usd: totalCollateralUsd,
    total_debt_usd: totalDebtUsd,
    available_borrows_usd: availableBorrowsUsd,
    liquidation_threshold_bps: currentLiquidationThreshold.toString(),
    ltv_bps: ltv.toString(),
    health_factor: healthFactor,
    liq_price: Math.round(liqPrice * 10000) / 10000,
    buffer_percent: Math.round(bufferPercent * 100) / 100,
    alert_threshold_hit: false, // set by caller based on threshold
    risk_level: classifyRisk(healthFactor),
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Monitor all positions for a wallet across specified protocols.
 */
export async function monitorPositions(input: MonitorInput): Promise<MonitorResult> {
  const wallet = input.wallet as Address;
  const alertThreshold = input.alert_threshold ?? 1.5;

  // Determine which protocols to query
  let protocolIds: string[] = [];

  if (input.protocol_ids && input.protocol_ids.length > 0) {
    protocolIds = input.protocol_ids;
  } else if (input.positions && input.positions.length > 0) {
    // Extract unique protocol IDs from positions
    const seen = new Set<string>();
    for (const pos of input.positions) {
      const pid = pos.protocol_id ?? "aave_v3";
      if (!seen.has(pid)) {
        seen.add(pid);
        protocolIds.push(pid);
      }
    }
  } else {
    // Default: check Aave V3 on Base
    protocolIds = ["aave_v3"];
  }

  // Fetch data from each protocol in parallel
  const results = await Promise.allSettled(
    protocolIds.map((pid) => fetchAccountData(wallet, pid)),
  );

  const positions: PositionResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      const pos = result.value;
      pos.alert_threshold_hit = pos.health_factor < alertThreshold;
      positions.push(pos);
    } else {
      errors.push(`${protocolIds[i]}: ${result.reason?.message ?? "unknown error"}`);
    }
  }

  // Aggregate: use the worst (lowest) health factor across all positions
  let worstHealthFactor: number | null = null;
  let worstLiqPrice: number | null = null;
  let worstBufferPercent: number | null = null;
  let anyAlertHit = false;

  for (const pos of positions) {
    if (pos.health_factor < (worstHealthFactor ?? Infinity)) {
      worstHealthFactor = pos.health_factor;
      worstLiqPrice = pos.liq_price;
      worstBufferPercent = pos.buffer_percent;
    }
    if (pos.alert_threshold_hit) {
      anyAlertHit = true;
    }
  }

  // Build summary
  let summary: string;
  if (positions.length === 0) {
    summary = errors.length > 0
      ? `Failed to fetch positions: ${errors.join("; ")}`
      : "No active lending positions found for this wallet.";
    // Leave metrics as null — no data means no liquidation signal
  } else if (worstHealthFactor !== null && worstHealthFactor < 1.0) {
    summary = `CRITICAL: Position is liquidatable! Health factor: ${worstHealthFactor.toFixed(4)}. Immediate action required.`;
  } else if (worstHealthFactor !== null && worstHealthFactor < 1.1) {
    summary = `DANGER: Health factor is ${worstHealthFactor.toFixed(4)}. Liquidation is imminent. Buffer: ${worstBufferPercent!.toFixed(2)}%.`;
  } else if (anyAlertHit) {
    summary = `WARNING: Health factor ${worstHealthFactor!.toFixed(4)} is below alert threshold ${alertThreshold}. Buffer: ${worstBufferPercent!.toFixed(2)}%.`;
  } else {
    summary = `Position is healthy. Health factor: ${worstHealthFactor!.toFixed(4)}. Buffer: ${worstBufferPercent!.toFixed(2)}% above liquidation.`;
  }

  if (errors.length > 0 && positions.length > 0) {
    summary += ` (Some protocols failed: ${errors.join("; ")})`;
  }

  return {
    wallet: input.wallet,
    positions,
    health_factor:
      worstHealthFactor === null
        ? null
        : Math.round(worstHealthFactor * 10000) / 10000,
    liq_price: worstLiqPrice,
    buffer_percent:
      worstBufferPercent === null
        ? null
        : Math.round(worstBufferPercent * 100) / 100,
    alert_threshold_hit: anyAlertHit,
    summary,
  };
}

/**
 * Quick health check for a single wallet on a single protocol.
 */
export async function checkHealth(
  wallet: string,
  protocolId: string = "aave_v3",
  alertThreshold: number = 1.5,
): Promise<HealthResult> {
  const pos = await fetchAccountData(wallet as Address, protocolId);

  return {
    wallet,
    protocol_id: protocolId,
    health_factor: pos.health_factor,
    liq_price: pos.liq_price,
    buffer_percent: pos.buffer_percent,
    alert_threshold_hit: pos.health_factor < alertThreshold,
    risk_level: pos.risk_level,
    total_collateral_usd: pos.total_collateral_usd,
    total_debt_usd: pos.total_debt_usd,
    timestamp: pos.timestamp,
  };
}
