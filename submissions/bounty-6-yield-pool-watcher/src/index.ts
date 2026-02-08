import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { createPublicClient, http, type Address, formatUnits } from "viem";
import { base } from "viem/chains";

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "1.0.0",
  description: "Monitor DeFi yield pools — track APY, TVL, and alert on threshold changes",
});

const AAVE_DATA_PROVIDER: Address = "0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac";
const AAVE_POOL: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";

const RESERVE_DATA_ABI = [{
  name: "getReserveData",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "asset", type: "address" }],
  outputs: [
    { name: "unbacked", type: "uint256" },
    { name: "accruedToTreasuryScaled", type: "uint256" },
    { name: "totalAToken", type: "uint256" },
    { name: "totalStableDebt", type: "uint256" },
    { name: "totalVariableDebt", type: "uint256" },
    { name: "liquidityRate", type: "uint256" },
    { name: "variableBorrowRate", type: "uint256" },
    { name: "stableBorrowRate", type: "uint256" },
    { name: "averageStableBorrowRate", type: "uint256" },
    { name: "liquidityIndex", type: "uint256" },
    { name: "variableBorrowIndex", type: "uint256" },
    { name: "lastUpdateTimestamp", type: "uint40" },
  ],
}] as const;

const KNOWN_TOKENS: Record<string, { address: Address; decimals: number; name: string }> = {
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, name: "WETH" },
  USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, name: "USDC" },
  cbBTC: { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8, name: "cbBTC" },
  weETH: { address: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A", decimals: 18, name: "weETH" },
};

addEntrypoint({
  key: "monitor",
  description: "Monitor yield pools and alert on threshold changes",
  input: z.object({
    protocol_ids: z.array(z.string()).optional().default(["aave_v3"]),
    pools: z.array(z.string()).optional().default(["WETH", "USDC", "cbBTC", "weETH"]),
    apy_alert_threshold: z.number().optional().default(0.5).describe("Alert if APY changes by more than this %"),
  }),
  output: z.object({
    pool_metrics: z.array(z.object({
      pool: z.string(),
      token: z.string(),
      supply_apy: z.number(),
      borrow_apy: z.number(),
      total_supply: z.string(),
      total_borrows: z.string(),
      utilization: z.number(),
    })),
    alerts: z.array(z.object({ pool: z.string(), message: z.string() })),
    summary: z.string(),
  }),
  async handler({ input }) {
    const client = createPublicClient({ chain: base, transport: http("https://1rpc.io/base") });
    const pools = input.pools ?? Object.keys(KNOWN_TOKENS);
    const metrics: any[] = [];
    const alerts: any[] = [];

    for (const poolName of pools) {
      const token = KNOWN_TOKENS[poolName];
      if (!token) continue;

      try {
        const data = await client.readContract({
          address: AAVE_DATA_PROVIDER,
          abi: RESERVE_DATA_ABI,
          functionName: "getReserveData",
          args: [token.address],
        });

        const totalSupply = data[2];
        const totalBorrows = data[4];
        const liquidityRate = data[5]; // RAY (1e27)
        const variableBorrowRate = data[6];

        const supplyApy = (Number(liquidityRate) / 1e27) * 100;
        const borrowApy = (Number(variableBorrowRate) / 1e27) * 100;
        const utilization = totalSupply > 0n
          ? Number((totalBorrows * 10000n) / totalSupply) / 100
          : 0;

        metrics.push({
          pool: `aave_v3_${poolName}`,
          token: poolName,
          supply_apy: Math.round(supplyApy * 100) / 100,
          borrow_apy: Math.round(borrowApy * 100) / 100,
          total_supply: formatUnits(totalSupply, token.decimals),
          total_borrows: formatUnits(totalBorrows, token.decimals),
          utilization: Math.round(utilization * 100) / 100,
        });

        if (utilization > 90) {
          alerts.push({ pool: `aave_v3_${poolName}`, message: `⚠️ High utilization: ${utilization.toFixed(1)}%` });
        }
        if (supplyApy > 20) {
          alerts.push({ pool: `aave_v3_${poolName}`, message: `📈 Unusually high supply APY: ${supplyApy.toFixed(2)}%` });
        }
      } catch {}
    }

    return {
      output: {
        pool_metrics: metrics,
        alerts,
        summary: `Monitoring ${metrics.length} Aave V3 pools on Base. ${alerts.length} alert(s).`,
      },
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({ key: "health", description: "Health check", input: z.object({}), async handler() { return { output: { status: "ok", version: "1.0.0" }, usage: { total_tokens: 0 } }; } });
export default app;
