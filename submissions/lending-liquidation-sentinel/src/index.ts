import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { monitorPositions, checkHealth } from "./logic.js";

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "lending-liquidation-sentinel",
    version: "1.0.0",
    description: "Monitor lending positions and warn before liquidation",
  },
  {
    payments: {
      payTo: process.env.ADDRESS as `0x${string}`,
      network: (process.env.NETWORK as any) || "base-sepolia",
      defaultPrice: process.env.DEFAULT_PRICE || "1000",
    } as any,
  },
);

// ---------------------------------------------------------------------------
// Entrypoints
// ---------------------------------------------------------------------------

addEntrypoint({
  key: "monitor",
  description:
    "Monitor all lending positions for a wallet. Returns health factor, liquidation price, buffer percentage, and alert status across specified protocols.",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor (0x...)"),
    protocol_ids: z
      .array(z.string())
      .optional()
      .describe(
        'Lending protocols to check, e.g. ["aave_v3", "aave_v3_ethereum"]. Defaults to ["aave_v3"] (Base).',
      ),
    positions: z
      .array(
        z.object({
          asset: z.string().optional().describe("Asset address to track"),
          protocol_id: z
            .string()
            .optional()
            .describe("Protocol for this position"),
        }),
      )
      .optional()
      .describe("Specific positions to track"),
    alert_threshold: z
      .number()
      .optional()
      .describe(
        "Health factor threshold that triggers an alert. Default: 1.5",
      ),
  }) as any,
  async handler({ input }: { input: any }) {
    const result = await monitorPositions({
      wallet: input.wallet,
      protocol_ids: input.protocol_ids,
      positions: input.positions,
      alert_threshold: input.alert_threshold,
    });

    return {
      output: result,
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({
  key: "health",
  description:
    "Quick health factor check for a single wallet on a single protocol. Returns current risk level and liquidation metrics.",
  input: z.object({
    wallet: z.string().describe("Wallet address to check (0x...)"),
    protocol_id: z
      .string()
      .optional()
      .describe('Protocol to query. Default: "aave_v3" (Base).'),
    alert_threshold: z
      .number()
      .optional()
      .describe(
        "Health factor threshold that triggers an alert. Default: 1.5",
      ),
  }) as any,
  async handler({ input }: { input: any }) {
    const result = await checkHealth(
      input.wallet,
      input.protocol_id ?? "aave_v3",
      input.alert_threshold ?? 1.5,
    );

    return {
      output: result,
      usage: { total_tokens: 1 },
    };
  },
});

export default app;
