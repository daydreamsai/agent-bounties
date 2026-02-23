import {
  createPublicClient,
  http,
  formatEther,
  formatGwei,
  parseAbi,
  type PublicClient,
  type Chain,
} from "viem";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
} from "viem/chains";

// ---------------------------------------------------------------------------
// Chain configuration
// ---------------------------------------------------------------------------

interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  isL2: boolean;
  /** L2s that post calldata to L1 (base, optimism) need a separate data fee */
  hasL1DataFee: boolean;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    chain: mainnet,
    rpcUrl: "https://1rpc.io/eth",
    isL2: false,
    hasL1DataFee: false,
  },
  base: {
    chain: base,
    rpcUrl: "https://mainnet.base.org",
    isL2: true,
    hasL1DataFee: true,
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    isL2: true,
    hasL1DataFee: false, // Arbitrum folds L1 data cost into its gas price
  },
  optimism: {
    chain: optimism,
    rpcUrl: "https://mainnet.optimism.io",
    isL2: true,
    hasL1DataFee: true,
  },
};

// ---------------------------------------------------------------------------
// GasPriceOracle precompile (OP Stack: Base & Optimism)
// ---------------------------------------------------------------------------

const GAS_PRICE_ORACLE_ADDRESS =
  "0x420000000000000000000000000000000000000F" as const;

const GAS_PRICE_ORACLE_ABI = parseAbi([
  "function getL1Fee(bytes) view returns (uint256)",
]);

// ---------------------------------------------------------------------------
// ETH price cache
// ---------------------------------------------------------------------------

let cachedEthPrice: { usd: number; fetchedAt: number } | null = null;
const ETH_PRICE_CACHE_TTL_MS = 60_000; // 60 seconds
const ETH_PRICE_FALLBACK = 3000;

async function getEthPriceUsd(): Promise<number> {
  if (
    cachedEthPrice &&
    Date.now() - cachedEthPrice.fetchedAt < ETH_PRICE_CACHE_TTL_MS
  ) {
    return cachedEthPrice.usd;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }

    const data = (await res.json()) as { ethereum?: { usd?: number } };
    const price = data?.ethereum?.usd;

    if (typeof price !== "number" || price <= 0) {
      throw new Error("Invalid price data from CoinGecko");
    }

    cachedEthPrice = { usd: price, fetchedAt: Date.now() };
    return price;
  } catch {
    // Return cached value if available, otherwise fallback
    if (cachedEthPrice) {
      return cachedEthPrice.usd;
    }
    return ETH_PRICE_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Busy-level classification
// ---------------------------------------------------------------------------

type BusyLevel = "low" | "medium" | "high" | "extreme";

function classifyBusy(gasPriceWei: bigint, isL2: boolean): BusyLevel {
  const gweiFloat = Number(formatGwei(gasPriceWei));

  if (isL2) {
    if (gweiFloat < 0.05) return "low";
    if (gweiFloat < 0.1) return "medium";
    if (gweiFloat < 0.5) return "high";
    return "extreme";
  }

  // Ethereum L1
  if (gweiFloat < 20) return "low";
  if (gweiFloat < 50) return "medium";
  if (gweiFloat < 100) return "high";
  return "extreme";
}

// ---------------------------------------------------------------------------
// Per-chain estimation
// ---------------------------------------------------------------------------

interface ChainEstimate {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: BusyLevel;
  tip_hint: string;
  gas_price_gwei: string;
  base_fee_gwei: string;
  l1_data_fee?: string;
  /** Raw total fee in wei for sorting */
  _totalFeeWei: bigint;
}

async function estimateForChain(
  chainName: string,
  calldataSizeBytes: number,
  gasUnitsEst: number,
  ethPriceUsd: number
): Promise<ChainEstimate | null> {
  const cfg = CHAIN_CONFIGS[chainName];
  if (!cfg) {
    console.warn(`[gas-oracle] Unknown chain: ${chainName}, skipping`);
    return null;
  }

  let client: PublicClient;
  try {
    client = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpcUrl, { timeout: 10_000 }),
    });
  } catch (err) {
    console.error(`[gas-oracle] Failed to create client for ${chainName}:`, err);
    return null;
  }

  try {
    // Fetch gas data concurrently
    const [gasPrice, block, priorityFee] = await Promise.all([
      client.getGasPrice(),
      client.getBlock({ blockTag: "latest" }),
      client
        .estimateMaxPriorityFeePerGas()
        .catch(() => {
          // Many L2s don't support this; default to 1 gwei
          return BigInt(1_000_000_000);
        }),
    ]);

    const baseFee = block.baseFeePerGas ?? gasPrice;
    const gasUnits = BigInt(gasUnitsEst);

    // Execution fee
    const executionFee = gasPrice * gasUnits;

    // L1 data fee (Base, Optimism)
    let l1DataFee = 0n;
    if (cfg.hasL1DataFee && calldataSizeBytes > 0) {
      l1DataFee = await fetchL1DataFee(
        client,
        calldataSizeBytes,
        baseFee
      );
    }

    const totalFee = executionFee + l1DataFee;

    // Convert to human-readable values
    const feeNative = formatEther(totalFee);
    const feeUsdNum = parseFloat(feeNative) * ethPriceUsd;
    const feeUsd = feeUsdNum.toFixed(4);

    const busyLevel = classifyBusy(gasPrice, cfg.isL2);
    const tipHint = formatGwei(priorityFee);

    const result: ChainEstimate = {
      chain: chainName,
      fee_native: feeNative,
      fee_usd: feeUsd,
      busy_level: busyLevel,
      tip_hint: tipHint,
      gas_price_gwei: formatGwei(gasPrice),
      base_fee_gwei: formatGwei(baseFee),
      _totalFeeWei: totalFee,
    };

    if (cfg.hasL1DataFee) {
      result.l1_data_fee = formatEther(l1DataFee);
    }

    return result;
  } catch (err) {
    console.error(`[gas-oracle] RPC error for ${chainName}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// L1 data fee estimation (OP Stack)
// ---------------------------------------------------------------------------

async function fetchL1DataFee(
  client: PublicClient,
  calldataSizeBytes: number,
  _baseFee: bigint
): Promise<bigint> {
  // Build synthetic calldata of the given size
  const syntheticCalldata = ("0x" +
    "ff".repeat(calldataSizeBytes)) as `0x${string}`;

  try {
    const fee = await client.readContract({
      address: GAS_PRICE_ORACLE_ADDRESS,
      abi: GAS_PRICE_ORACLE_ABI,
      functionName: "getL1Fee",
      args: [syntheticCalldata],
    });
    return fee;
  } catch {
    // Fallback: conservative estimate
    // Non-zero calldata bytes cost 16 gas on L1, assume 30 gwei L1 base fee
    const l1GasPerByte = 16n;
    const conservativeL1BaseFee = 30_000_000_000n; // 30 gwei in wei
    return BigInt(calldataSizeBytes) * l1GasPerByte * conservativeL1BaseFee;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface GasRouteInput {
  chain_set: string[];
  calldata_size_bytes: number;
  gas_units_est: number;
}

export interface ChainBreakdown {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: string;
  tip_hint: string;
  gas_price_gwei: string;
  base_fee_gwei: string;
  l1_data_fee?: string;
}

export interface GasRouteOutput {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: string;
  tip_hint: string;
  all_chains: ChainBreakdown[];
}

export async function estimateGasRoutes(
  input: GasRouteInput
): Promise<GasRouteOutput> {
  const { chain_set, calldata_size_bytes, gas_units_est } = input;

  if (!chain_set.length) {
    throw new Error("chain_set must contain at least one chain");
  }

  // Fetch ETH price once for the entire batch
  const ethPriceUsd = await getEthPriceUsd();

  // Estimate all chains concurrently
  const results = await Promise.all(
    chain_set.map((c) =>
      estimateForChain(
        c.toLowerCase().trim(),
        calldata_size_bytes,
        gas_units_est,
        ethPriceUsd
      )
    )
  );

  // Filter out failed chains
  const successful = results.filter(
    (r): r is ChainEstimate => r !== null
  );

  if (successful.length === 0) {
    throw new Error(
      `All chains failed RPC queries. Tried: ${chain_set.join(", ")}`
    );
  }

  // Sort by total fee ascending (cheapest first)
  successful.sort((a, b) => {
    if (a._totalFeeWei < b._totalFeeWei) return -1;
    if (a._totalFeeWei > b._totalFeeWei) return 1;
    return 0;
  });

  const cheapest = successful[0];

  // Strip internal _totalFeeWei from output
  const allChains: ChainBreakdown[] = successful.map(
    ({ _totalFeeWei, ...rest }) => rest
  );

  return {
    chain: cheapest.chain,
    fee_native: cheapest.fee_native,
    fee_usd: cheapest.fee_usd,
    busy_level: cheapest.busy_level,
    tip_hint: cheapest.tip_hint,
    all_chains: allChains,
  };
}
