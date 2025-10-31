import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "0.1.0",
  description: "Watch borrow positions and warn before liquidation risk",
});

interface PositionData {
  health_factor: number;
  liq_price: string;
  buffer_percent: number;
  alert_threshold_hit: boolean;
  collateral_amount: string;
  borrow_amount: string;
  collateral_asset: string;
  borrow_asset: string;
}

// Aave V2 Lending Pool
const AAVE_LENDING_POOL = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const AAVE_LENDING_POOL_ABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function getUserReservesData(address user) view returns (tuple(address underlyingAsset, uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 liquidityRate, bool usageAsCollateralEnabledOnUser, uint128 walletBalance, uint128 scaledBalance, bool isUsedAsCollateral, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)[] memory)",
];

// Compound V3 Comet
const COMPOUND_COMET = "0xc3d688B667034EAD09F3E7647C7BDE1B4F95C890"; // USDC market
const COMPOUND_COMET_ABI = [
  "function userCollateral(address account, address asset) view returns (uint128 balance, uint128 pledgedCollateral)",
  "function borrowBalanceOf(address account) view returns (uint256)",
  "function getAccountLiquidity(address account) view returns (uint256 collateralValue, uint256 borrowValue, uint256 liquidationThreshold, uint256 collateralBalance)",
  "function getAssetInfo(uint8 assetIndex) view returns (tuple(address asset, uint8 offset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap) memory)",
  "function getLiquidationFactor(address account) view returns (uint256)",
  "function baseTokenPriceFeed() view returns (address)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

const PRICE_ORACLE_ABI = [
  "function getAssetPrice(address asset) view returns (uint256)",
];

async function getAavePosition(
  provider: ethers.Provider,
  wallet: string
): Promise<PositionData | null> {
  try {
    const lendingPool = new ethers.Contract(AAVE_LENDING_POOL, AAVE_LENDING_POOL_ABI, provider);
    
    const accountData = await lendingPool.getUserAccountData(wallet);
    const healthFactor = Number(accountData.healthFactor) / 1e18;
    const totalCollateralETH = Number(accountData.totalCollateralETH) / 1e18;
    const totalDebtETH = Number(accountData.totalDebtETH) / 1e18;
    const liquidationThreshold = Number(accountData.currentLiquidationThreshold) / 100;
    
    // Calculate liquidation price (simplified)
    // HF = (collateral * liquidationThreshold) / debt
    // At HF = 1.0: liquidationPrice = debt / (collateral * liquidationThreshold)
    const liqPrice = totalDebtETH > 0 && totalCollateralETH > 0 ?
      (totalDebtETH / (totalCollateralETH * (liquidationThreshold / 100))) : "0";
    
    const bufferPercent = ((healthFactor - 1.0) / healthFactor) * 100;
    const alertThresholdHit = healthFactor < 1.1;
    
    // Get user reserves for more detail
    const userReserves = await lendingPool.getUserReservesData(wallet);
    let collateralAsset = "ETH";
    let borrowAsset = "ETH";
    let collateralAmount = totalCollateralETH.toString();
    let borrowAmount = totalDebtETH.toString();
    
    if (userReserves.length > 0) {
      // Find largest collateral and debt positions
      for (const reserve of userReserves) {
        if (Number(reserve.currentATokenBalance) > 0) {
          try {
            const assetContract = new ethers.Contract(reserve.underlyingAsset, ERC20_ABI, provider);
            collateralAsset = await assetContract.symbol();
          } catch {}
        }
        if (Number(reserve.currentVariableDebt) > 0 || Number(reserve.currentStableDebt) > 0) {
          try {
            const assetContract = new ethers.Contract(reserve.underlyingAsset, ERC20_ABI, provider);
            borrowAsset = await assetContract.symbol();
          } catch {}
        }
      }
    }
    
    return {
      health_factor: healthFactor,
      liq_price: liqPrice.toString(),
      buffer_percent: bufferPercent,
      alert_threshold_hit: alertThresholdHit,
      collateral_amount: collateralAmount,
      borrow_amount: borrowAmount,
      collateral_asset: collateralAsset,
      borrow_asset: borrowAsset,
    };
  } catch (error) {
    console.error("Error getting Aave position:", error);
    return null;
  }
}

async function getCompoundPosition(
  provider: ethers.Provider,
  wallet: string
): Promise<PositionData | null> {
  try {
    const comet = new ethers.Contract(COMPOUND_COMET, COMPOUND_COMET_ABI, provider);
    
    // Get account liquidity info
    const liquidity = await comet.getAccountLiquidity(wallet);
    const collateralValue = Number(liquidity.collateralValue) / 1e18;
    const borrowValue = Number(liquidity.borrowValue) / 1e18;
    
    // Health factor = collateralValue / borrowValue
    const healthFactor = borrowValue > 0 ? collateralValue / borrowValue : Infinity;
    
    // Calculate liquidation price
    // Simplified - would need asset-specific calculation
    const liqPrice = borrowValue > 0 && collateralValue > 0 ?
      (borrowValue / collateralValue).toString() : "0";
    
    const bufferPercent = ((healthFactor - 1.0) / healthFactor) * 100;
    const alertThresholdHit = healthFactor < 1.1;
    
    const borrowBalance = await comet.borrowBalanceOf(wallet);
    const borrowAmount = ethers.formatUnits(borrowBalance, 6); // USDC has 6 decimals
    
    // Get collateral info
    const baseToken = await comet.baseToken();
    const baseTokenContract = new ethers.Contract(baseToken, ERC20_ABI, provider);
    const collateralSymbol = await baseTokenContract.symbol();
    
    // Get collateral balance
    const collateralData = await comet.userCollateral(wallet, baseToken);
    const collateralAmount = ethers.formatUnits(collateralData.balance, await baseTokenContract.decimals());
    
    return {
      health_factor: healthFactor,
      liq_price: liqPrice,
      buffer_percent: bufferPercent,
      alert_threshold_hit: alertThresholdHit,
      collateral_amount: collateralAmount,
      borrow_amount: borrowAmount,
      collateral_asset: collateralSymbol || "USDC",
      borrow_asset: "USDC",
    };
  } catch (error) {
    console.error("Error getting Compound position:", error);
    return null;
  }
}

async function getLendingPosition(
  provider: ethers.Provider,
  wallet: string,
  protocolId: string,
  positionAddress?: string
): Promise<PositionData | null> {
  const protocolLower = protocolId.toLowerCase();
  
  if (protocolLower === "aave") {
    return await getAavePosition(provider, wallet);
  } else if (protocolLower === "compound") {
    return await getCompoundPosition(provider, wallet);
  }
  
  return null;
}

addEntrypoint({
  key: "monitor_position",
  description: "Monitor health factor and trigger alerts near liquidation",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor"),
    protocol_ids: z.array(z.string()).describe("Lending protocols to check"),
    positions: z.array(z.string()).optional().describe("Specific positions to track"),
  }),
  async handler({ input }) {
    try {
      const positions: PositionData[] = [];
      const rpcUrl = process.env.RPC_URL || "https://eth.llamarpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      for (const protocolId of input.protocol_ids) {
        const positionData = await getLendingPosition(
          provider,
          input.wallet,
          protocolId
        );
        if (positionData) positions.push(positionData);
      }

      // Find most at-risk position
      const mostAtRisk = positions.length > 0 ? positions.reduce(
        (min, pos) => (pos.health_factor < min.health_factor ? pos : min),
        positions[0]
      ) : null;

      return {
        output: {
          positions,
          most_at_risk: mostAtRisk,
          any_alert: positions.some((p) => p.alert_threshold_hit),
        },
        usage: {
          total_tokens: JSON.stringify(positions).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          positions: [],
          most_at_risk: null,
          any_alert: false,
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;
