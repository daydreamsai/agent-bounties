import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { createPublicClient, http, formatUnits } from "viem";
import { mainnet } from "viem/chains";

/* ─── Uniswap V2 Pair ABI (minimal) ─── */
const UNISWAP_V2_PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint112", internalType: "uint112" },
      { name: "_reserve1", type: "uint112", internalType: "uint112" },
      { name: "_blockTimestampLast", type: "uint32", internalType: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* ─── Input schema ─── */
const InputSchema = z.object({
  pool_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("Uniswap V2 pool (pair) contract address"),
  token_weights: z.object({
    token0_pct: z
      .number()
      .min(0)
      .max(100)
      .describe("Percentage weight of token0 in the LP position"),
    token1_pct: z
      .number()
      .min(0)
      .max(100)
      .describe("Percentage weight of token1 in the LP position"),
  }),
  deposit_amounts: z.object({
    amount0: z
      .string()
      .describe("Raw (non-decimal) amount of token0 deposited"),
    amount1: z
      .string()
      .describe("Raw (non-decimal) amount of token1 deposited"),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .describe("Number of decimals for both tokens (assumes same or uses median)"),
  }),
  window_hours: z
    .number()
    .int()
    .positive()
    .max(8760)
    .describe("Historical lookback window in hours (max 1 year)"),
});

/* ─── Output schema ─── */
const OutputSchema = z.object({
  IL_percent: z
    .number()
    .describe("Impermanent Loss as a percentage (negative = loss, positive = gain)"),
  fee_apr_est: z
    .number()
    .describe("Estimated annualised fee APR percentage based on window volume"),
  volume_window: z
    .string()
    .describe("Estimated total trading volume in the window (in USD equivalent)"),
  notes: z
    .array(z.string())
    .describe("Contextual notes and warnings about the estimate"),
});

/* ─── Types ─── */
type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

/* ─── Helper: fetch reserves at a specific block ─── */
async function fetchReserves(
  client: ReturnType<typeof createPublicClient>,
  pairAddress: `0x${string}`,
  blockNumber?: bigint,
): Promise<{ reserve0: bigint; reserve1: bigint; timestamp: number }> {
  const [reserve0, reserve1, timestamp] = (await client.readContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "getReserves",
    blockNumber,
  })) as [bigint, bigint, bigint];

  return {
    reserve0,
    reserve1,
    timestamp: Number(timestamp),
  };
}

/* ─── Helper: fetch token addresses ─── */
async function fetchTokenAddresses(
  client: ReturnType<typeof createPublicClient>,
  pairAddress: `0x${string}`,
): Promise<{ token0: `0x${string}`; token1: `0x${string}` }> {
  const token0 = await client.readContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "token0",
  });
  const token1 = await client.readContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "token1",
  });
  return { token0: token0 as `0x${string}`, token1: token1 as `0x${string}` };
}

/* ─── Core: Impermanent Loss formula ─── */
function computeIL(priceRatio: number): number {
  if (priceRatio <= 0) return -100; // degenerate case
  if (Math.abs(priceRatio - 1) < 1e-12) return 0;
  const sqrtR = Math.sqrt(priceRatio);
  return (2 * sqrtR) / (1 + priceRatio) - 1;
}

/* ─── Agent handler ─── */
async function estimateILHandler(input: Input): Promise<Output> {
  const notes: string[] = [];
  const poolAddress = input.pool_address as `0x${string}`;

  // ── 1. Set up viem client ────────────────────────────────────────
  const rpcUrl = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  // ── 2. Resolve tokens ─────────────────────────────────────────────
  let token0: `0x${string}`, token1: `0x${string}`;
  try {
    ({ token0, token1 } = await fetchTokenAddresses(client, poolAddress));
    notes.push(`Token0: ${token0}, Token1: ${token1}`);
  } catch {
    return {
      IL_percent: 0,
      fee_apr_est: 0,
      volume_window: "0",
      notes: [
        "Failed to read token addresses from pool contract.",
        "Check that pool_address is a valid Uniswap V2 pair on mainnet.",
      ],
    };
  }

  // ── 3. Determine block range for the window ───────────────────────
  const currentBlock = await client.getBlockNumber();
  const avgSecondsPerBlock = 12; // Ethereum ~12s
  const blocksInWindow = BigInt(Math.round((input.window_hours * 3600) / avgSecondsPerBlock));

  const endBlock = currentBlock;
  const startBlock = currentBlock - blocksInWindow;

  const startBlockNum = startBlock > 0n ? startBlock : 1n;
  const actualWindowBlocks = Number(endBlock - startBlockNum);
  const actualWindowHours = (actualWindowBlocks * avgSecondsPerBlock) / 3600;

  if (actualWindowHours < 0.5) {
    notes.push(
      "Window is very short (< 30 min of blocks). IL estimates may be unreliable.",
    );
  }

  notes.push(
    `Querying reserves from block ${startBlockNum} to ${endBlock} (~${actualWindowHours.toFixed(1)}h window)`,
  );

  // ── 4. Fetch reserves at start and end ────────────────────────────
  let reservesEnd: { reserve0: bigint; reserve1: bigint; timestamp: number };
  let reservesStart: { reserve0: bigint; reserve1: bigint; timestamp: number };

  try {
    [reservesEnd, reservesStart] = await Promise.all([
      fetchReserves(client, poolAddress, endBlock),
      fetchReserves(client, poolAddress, startBlockNum),
    ]);
  } catch (err) {
    return {
      IL_percent: 0,
      fee_apr_est: 0,
      volume_window: "0",
      notes: [
        `Failed to fetch reserves: ${err instanceof Error ? err.message : String(err)}`,
        "Ensure the RPC endpoint supports archival queries for historical blocks.",
        "Try a different RPC via the ETH_RPC_URL environment variable.",
      ],
    };
  }

  const r0s = Number(formatUnits(reservesStart.reserve0, input.deposit_amounts.decimals));
  const r1s = Number(formatUnits(reservesStart.reserve1, input.deposit_amounts.decimals));
  const r0e = Number(formatUnits(reservesEnd.reserve0, input.deposit_amounts.decimals));
  const r1e = Number(formatUnits(reservesEnd.reserve1, input.deposit_amounts.decimals));

  // ── 5. Check liquidity ──────────────────────────────────────────────
  if (r0s < 0.001 || r1s < 0.001 || r0e < 0.001 || r1e < 0.001) {
    notes.push("WARNING: Very low liquidity in pool. IL and fee estimates may be unreliable.");
  }
  notes.push(
    `Reserves (start): ${r0s.toFixed(4)} / ${r1s.toFixed(4)}`,
  );
  notes.push(
    `Reserves (end):   ${r0e.toFixed(4)} / ${r1e.toFixed(4)}`,
  );

  // ── 6. Compute price ratio from reserve ratios ──────────────────────
  // price of token1 in terms of token0 = reserve0 / reserve1
  const priceStart = r0s / r1s;
  const priceEnd = r0e / r1e;

  const priceRatio = priceEnd / priceStart; // r = p_new / p_old
  notes.push(
    `Price ratio (r = p_end / p_start): ${priceRatio.toFixed(6)}`,
  );

  // ── 7. Impermanent Loss ────────────────────────────────────────────
  const IL = computeIL(priceRatio);
  const ILPercent = parseFloat((IL * 100).toFixed(4));
  notes.push(
    `Impermanent Loss: ${ILPercent >= 0 ? "+" : ""}${ILPercent.toFixed(4)}%`,
  );

  // ── 8. Estimate fee APR from reserve changes ───────────────────────
  // Volume estimation:
  //   Δreserve0 = |r0e - r0s|,  Δreserve1 = |r1e - r1s|
  //   Average price ≈ (priceStart + priceEnd) / 2
  //   volume_in_token0_terms ≈ Δreserve0 + Δreserve1 / avgPrice
  const dR0 = Math.abs(r0e - r0s);
  const dR1 = Math.abs(r1e - r1s);
  const avgPrice = (priceStart + priceEnd) / 2;

  // Volume expressed in token0-equivalent
  const volumeToken0 = dR0 + dR1 / avgPrice;

  // Uniswap V2 fee rate = 0.3%
  const feeRate = 0.003;
  const feesCollectedToken0 = volumeToken0 * feeRate;

  // Total value locked in token0-equivalent (average)
  const tvlToken0Start = r0s + r1s / priceStart;
  const tvlToken0End = r0e + r1e / priceEnd;
  const tvlToken0Avg = (tvlToken0Start + tvlToken0End) / 2;

  // Annualize the fee APR
  const windowDays = actualWindowHours / 24;
  const feeAPR =
    tvlToken0Avg > 0
      ? ((feesCollectedToken0 / tvlToken0Avg) * (365 / windowDays)) * 100
      : 0;

  const feeAPREst = parseFloat(feeAPR.toFixed(4));

  // Volume string (in approximate USD — using $1 per token0 as relative unit)
  // Without an oracle price, we report token0-equivalent volume
  const volumeStr =
    volumeToken0 > 1_000_000
      ? `${(volumeToken0 / 1_000_000).toFixed(2)}M (token0-equiv)`
      : volumeToken0 > 1_000
        ? `${(volumeToken0 / 1_000).toFixed(2)}K (token0-equiv)`
        : `${volumeToken0.toFixed(4)} (token0-equiv)`;

  // ── 9. Build output ────────────────────────────────────────────────
  return {
    IL_percent: ILPercent,
    fee_apr_est: feeAPREst,
    volume_window: volumeStr,
    notes,
  };
}

/* ─── Create and export the agent app ─── */
const agent = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  description:
    "Estimates impermanent loss and fee APR for any Uniswap V2 LP position over a historical window. " +
    "Queries on-chain reserves via viem, computes IL using the standard AMM formula, and estimates " +
    "fee APR from cumulative volume changes.",
  entrypoints: {
    "estimate-il": {
      input: InputSchema,
      output: OutputSchema,
      handler: estimateILHandler,
    },
  },
});

export default agent;
export { estimateILHandler, computeIL, InputSchema, OutputSchema };
