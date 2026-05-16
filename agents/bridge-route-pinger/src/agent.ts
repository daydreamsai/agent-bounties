import {
  type PingBridgeInput,
  type PingBridgeOutput,
  type BridgeRoute,
  type BridgeProtocol,
  type ChainId,
  CHAIN_LATENCY,
} from "./types";

/**
 * Bridge metadata: which chains are supported, fee models, and base latency.
 */
interface BridgeMeta {
  name: BridgeProtocol;
  supportedChains: ChainId[];
  baseFeeUsd: number;
  feeRate: number; // Per unit of amount
  baseLatencyMs: number;
  minAmount: number;
  maxAmount: number;
  requirements: string[];
}

const BRIDGE_META: BridgeMeta[] = [
  {
    name: "stargate",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "scroll", "linea", "mantle",
    ],
    baseFeeUsd: 1.5,
    feeRate: 0.0006,
    baseLatencyMs: 60_000,
    minAmount: 10,
    maxAmount: 2_000_000,
    requirements: ["Native gas on destination chain"],
  },
  {
    name: "across",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "zksync", "scroll", "linea",
    ],
    baseFeeUsd: 0.5,
    feeRate: 0.0003,
    baseLatencyMs: 30_000,
    minAmount: 1,
    maxAmount: 5_000_000,
    requirements: ["No additional gas required on destination"],
  },
  {
    name: "hop_protocol",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon", "gnosis",
    ],
    baseFeeUsd: 2.0,
    feeRate: 0.001,
    baseLatencyMs: 120_000,
    minAmount: 50,
    maxAmount: 500_000,
    requirements: ["Bonder liquidity required", "Native gas on destination"],
  },
  {
    name: "synapse",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "gnosis", "scroll",
    ],
    baseFeeUsd: 1.0,
    feeRate: 0.0005,
    baseLatencyMs: 90_000,
    minAmount: 20,
    maxAmount: 1_000_000,
    requirements: ["Native gas on destination chain"],
  },
  {
    name: "connext",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "gnosis", "zksync", "scroll", "linea",
    ],
    baseFeeUsd: 0.8,
    feeRate: 0.0004,
    baseLatencyMs: 45_000,
    minAmount: 5,
    maxAmount: 3_000_000,
    requirements: ["Router liquidity required"],
  },
  {
    name: "wormhole",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "zksync", "scroll",
    ],
    baseFeeUsd: 0.3,
    feeRate: 0.0001,
    baseLatencyMs: 30_000,
    minAmount: 1,
    maxAmount: 10_000_000,
    requirements: ["Relayer must be funded"],
  },
  {
    name: "layerzero",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "zksync", "scroll", "linea", "mantle",
    ],
    baseFeeUsd: 0.4,
    feeRate: 0.0002,
    baseLatencyMs: 45_000,
    minAmount: 1,
    maxAmount: 5_000_000,
    requirements: ["Oracle + relayer active"],
  },
  {
    name: "ccip",
    supportedChains: ["ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche", "bsc"],
    baseFeeUsd: 3.0,
    feeRate: 0.0015,
    baseLatencyMs: 180_000,
    minAmount: 100,
    maxAmount: 1_000_000,
    requirements: ["LINK tokens for fees on source chain"],
  },
  {
    name: "hyperlane",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "zksync", "scroll",
    ],
    baseFeeUsd: 0.5,
    feeRate: 0.00025,
    baseLatencyMs: 60_000,
    minAmount: 5,
    maxAmount: 2_000_000,
    requirements: ["Interchain gas payment required"],
  },
  {
    name: "socket",
    supportedChains: [
      "ethereum", "arbitrum", "optimism", "base", "polygon",
      "avalanche", "bsc", "gnosis", "zksync", "scroll", "linea",
    ],
    baseFeeUsd: 0.7,
    feeRate: 0.00035,
    baseLatencyMs: 60_000,
    minAmount: 10,
    maxAmount: 3_000_000,
    requirements: ["Approval required for first transfer"],
  },
];

/**
 * Simulate bridge health — some bridges randomly degraded or down.
 */
function getBridgeStatus(name: BridgeProtocol): "active" | "degraded" | "down" {
  // Deterministic pseudo-random based on bridge name + hour
  const hour = new Date().getHours();
  const seed = name.length + hour;
  const r = Math.abs(Math.sin(seed * 127.1)) * 100;
  if (r < 5) return "down";
  if (r < 15) return "degraded";
  return "active";
}

/**
 * Estimate bridge fee for a given transfer.
 */
function estimateFee(
  meta: BridgeMeta,
  amount: number,
  status: "active" | "degraded" | "down"
): number {
  if (status === "down") return Infinity;
  let fee = meta.baseFeeUsd + amount * meta.feeRate;
  // Degraded bridges cost more (congestion surcharge)
  if (status === "degraded") fee *= 1.5;
  return Math.round(fee * 100) / 100;
}

/**
 * Estimate ETA based on chain finality + bridge latency.
 */
function estimateETA(
  meta: BridgeMeta,
  fromChain: ChainId,
  toChain: ChainId,
  status: "active" | "degraded" | "down"
): number {
  if (status === "down") return Infinity;
  const fromLatency = CHAIN_LATENCY[fromChain] || 5000;
  const toLatency = CHAIN_LATENCY[toChain] || 5000;
  let totalMs = fromLatency + meta.baseLatencyMs + toLatency;
  if (status === "degraded") totalMs *= 1.8;
  return Math.round(totalMs / 60000); // Convert to minutes
}

/**
 * Calculate success rate based on status.
 */
function getSuccessRate(status: "active" | "degraded" | "down"): number {
  switch (status) {
    case "active": return 98 + Math.random() * 2;
    case "degraded": return 70 + Math.random() * 20;
    case "down": return 0;
  }
}

/**
 * Main bridge ping function — finds routes and ranks them.
 */
export async function pingBridgeRoutes(
  input: PingBridgeInput
): Promise<PingBridgeOutput> {
  const { token, amount, from_chain, to_chain, preferred_bridges, max_routes } = input;

  if (from_chain === to_chain) {
    return {
      token,
      amount,
      from_chain,
      to_chain,
      routes: [],
      recommended: null,
      alerts: ["Source and destination chains are the same — no bridge needed."],
    };
  }

  // Filter bridges that support both chains
  let candidates = BRIDGE_META.filter(
    (meta) =>
      meta.supportedChains.includes(from_chain) &&
      meta.supportedChains.includes(to_chain) &&
      amount >= meta.minAmount &&
      amount <= meta.maxAmount
  );

  // Prioritize preferred bridges
  if (preferred_bridges && preferred_bridges.length > 0) {
    candidates.sort((a, b) => {
      const aPref = preferred_bridges.includes(a.name) ? 0 : 1;
      const bPref = preferred_bridges.includes(b.name) ? 0 : 1;
      return aPref - bPref;
    });
  }

  // Build routes
  const alerts: string[] = [];
  const routes: BridgeRoute[] = [];

  for (const meta of candidates.slice(0, max_routes)) {
    const status = getBridgeStatus(meta.name);
    const fee = estimateFee(meta, amount, status);
    const eta = estimateETA(meta, from_chain, to_chain, status);
    const successRate = getSuccessRate(status);
    const latencyMs =
      (CHAIN_LATENCY[from_chain] || 5000) + meta.baseLatencyMs;

    routes.push({
      bridge: meta.name,
      from_chain,
      to_chain,
      eta_minutes: eta,
      fee_usd: fee,
      fee_token: token,
      min_amount: meta.minAmount,
      max_amount: meta.maxAmount,
      requirements: [...meta.requirements],
      status,
      latency_ms: latencyMs,
      success_rate: Math.round(successRate * 100) / 100,
      last_ping: new Date().toISOString(),
    });

    if (status === "down") {
      alerts.push(`${meta.name}: Bridge is currently DOWN. Do not use.`);
    } else if (status === "degraded") {
      alerts.push(`${meta.name}: Bridge is DEGRADED — expect higher fees and latency.`);
    }
  }

  // Check if amount exceeds limits for all bridges
  if (routes.length === 0) {
    const allBridges = BRIDGE_META.filter(
      (m) =>
        m.supportedChains.includes(from_chain) &&
        m.supportedChains.includes(to_chain)
    );
    if (allBridges.length > 0) {
      alerts.push(
        `Amount ${amount} ${token} exceeds limits for all bridges. Max amount: ${Math.max(...allBridges.map((m) => m.maxAmount))} ${token}.`
      );
    } else {
      alerts.push(
        `No bridges support route from ${from_chain} to ${to_chain} for ${token}.`
      );
    }
  }

  // Find recommended route (lowest fee + still active)
  const activeRoutes = routes.filter((r) => r.status !== "down");
  const recommended = activeRoutes.length > 0
    ? activeRoutes.reduce((best, r) => (r.fee_usd < best.fee_usd ? r : best))
    : null;

  if (recommended) {
    alerts.unshift(
      `Recommended: ${recommended.bridge} — ${recommended.eta_minutes}min, $${recommended.fee_usd} fee.`
    );
  }

  return {
    token,
    amount,
    from_chain,
    to_chain,
    routes,
    recommended,
    alerts,
  };
}
