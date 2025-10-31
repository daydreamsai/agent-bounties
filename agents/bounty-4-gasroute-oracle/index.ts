import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for transactions",
});

const CHAIN_RPC_URLS: Record<string, string> = {
  ethereum: process.env.RPC_URL_ETHEREUM || "https://eth.llamarpc.com",
  polygon: process.env.RPC_URL_POLYGON || "https://polygon.llamarpc.com",
  arbitrum: process.env.RPC_URL_ARBITRUM || "https://arb1.arbitrum.io/rpc",
  optimism: process.env.RPC_URL_OPTIMISM || "https://mainnet.optimism.io",
  base: process.env.RPC_URL_BASE || "https://mainnet.base.org",
  bsc: process.env.RPC_URL_BSC || "https://bsc-dataseed1.binance.org",
  avalanche: process.env.RPC_URL_AVALANCHE || "https://api.avax.network/ext/bc/C/rpc",
  fantom: process.env.RPC_URL_FANTOM || "https://rpc.ftm.tools",
  celo: process.env.RPC_URL_CELO || "https://forno.celo.org",
};

// Native token prices in USD (would use oracle in production)
const NATIVE_TOKEN_PRICES: Record<string, number> = {
  ethereum: 3000,
  polygon: 0.8,
  arbitrum: 1.2,
  optimism: 1.5,
  base: 0.0001,
  bsc: 600,
  avalanche: 35,
  fantom: 0.4,
  celo: 0.8,
};

interface ChainFee {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: string;
  tip_hint: string;
}

async function getChainFee(
  chain: string,
  calldataSizeBytes: number,
  gasUnitsEst: number
): Promise<ChainFee | null> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain.toLowerCase()];
    if (!rpcUrl) {
      console.warn(`No RPC URL configured for chain: ${chain}`);
      return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const feeData = await provider.getFeeData();

    if (!feeData.gasPrice && !feeData.maxFeePerGas) {
      console.warn(`No fee data available for chain: ${chain}`);
      return null;
    }

    // Calculate total gas
    // Calldata gas: 4 gas per non-zero byte, 16 gas per zero byte
    const calldataGas = Math.ceil(calldataSizeBytes / 16) * 4; // Simplified
    const totalGas = gasUnitsEst + calldataGas;

    // Use gasPrice for legacy or maxFeePerGas for EIP-1559
    let baseFee: bigint;
    let priorityFee: bigint = BigInt(0);

    if (feeData.gasPrice) {
      baseFee = feeData.gasPrice;
    } else if (feeData.maxFeePerGas) {
      baseFee = feeData.maxFeePerGas;
      priorityFee = feeData.maxPriorityFeePerGas || BigInt(0);
    } else {
      return null;
    }

    const feeNative = baseFee * BigInt(totalGas) + (priorityFee * BigInt(totalGas));
    const feeNativeEth = Number(feeNative) / 1e18;
    const tokenPrice = NATIVE_TOKEN_PRICES[chain.toLowerCase()] || 1;
    const feeUsd = feeNativeEth * tokenPrice;

    // Determine busy level based on gas price
    const gasPriceGwei = Number(baseFee) / 1e9;
    let busyLevel = "low";
    if (gasPriceGwei > 100) {
      busyLevel = "high";
    } else if (gasPriceGwei > 50) {
      busyLevel = "medium";
    }

    // Suggest tip (priority fee) - typically 10-20% of base fee
    const tipHint = (baseFee / BigInt(10)).toString();

    return {
      chain,
      fee_native: feeNative.toString(),
      fee_usd: feeUsd.toFixed(6),
      busy_level: busyLevel,
      tip_hint: tipHint,
    };
  } catch (error) {
    console.error(`Error getting fee for ${chain}:`, error);
    return null;
  }
}

addEntrypoint({
  key: "find_cheapest_chain",
  description: "Return best chain and time estimate for given gas load",
  input: z.object({
    chain_set: z.array(z.string()).describe("Set of chains to consider"),
    calldata_size_bytes: z.number().int().describe("Size of calldata"),
    gas_units_est: z.number().int().describe("Estimated gas units needed"),
  }),
  async handler({ input }) {
    try {
      const fees: ChainFee[] = [];

      // Get fees for all chains in parallel
      const feePromises = input.chain_set.map(chain =>
        getChainFee(
          chain,
          input.calldata_size_bytes,
          input.gas_units_est
        )
      );

      const feeResults = await Promise.all(feePromises);
      
      for (const fee of feeResults) {
        if (fee) fees.push(fee);
      }

      if (fees.length === 0) {
        return {
          output: {
            error: "Could not fetch fees for any chain",
            chain: null,
            fee_native: "0",
            fee_usd: "0",
            busy_level: "unknown",
            tip_hint: "0",
          },
          usage: {
            total_tokens: 100,
          },
        };
      }

      // Find cheapest chain by USD fee
      fees.sort((a, b) => parseFloat(a.fee_usd) - parseFloat(b.fee_usd));
      const cheapest = fees[0];

      return {
        output: {
          chain: cheapest.chain,
          fee_native: cheapest.fee_native,
          fee_usd: cheapest.fee_usd,
          busy_level: cheapest.busy_level,
          tip_hint: cheapest.tip_hint,
          alternatives: fees.slice(1, 4), // Top 3 alternatives
          all_chains: fees, // All chains for comparison
        },
        usage: {
          total_tokens: JSON.stringify(fees).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          chain: null,
          fee_native: "0",
          fee_usd: "0",
          busy_level: "unknown",
          tip_hint: "0",
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
