import { z } from "zod";

// Input schema for bridge route query
export const BridgeInputSchema = z.object({
  token: z.string().min(1, "Token symbol required (e.g., USDC, ETH)"),
  amount: z.number().positive("Amount must be positive"),
  from_chain: z.string().min(1, "Source chain required (e.g., ethereum, base)"),
  to_chain: z.string().min(1, "Destination chain required (e.g., optimism, arbitrum)"),
});

// Output schema for bridge route
export const BridgeRouteSchema = z.object({
  name: z.string(),
  fee_usd: z.number(),
  eta_minutes: z.number(),
  requirements: z.array(z.string()).optional(),
});

// Output schema for complete response
export const BridgeResponseSchema = z.object({
  routes: z.array(BridgeRouteSchema),
});

// Example mock data (to be replaced with real API calls)
const MOCK_BRIDGE_DATA: Record<string, any[]> = {
  "USDC-ethereum-base": [
    {
      name: "Optimism Bridge",
      fee_usd: 1.5,
      eta_minutes: 15,
      requirements: ["USDC on Ethereum", "ETH for gas on Base"],
    },
    {
      name: "Stargate Bridge",
      fee_usd: 0.8,
      eta_minutes: 20,
      requirements: ["USDC on Ethereum", "ETH for gas on Base"],
    },
  ],
  "ETH-ethereum-base": [
    {
      name: "Ethereum Bridge",
      fee_usd: 5.0,
      eta_minutes: 10,
      requirements: ["ETH on Ethereum", "ETH for gas on Base"],
    },
  ],
};

/**
 * Get bridge routes for a given token and chain pair
 * @param token Token symbol (e.g., USDC, ETH)
 * @param amount Amount to bridge
 * @param from_chain Source chain (e.g., ethereum, base)
 * @param to_chain Destination chain (e.g., optimism, arbitrum)
 * @returns Array of bridge routes with fees and timing
 */
export async function getBridgeRoutes(
  token: string,
  amount: number,
  from_chain: string,
  to_chain: string
): Promise<any[]> {
  // In production, this would call real bridge APIs:
  // - AllBridge API: https://api.allbridge.io
  // - Stargate Finance API: https://docs.stargate.finance
  // - LayerZero Oracle: https://layerzero.gitbook.io/docs
  // - Squid Router API: https://docs.squidrouter.com

  // For now, return mock data
  const key = `${token.toUpperCase()}-${from_chain}-${to_chain}`;
  const routes = MOCK_BRIDGE_DATA[key] || [
    {
      name: "Custom Route",
      fee_usd: 2.0,
      eta_minutes: 30,
      requirements: ["Cross-chain bridge support", "Gas on destination chain"],
    },
  ];

  return routes.map((route) => ({
    ...route,
    fee_usd: route.fee_usd * (amount > 1000 ? 0.9 : 1.0), // Bulk discount
  }));
}
