import { z } from "zod";

/** Supported bridge protocols */
export const BridgeProtocol = z.enum([
  "stargate",
  "across",
  "hop_protocol",
  "synapse",
  "connext",
  "wormhole",
  "layerzero",
  "ccip",
  "hyperlane",
  "socket",
]);
export type BridgeProtocol = z.infer<typeof BridgeProtocol>;

/** Supported chains */
export const ChainId = z.enum([
  "ethereum",
  "arbitrum",
  "optimism",
  "base",
  "polygon",
  "avalanche",
  "bsc",
  "gnosis",
  "zksync",
  "scroll",
  "linea",
  "mantle",
]);
export type ChainId = z.infer<typeof ChainId>;

/** Input schema */
export const PingBridgeInput = z.object({
  token: z.string().describe("Token symbol or address to bridge"),
  amount: z.number().positive().describe("Amount to transfer"),
  from_chain: ChainId.describe("Source chain"),
  to_chain: ChainId.describe("Destination chain"),
  preferred_bridges: z.array(BridgeProtocol).optional().describe("Preferred bridge protocols"),
  max_routes: z.number().min(1).max(10).default(5).describe("Maximum routes to return"),
});

export type PingBridgeInput = z.infer<typeof PingBridgeInput>;

/** A single bridge route */
export interface BridgeRoute {
  bridge: BridgeProtocol;
  from_chain: ChainId;
  to_chain: ChainId;
  eta_minutes: number;
  fee_usd: number;
  fee_token: string;
  min_amount: number;
  max_amount: number;
  requirements: string[];
  status: "active" | "degraded" | "down";
  latency_ms: number;
  success_rate: number;
  last_ping: string;
}

/** Output schema */
export interface PingBridgeOutput {
  token: string;
  amount: number;
  from_chain: ChainId;
  to_chain: ChainId;
  routes: BridgeRoute[];
  recommended: BridgeRoute | null;
  alerts: string[];
}

/** Chain latency baseline (ms), used for latency estimation */
export const CHAIN_LATENCY: Record<ChainId, number> = {
  ethereum: 12_000,
  arbitrum: 3_000,
  optimism: 4_000,
  base: 4_000,
  polygon: 5_000,
  avalanche: 3_000,
  bsc: 5_000,
  gnosis: 5_000,
  zksync: 4_000,
  scroll: 4_000,
  linea: 4_000,
  mantle: 4_000,
};
