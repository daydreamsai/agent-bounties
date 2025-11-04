import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "Expected a 0x-prefixed 20-byte address.",
  });

export const poolConfigSchema = z.object({
  id: z
    .string()
    .min(1, { message: "Pool id must be a non-empty string." })
    .describe("Human readable pool identifier."),
  protocolId: z
    .string()
    .min(1, { message: "Protocol id must be provided." })
    .describe("Identifier for the underlying protocol."),
  chainId: z
    .number()
    .int()
    .positive({ message: "Chain id must be a positive integer." }),
  address: addressSchema.describe("Primary contract address for the pool."),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional bag for protocol specific parameters (e.g. market ids, gauges)."
    ),
});

const changeSchema = z.object({
  type: z
    .enum(["percent", "absolute"])
    .describe("How to evaluate the rule (percentage vs absolute change)."),
  direction: z
    .enum(["increase", "decrease", "both"])
    .default("both")
    .describe("Direction in which the change should trigger."),
  amount: z.number().positive({ message: "Change amount must be positive." }),
});

const windowSchema = z.object({
  type: z
    .enum(["blocks", "minutes"])
    .default("blocks")
    .describe("Lookback window type. Blocks for on-chain precision."),
  value: z
    .number()
    .int()
    .positive({ message: "Window value must be positive." })
    .default(1),
});

export const thresholdRuleSchema = z.object({
  id: z
    .string()
    .min(1, { message: "Rule id must be a non-empty string." })
    .describe("Unique identifier for this rule."),
  metric: z.enum(["tvl", "apy"]).describe("Metric to evaluate."),
  change: changeSchema,
  window: windowSchema,
  appliesTo: z
    .object({
      protocolIds: z.array(z.string()).optional(),
      poolIds: z.array(z.string()).optional(),
    })
    .optional()
    .describe(
      "Optional scoping for the rule. Defaults to all configured pools."
    ),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const watcherConfigSchema = z.object({
  protocolIds: z
    .array(z.string())
    .nonempty({ message: "Provide at least one protocol id." }),
  pools: z
    .array(poolConfigSchema)
    .nonempty({ message: "Configure at least one pool to monitor." }),
  thresholdRules: z
    .array(thresholdRuleSchema)
    .nonempty({
      message: "At least one threshold rule is required for alerting.",
    }),
  pollingIntervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional override for the polling cadence in milliseconds."),
});

export type PoolConfig = z.infer<typeof poolConfigSchema>;
export type ThresholdRule = z.infer<typeof thresholdRuleSchema>;
export type WatcherConfig = z.infer<typeof watcherConfigSchema>;
export type WatcherConfigInput = z.input<typeof watcherConfigSchema>;
