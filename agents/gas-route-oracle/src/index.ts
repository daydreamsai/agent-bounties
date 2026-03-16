import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

// Supported EVM chains with RPC endpoints
const CHAINS: Record<string, { name: string; rpc: string; symbol: string; coinGeckoId: string }> = {
  ethereum: {
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    symbol: "ETH",
    coinGeckoId: "ethereum",
  },
  arbitrum: {
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
    symbol: "ETH",
    coinGeckoId: "ethereum",
  },
  optimism: {
    name: "Optimism",
    rpc: "https://mainnet.optimism.io",
    symbol: "ETH",
    coinGeckoId: "ethereum",
  },
  base: {
    name: "Base",
    rpc: "https://mainnet.base.org",
    symbol: "ETH",
    coinGeckoId: "ethereum",
  },
  polygon: {
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    symbol: "MATIC",
    coinGeckoId: "matic-network",
  },
  bsc: {
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed1.binance.org",
    symbol: "BNB",
    coinGeckoId: "binancecoin",
  },
  avalanche: {
    name: "Avalanche C-Chain",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    symbol: "AVAX",
    coinGeckoId: "avalanche-2",
  },
};

interface GasEstimate {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: "low" | "medium" | "high";
  tip_hint: string;
}

async function getGasPrice(chainKey: string): Promise<{ gasPrice: bigint; baseFee: bigint } | null> {
  const chain = CHAINS[chainKey];
  if (!chain) return null;

  try {
    const res = await fetch(chain.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data.error) return null;

    const gasPrice = BigInt(data.result);

    // Try to get base fee from latest block
    let baseFee = gasPrice;
    try {
      const blockRes = await fetch(chain.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBlockByNumber",
          params: ["latest", false],
          id: 2,
        }),
      });
      const blockData = await blockRes.json();
      if (blockData.result?.baseFeePerGas) {
        baseFee = BigInt(blockData.result.baseFeePerGas);
      }
    } catch {
      // fallback to gasPrice
    }

    return { gasPrice, baseFee };
  } catch {
    return null;
  }
}

async function getUsdPrice(coinGeckoId: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`
    );
    const data = await res.json();
    return data[coinGeckoId]?.usd ?? 0;
  } catch {
    return 0;
  }
}

function classifyBusyLevel(gasPrice: bigint, baseFee: bigint): "low" | "medium" | "high" {
  const premium = gasPrice - baseFee;
  const premiumGwei = Number(premium) / 1e9;

  if (premiumGwei > 5) return "high";
  if (premiumGwei > 1.5) return "medium";
  return "low";
}

async function estimateGasForChain(
  chainKey: string,
  gasUnits: number,
  calldataBytes: number
): Promise<GasEstimate | null> {
  const chain = CHAINS[chainKey];
  if (!chain) return null;

  const gasData = await getGasPrice(chainKey);
  if (!gasData) return null;

  // Account for calldata cost (16 gas per non-zero byte, 4 per zero byte)
  const calldataGas = calldataBytes * 16;
  const totalGas = BigInt(gasUnits + calldataGas);

  const feeNative = (gasData.gasPrice * totalGas) / BigInt(10 ** 18);
  const feeNativeFloat = Number(gasData.gasPrice * totalGas) / 1e18;

  const usdPrice = await getUsdPrice(chain.coinGeckoId);
  const feeUsd = feeNativeFloat * usdPrice;

  const busyLevel = classifyBusyLevel(gasData.gasPrice, gasData.baseFee);

  // Suggest priority tip based on congestion
  const tipGwei = busyLevel === "high" ? 3 : busyLevel === "medium" ? 1.5 : 0.5;
  const tipNative = (tipGwei * gasUnits) / 1e9;

  return {
    chain: chain.name,
    fee_native: feeNativeFloat.toFixed(6),
    fee_usd: feeUsd.toFixed(2),
    busy_level: busyLevel,
    tip_hint: tipNative.toFixed(6),
  };
}

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for EVM transactions",
});

addEntrypoint({
  key: "estimate-gas",
  description: "Estimate gas costs across chains and return the cheapest option",
  input: z.object({
    chain_set: z.array(z.string()).describe("Chains to consider (e.g., ethereum, arbitrum, optimism, base, polygon, bsc, avalanche)"),
    calldata_size_bytes: z.number().int().min(0).describe("Size of calldata in bytes"),
    gas_units_est: z.number().int().positive().describe("Estimated gas units needed"),
  }),
  async handler({ input }) {
    const { chain_set, calldata_size_bytes, gas_units_est } = input;

    const estimates: GasEstimate[] = [];
    for (const chainKey of chain_set) {
      const est = await estimateGasForChain(chainKey, gas_units_est, calldata_size_bytes);
      if (est) estimates.push(est);
    }

    if (estimates.length === 0) {
      return {
        output: { error: "No gas data available for any requested chain" },
        usage: { total_tokens: 0 },
      };
    }

    // Find cheapest chain by USD fee
    estimates.sort((a, b) => parseFloat(a.fee_usd) - parseFloat(b.fee_usd));
    const best = estimates[0];

    return {
      output: {
        recommended: best,
        all_estimates: estimates,
      },
      usage: { total_tokens: estimates.length * 50 },
    };
  },
});

export default app;
