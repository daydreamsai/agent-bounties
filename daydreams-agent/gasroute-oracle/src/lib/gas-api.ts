import { z } from "zod";

// Input schema for gas route query
export const GasInputSchema = z.object({
  chain_set: z.array(z.string()).min(1, "At least one chain required"),
  calldata_size_bytes: z.number().positive("Calldata size must be positive"),
  gas_units_est: z.number().positive("Gas units must be positive"),
});

// Output schema for gas route
export const GasRouteSchema = z.object({
  chain: z.string(),
  fee_native: z.number(),
  fee_usd: z.number(),
  busy_level: z.enum(["low", "medium", "high", "congested"]),
  tip_hint_gwei: z.number(),
});

// Output schema for complete response
export const GasResponseSchema = z.object({
  recommended_chain: z.string(),
  routes: z.array(GasRouteSchema),
});

// Simulated gas data (to be replaced with real API calls)
const MOCK_GAS_DATA: Record<string, any> = {
  ethereum: {
    base_fee_gwei: 25,
    tip_gwei: 2,
    eth_usd: 3200,
  },
  base: {
    base_fee_gwei: 0.5,
    tip_gwei: 0.1,
    eth_usd: 3200,
  },
  arbitrum: {
    base_fee_gwei: 0.1,
    tip_gwei: 0.01,
    eth_usd: 3200,
  },
  optimism: {
    base_fee_gwei: 0.2,
    tip_gwei: 0.05,
    eth_usd: 3200,
  },
  polygon: {
    base_fee_gwei: 30,
    tip_gwei: 20,
    eth_usd: 3200,
  },
};

/**
 * Get gas cost estimates for a given transaction across multiple chains
 * @param chain_set Set of chains to consider
 * @param calldata_size_bytes Size of calldata in bytes
 * @param gas_units_est Estimated gas units needed
 * @returns Array of gas routes with fees and timing
 */
export async function getGasRoutes(
  chain_set: string[],
  calldata_size_bytes: number,
  gas_units_est: number
): Promise<any[]> {
  // In production, this would call real gas oracles:
  // - Etherscan Gas Tracker: https://etherscan.io/gastracker
  // - Base Gas Oracle: https://docs.base.org/gas-fees
  // - Arbitrum Gas Price Oracle: https://docs.arbitrum.io/gas-tradeoff
  // - Polygon Gas Station: https://gasstation polygon.com

  const routes: any[] = [];

  for (const chain of chain_set) {
    const chainData = MOCK_GAS_DATA[chain.toLowerCase()];
    if (!chainData) continue;

    // Calculate gas cost: (base_fee + tip) * (gas_units + calldata_overhead)
    const calldata_overhead = Math.ceil(calldata_size_bytes / 32) * 16; // ~16 gas per calldata byte
    const total_gas = gas_units_est + calldata_overhead;

    const base_fee = chainData.base_fee_gwei;
    const tip = chainData.tip_gwei;
    const eth_price = chainData.eth_usd;

    // Convert gwei to ETH
    const fee_eth = (base_fee + tip) * total_gas * 1e-9;
    const fee_usd = fee_eth * eth_price;

    // Determine busy level (simplified)
    let busy_level: "low" | "medium" | "high" | "congested" = "low";
    if (base_fee > 50) busy_level = "congested";
    else if (base_fee > 20) busy_level = "high";
    else if (base_fee > 5) busy_level = "medium";

    routes.push({
      chain,
      fee_native: fee_eth,
      fee_usd: parseFloat(fee_usd.toFixed(2)),
      busy_level,
      tip_hint_gwei: tip,
    });
  }

  // Sort by fee_usd ascending
  routes.sort((a, b) => a.fee_usd - b.fee_usd);

  return routes;
}
