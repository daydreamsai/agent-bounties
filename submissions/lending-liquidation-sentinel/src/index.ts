import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { mainnet, polygon, arbitrum, optimism, base } from "viem/chains";
import { serve } from "@hono/node-server";

/* ------------------------------------------------------------------ */
/*  Constants & ABIs                                                    */
/* ------------------------------------------------------------------ */

// Aave V3 Pool contract addresses (common chains)
const AAVE_V3_POOLS: Record<number, Address> = {
  [mainnet.id]: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  [polygon.id]: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  [arbitrum.id]: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  [optimism.id]: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  [base.id]: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
};

// Compound Comptroller (v2) addresses
const COMPOUND_COMPTROLLERS: Record<number, Address> = {
  [mainnet.id]: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
};

// Minimal Aave V3 Pool ABI — getUserAccountData
const AAVE_POOL_ABI = [
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getUserAccountData",
    outputs: [
      { internalType: "uint256", name: "totalCollateralBase", type: "uint256" },
      { internalType: "uint256", name: "totalDebtBase", type: "uint256" },
      { internalType: "uint256", name: "availableBorrowsBase", type: "uint256" },
      { internalType: "uint256", name: "currentLiquidationThreshold", type: "uint256" },
      { internalType: "uint256", name: "ltv", type: "uint256" },
      { internalType: "uint256", name: "healthFactor", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Minimal Compound Comptroller ABI — getAccountLiquidity
const COMPTROLLER_ABI = [
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getAccountLiquidity",
    outputs: [
      { internalType: "uint256", name: "error", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
      { internalType: "uint256", name: "shortfall", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Price feed oracle ABI (simplified Chainlink AggregatorV3Interface)
const PRICE_FEED_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Schemas                                                             */
/* ------------------------------------------------------------------ */

const ChainEnum = z.enum(["ethereum", "polygon", "arbitrum", "optimism", "base"]);
const ProtocolEnum = z.enum(["aave", "compound"]);

const PositionSchema = z.object({
  asset: z.string().describe("Token address for the position"),
  protocol: ProtocolEnum,
  chain: ChainEnum,
  assetDecimals: z.number().optional().default(18),
  collateralAmount: z.string().optional().describe("Optional: user's collateral amount as string"),
  borrowAmount: z.string().optional().describe("Optional: user's borrow amount as string"),
  priceFeed: z.string().optional().describe("Optional: Chainlink price feed address for liq price calc"),
});

const InputSchema = z.object({
  wallet: z.string().describe("Wallet address to monitor"),
  protocol_ids: z.array(ProtocolEnum).describe("Lending protocols to check (aave|compound)"),
  positions: z.array(PositionSchema).describe("Specific positions to track"),
  alertThreshold: z.number().optional().default(1.5).describe("Health factor threshold for alerts (default: 1.5)"),
});

/* ------------------------------------------------------------------ */
/*  Chain helpers                                                       */
/* ------------------------------------------------------------------ */

// Map chain name strings to numeric chain IDs
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
};

function getRpcUrl(chain: string): string {
  const urls: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    polygon: "https://polygon.llamarpc.com",
    arbitrum: "https://arbitrum.llamarpc.com",
    optimism: "https://optimism.llamarpc.com",
    base: "https://base.llamarpc.com",
  };
  return urls[chain] ?? urls.ethereum;
}

function makeClient(chainName: string): ReturnType<typeof createPublicClient> {
  return createPublicClient({
    transport: http(getRpcUrl(chainName)),
  }) as any;
}

/* ------------------------------------------------------------------ */
/*  Protocol readers                                                    */
/* ------------------------------------------------------------------ */

interface ProtocolData {
  healthFactor: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  liquidationThreshold: number;
}

type ViemClient = ReturnType<typeof createPublicClient>;

async function readAavePosition(
  client: ViemClient,
  poolAddress: Address,
  wallet: Address,
): Promise<ProtocolData> {
  const data = (await client.readContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "getUserAccountData",
    args: [wallet],
  })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

  const [totalCollateralBase, totalDebtBase, , currentLiquidationThreshold, , healthFactorRaw] = data;

  // All returned values have 18 decimals in Aave V3
  const totalCollateral = Number(formatUnits(totalCollateralBase, 18));
  const totalDebt = Number(formatUnits(totalDebtBase, 18));
  const liqThreshold = Number(formatUnits(currentLiquidationThreshold, 18)); // e.g. 0.8 = 80%
  const hf = Number(formatUnits(healthFactorRaw, 18));

  return {
    healthFactor: hf,
    totalCollateralUsd: totalCollateral,
    totalDebtUsd: totalDebt,
    liquidationThreshold: liqThreshold,
  };
}

async function readCompoundPosition(
  client: ViemClient,
  comptrollerAddress: Address,
  wallet: Address,
): Promise<ProtocolData> {
  const data = (await client.readContract({
    address: comptrollerAddress,
    abi: COMPTROLLER_ABI,
    functionName: "getAccountLiquidity",
    args: [wallet],
  })) as readonly [bigint, bigint, bigint];

  const [, liquidity, shortfall] = data;
  const liqNum = Number(formatUnits(liquidity, 18));
  const sfNum = Number(formatUnits(shortfall, 18));

  // Compound v2: getAccountLiquidity returns excess liquidity (collateralValue - borrowValue)
  // and shortfall (borrowValue - collateralValue) if underwater.
  const collateralFactor = 0.75;

  let totalCollateralUsd: number;
  let totalDebtUsd: number;

  if (sfNum > 0) {
    totalDebtUsd = sfNum + liqNum;
    totalCollateralUsd = liqNum + totalDebtUsd;
    if (totalCollateralUsd <= 0) totalCollateralUsd = 1;
  } else {
    totalCollateralUsd = Math.max(liqNum, 0);
    totalDebtUsd = 0;
  }

  // Health factor: (totalCollateral * collateralFactor) / totalDebt
  let healthFactor: number;
  if (totalDebtUsd <= 0 || totalCollateralUsd <= 0) {
    healthFactor = totalDebtUsd <= 0 ? 999 : 1.0;
  } else {
    healthFactor = (totalCollateralUsd * collateralFactor) / totalDebtUsd;
  }

  return {
    healthFactor,
    totalCollateralUsd: Math.max(totalCollateralUsd, 0),
    totalDebtUsd: Math.max(totalDebtUsd, 0),
    liquidationThreshold: collateralFactor,
  };
}

/* ------------------------------------------------------------------ */
/*  Price / liq-price helpers                                           */
/* ------------------------------------------------------------------ */

async function fetchPriceUsd(
  client: ViemClient,
  priceFeed: Address | null,
): Promise<number | null> {
  if (!priceFeed) return null;
  try {
    const data = (await client.readContract({
      address: priceFeed,
      abi: PRICE_FEED_ABI,
      functionName: "latestRoundData",
    })) as readonly [bigint, bigint, bigint, bigint, bigint];

    const [, answer] = data;
    // Chainlink prices have 8 decimals
    return Number(formatUnits(answer, 8));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Agent app                                                            */
/* ------------------------------------------------------------------ */

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "1.0.0",
  description:
    "Monitors DeFi lending positions on Aave V3 and Compound, calculates health factors and liquidation prices, and alerts when positions approach liquidation risk.",
});

addEntrypoint({
  key: "check-positions",
  description: "Check lending positions for liquidation risk",
  input: InputSchema,
  price: "0.01",
  async handler({ input }) {
    const { wallet, positions, alertThreshold } = input as z.infer<typeof InputSchema>;
    const walletAddr = wallet as Address;

    const positionDetails: Array<{
      asset: string;
      protocol: string;
      chain: string;
      healthFactor: number;
      liqPrice: number | null;
      bufferPercent: number;
      alertThresholdHit: boolean;
      collateralUsd: number;
      debtUsd: number;
      error?: string;
    }> = [];

    // Aggregate protocol-chain data (cache lookups per chain+protocol)
    const protocolCache = new Map<string, ProtocolData>();

    for (const pos of positions) {
      const key = `${pos.protocol}:${pos.chain}`;

      if (!protocolCache.has(key)) {
        const client = makeClient(pos.chain);

        try {
          if (pos.protocol === "aave") {
            const poolAddr = AAVE_V3_POOLS[CHAIN_IDS[pos.chain]];
            if (!poolAddr) {
              positionDetails.push({ asset: pos.asset, protocol: pos.protocol, chain: pos.chain, healthFactor: 999, liqPrice: null, bufferPercent: 0, alertThresholdHit: false, collateralUsd: 0, debtUsd: 0, error: "No Aave V3 pool for this chain" });
              continue;
            }
            const data = await readAavePosition(client, poolAddr, walletAddr);
            protocolCache.set(key, data);
          } else if (pos.protocol === "compound") {
            const comptrollerAddr = COMPOUND_COMPTROLLERS[CHAIN_IDS[pos.chain]];
            if (!comptrollerAddr) {
              positionDetails.push({ asset: pos.asset, protocol: pos.protocol, chain: pos.chain, healthFactor: 999, liqPrice: null, bufferPercent: 0, alertThresholdHit: false, collateralUsd: 0, debtUsd: 0, error: "No Compound comptroller for this chain" });
              continue;
            }
            const data = await readCompoundPosition(client, comptrollerAddr, walletAddr);
            protocolCache.set(key, data);
          }
        } catch (err: any) {
          positionDetails.push({ asset: pos.asset, protocol: pos.protocol, chain: pos.chain, healthFactor: 999, liqPrice: null, bufferPercent: 0, alertThresholdHit: false, collateralUsd: 0, debtUsd: 0, error: err?.shortMessage ?? err?.message ?? "Unknown error reading protocol" });
          continue;
        }
      }

      const data = protocolCache.get(key);
      if (!data) {
        positionDetails.push({ asset: pos.asset, protocol: pos.protocol, chain: pos.chain, healthFactor: 999, liqPrice: null, bufferPercent: 0, alertThresholdHit: false, collateralUsd: 0, debtUsd: 0, error: "No protocol data available" });
        continue;
      }

      // Fetch current price for liquidation price calculation
      let liqPrice: number | null = null;
      if (pos.priceFeed) {
        const client = makeClient(pos.chain);
        const currentPrice = await fetchPriceUsd(client, pos.priceFeed as Address);
        if (currentPrice !== null && currentPrice > 0 && data.totalCollateralUsd > 0 && data.totalDebtUsd > 0) {
          const collateralTokenAmount = data.totalCollateralUsd / currentPrice;
          const liqRatio = data.totalDebtUsd / (collateralTokenAmount * data.liquidationThreshold);
          liqPrice = currentPrice * liqRatio;
        }
      }

      const healthFactor = data.healthFactor;
      const bufferPercent = healthFactor >= 1 ? ((healthFactor - 1) / 1) * 100 : ((1 - healthFactor) / 1) * -100;
      const alertThresholdHit = healthFactor < alertThreshold;

      positionDetails.push({
        asset: pos.asset,
        protocol: pos.protocol,
        chain: pos.chain,
        healthFactor,
        liqPrice,
        bufferPercent,
        alertThresholdHit,
        collateralUsd: data.totalCollateralUsd,
        debtUsd: data.totalDebtUsd,
      });
    }

    // Compute aggregate health factor (min across all positions)
    const globalHealthFactor = positionDetails.length > 0 ? Math.min(...positionDetails.map((p) => p.healthFactor)) : 999;
    const globalAlertThresholdHit = globalHealthFactor < alertThreshold;
    const globalBufferPercent = globalHealthFactor >= 1 ? ((globalHealthFactor - 1) / 1) * 100 : ((1 - globalHealthFactor) / 1) * -100;

    const result = {
      health_factor: globalHealthFactor,
      liq_price: null as number | null,
      buffer_percent: globalBufferPercent,
      alert_threshold_hit: globalAlertThresholdHit,
      position_details: positionDetails,
    };

    // Log alert if triggered
    if (globalAlertThresholdHit) {
      console.error(`\n⚠️  LIQUIDATION ALERT ⚠️\n   Wallet: ${wallet}\n   Health Factor: ${globalHealthFactor.toFixed(4)}\n   Buffer: ${globalBufferPercent.toFixed(2)}%\n   Threshold: ${alertThreshold}\n`);
    }

    return {
      output: result,
      usage: {
        total_tokens: positionDetails.length,
      },
    };
  },
});

export default app;

// Start server when run directly (not imported)
const port = parseInt(process.env.PORT ?? "3000", 10);
serve(
  { fetch: app.fetch, port },
  (info) => {
    console.log(`Lending Liquidation Sentinel running on http://localhost:${info.port}`);
  },
);
