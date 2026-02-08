import { createPublicClient, http, type Address, formatUnits } from "viem";
import { mainnet, base, arbitrum } from "viem/chains";

// Aave V3 Pool contract addresses
const AAVE_V3_POOL: Record<number, Address> = {
  1: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Ethereum
  8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Base
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Arbitrum
};

// Aave V3 UI Pool Data Provider (for getUserAccountData alternative)
const POOL_ABI = [
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
] as const;

const CHAINS: Record<number, { chain: typeof mainnet; name: string; rpc?: string }> = {
  1: { chain: mainnet, name: "ethereum" },
  8453: { chain: base, name: "base" },
  42161: { chain: arbitrum, name: "arbitrum" },
};

export type AavePositionData = {
  chain_id: number;
  chain_name: string;
  wallet: string;
  total_collateral_usd: number;
  total_debt_usd: number;
  available_borrows_usd: number;
  liquidation_threshold: number;
  ltv: number;
  health_factor: number;
  liq_price_drop_percent: number;
  buffer_percent: number;
  alert_threshold_hit: boolean;
};

export async function getAaveV3Position(
  wallet: Address,
  chainId: number,
  alertThreshold: number = 1.2
): Promise<AavePositionData> {
  const chainInfo = CHAINS[chainId];
  if (!chainInfo) throw new Error(`Unsupported chain: ${chainId}`);

  const poolAddress = AAVE_V3_POOL[chainId];
  if (!poolAddress) throw new Error(`No Aave V3 pool on chain ${chainId}`);

  const client = createPublicClient({
    chain: chainInfo.chain,
    transport: http(),
  });

  const data = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getUserAccountData",
    args: [wallet],
  });

  const totalCollateralBase = Number(formatUnits(data[0], 8)); // Aave uses 8 decimals for USD base
  const totalDebtBase = Number(formatUnits(data[1], 8));
  const availableBorrowsBase = Number(formatUnits(data[2], 8));
  const liquidationThreshold = Number(data[3]) / 10000; // basis points
  const ltv = Number(data[4]) / 10000;
  const healthFactor = Number(formatUnits(data[5], 18));

  // If no debt, health factor is infinite
  const effectiveHF = totalDebtBase === 0 ? 999 : healthFactor;

  // Liquidation price = how much collateral price needs to drop for HF to hit 1.0
  // HF = (collateral * liqThreshold) / debt
  // At liquidation: 1 = (collateral * (1 - drop%) * liqThreshold) / debt
  // drop% = 1 - debt / (collateral * liqThreshold) = 1 - 1/HF
  const liqPriceDropPercent = totalDebtBase === 0 ? 100 : Math.max(0, (1 - 1 / effectiveHF) * 100);

  // Buffer = how far above 1.0 the HF is, as percentage
  const bufferPercent = totalDebtBase === 0 ? 100 : Math.max(0, (effectiveHF - 1) * 100);

  return {
    chain_id: chainId,
    chain_name: chainInfo.name,
    wallet,
    total_collateral_usd: totalCollateralBase,
    total_debt_usd: totalDebtBase,
    available_borrows_usd: availableBorrowsBase,
    liquidation_threshold: liquidationThreshold,
    ltv,
    health_factor: Math.round(effectiveHF * 10000) / 10000,
    liq_price_drop_percent: Math.round(liqPriceDropPercent * 100) / 100,
    buffer_percent: Math.round(bufferPercent * 100) / 100,
    alert_threshold_hit: effectiveHF < alertThreshold && totalDebtBase > 0,
  };
}

export async function getMultiChainPositions(
  wallet: Address,
  chainIds: number[],
  alertThreshold: number = 1.2
): Promise<AavePositionData[]> {
  const results = await Promise.allSettled(
    chainIds.map((id) => getAaveV3Position(wallet, id, alertThreshold))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<AavePositionData> => r.status === "fulfilled")
    .map((r) => r.value);
}
