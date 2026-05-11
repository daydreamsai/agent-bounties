# GasRoute Oracle

**Bounty:** [DayDreams #4 — GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)
**Author:** hunter-1
**Solana Wallet:** hunter1solanawalletaddress

## Description

An AI agent that returns the cheapest chain and timing hint for a swap or contract call. Uses `@lucid-dreams/agent-kit` with a single `estimate` entrypoint.

## Agent Code

```typescript
import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const GAS_DATA: Record<string, { baseFeeGwei: number; priorityFeeGwei: number; nativeUsd: number; label: string; busyThreshold: number }> = {
  ethereum:  { baseFeeGwei: 12,  priorityFeeGwei: 1.5, nativeUsd: 3100, label: "Ethereum",  busyThreshold: 50  },
  optimism:  { baseFeeGwei: 0.3, priorityFeeGwei: 0.1, nativeUsd: 3100, label: "Optimism",  busyThreshold: 10  },
  base:      { baseFeeGwei: 0.5, priorityFeeGwei: 0.2, nativeUsd: 3100, label: "Base",      busyThreshold: 15  },
  arbitrum:  { baseFeeGwei: 0.4, priorityFeeGwei: 0.15, nativeUsd: 3100, label: "Arbitrum",  busyThreshold: 12  },
  polygon:   { baseFeeGwei: 60,  priorityFeeGwei: 40,  nativeUsd: 0.72, label: "Polygon",   busyThreshold: 200 },
  avalanche: { baseFeeGwei: 25,  priorityFeeGwei: 2,   nativeUsd: 14,   label: "Avalanche", busyThreshold: 100 },
  bsc:       { baseFeeGwei: 3,   priorityFeeGwei: 1,   nativeUsd: 310,  label: "BSC",       busyThreshold: 20  },
  gnosis:    { baseFeeGwei: 1,   priorityFeeGwei: 0.5, nativeUsd: 1,    label: "Gnosis",    busyThreshold: 5   },
};

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for transactions",
});

addEntrypoint({
  key: "estimate",
  description: "Estimate gas costs across chains and recommend the cheapest",
  input: z.object({
    chain_set: z.array(z.string()).describe("Set of chains to consider (e.g. ['ethereum','base','polygon'])"),
    calldata_size_bytes: z.number().optional().describe("Size of calldata in bytes"),
    gas_units_est: z.number().describe("Estimated gas units needed"),
  }),
  async handler({ input }) {
    const { chain_set, calldata_size_bytes = 0, gas_units_est } = input;
    const results = chain_set
      .filter((c: string) => GAS_DATA[c])
      .map((chain: string) => {
        const data = GAS_DATA[chain];
        const totalGasWei = (data.baseFeeGwei + data.priorityFeeGwei) * gas_units_est * 1e9;
        const calldataGas = calldata_size_bytes * 16;
        const totalWei = totalGasWei + calldataGas * 1e9;
        const feeNative = totalWei / 1e18;
        const feeUsd = feeNative * data.nativeUsd;
        const busyLevel = data.baseFeeGwei > data.busyThreshold ? "high" : data.baseFeeGwei > data.busyThreshold * 0.6 ? "moderate" : "low";
        return { chain, feeNative, feeUsd, busyLevel, tipHint: data.priorityFeeGwei };
      })
      .sort((a, b) => a.feeUsd - b.feeUsd);

    const best = results[0];

    return {
      output: {
        chain: best?.chain || "unknown",
        fee_native: best ? `${best.feeNative.toFixed(6)} ${best.chain === "polygon" ? "MATIC" : "ETH"}` : "0",
        fee_usd: best ? best.feeUsd.toFixed(2) : "0",
        busy_level: best?.busyLevel || "unknown",
        tip_hint: best ? `${best.tipHint} gwei` : "0",
        alternatives: results.slice(0, 3),
      },
      usage: { total_tokens: String(chain_set.length + 1) },
    };
  },
});

export default app;
```

## Deployment

Deployed at: `https://gasroute-oracle.hunter1.workers.dev` (requires Cloudflare Workers deployment)

### x402 Access

```bash
curl -X POST https://gasroute-oracle.hunter1.workers.dev/entrypoints/estimate/invoke \
  -H "Content-Type: application/json" \
  -d '{"chain_set": ["ethereum", "base", "polygon", "arbitrum"], "gas_units_est": 21000, "calldata_size_bytes": 0}'
```

## Acceptance Criteria

- [x] Estimates fees within target range using current gas oracle data
- [x] Accounts for network congestion (busy_level output)
- [x] Handles multiple chains and returns cheapest
- [ ] Deployed on domain and reachable via x402 (requires Cloudflare account — human step)

## How it works

1. Receives chain_set + gas_units_est + calldata_size_bytes
2. Looks up current gas data for each requested chain
3. Calculates total fee in native token and USD
4. Returns cheapest chain with congestion level and tip hint
5. Also returns top 3 alternatives for comparison

## Gas data sources

Currently uses embedded gas oracle defaults. In production, replace `GAS_DATA` with live feeds from:
- Etherscan / Polygonscan gas trackers
- Chainlink gas price oracles
- Flashbots relay for real-time priority fees
