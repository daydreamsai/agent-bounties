/**
 * Bridge Route Pinger — shared type definitions.
 *
 * Bounty: daydreamsai/agent-bounties#10
 * Monitors cross-chain bridge routes, latency, and availability
 * across Stargate, Across, Hop, and other providers.
 */

/** Supported bridge provider types */
export type BridgeType = "liquidity_pool" | "canonical" | "amm" | "message_passing" | "intent";

/** A token asset on a chain */
export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Record<string, string>; // chain → contract address
}

/** Chain identifier */
export interface Chain {
  id: string;
  name: string;
  shortName: string;
  chainId: number;
}

/** A pair of chains */
export interface ChainPair {
  from: string;
  to: string;
}

/** A single bridge route between two chains */
export interface BridgeRoute {
  provider: string;
  type: BridgeType;
  estimatedTimeMin: number;
  feeUsd: number;
  outputAmount: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requirements: string[];
  liquidityUsd?: number;
}

/** Input query for route lookup */
export interface RouteQuery {
  token: string;
  amount: number;
  fromChain: string;
  toChain: string;
}

/** Aggregated route results */
export interface RouteResult {
  query: string;
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  allRoutes: BridgeRoute[];
  bestCheapest: BridgeRoute | null;
  bestFastest: BridgeRoute | null;
  recommendation: string;
  status: "LIVE" | "STALE" | "UNAVAILABLE";
  providersQueried: string[];
  timestamp: string;
}

/** Provider interface — each bridge provider implements this */
export interface BridgeProvider {
  /** Human-readable provider name */
  readonly name: string;

  /** Fetch real-time routes for a token transfer between chains */
  getRoutes(query: RouteQuery): Promise<BridgeRoute[]>;

  /** Whether this provider supports the given chain pair */
  isSupported(pair: ChainPair): boolean;

  /** Health check / liveness probe */
  healthCheck(): Promise<boolean>;
}

/** Supported chains with their chain IDs */
export const SUPPORTED_CHAINS: Record<string, Chain> = {
  ETH: { id: "ETH", name: "Ethereum", shortName: "ETH", chainId: 1 },
  ARB: { id: "ARB", name: "Arbitrum One", shortName: "ARB", chainId: 42161 },
  BASE: { id: "BASE", name: "Base", shortName: "BASE", chainId: 8453 },
  OP: { id: "OP", name: "Optimism", shortName: "OP", chainId: 10 },
  POLYGON: { id: "POLYGON", name: "Polygon PoS", shortName: "POL", chainId: 137 },
  AVAX: { id: "AVAX", name: "Avalanche C-Chain", shortName: "AVAX", chainId: 43114 },
  BSC: { id: "BSC", name: "BNB Smart Chain", shortName: "BSC", chainId: 56 },
  SOL: { id: "SOL", name: "Solana", shortName: "SOL", chainId: 0 },
};

/** Chain name aliases for normalization */
export const CHAIN_ALIASES: Record<string, string> = {
  "1": "ETH", ethereum: "ETH", mainnet: "ETH",
  "42161": "ARB", arbitrum: "ARB", arb: "ARB",
  "8453": "BASE", base: "BASE",
  "10": "OP", optimism: "OP",
  "137": "POLYGON", polygon: "POLYGON", poly: "POLYGON",
  "43114": "AVAX", avalanche: "AVAX",
  "56": "BSC", bsc: "BSC", bnb: "BSC",
  solana: "SOL", sol: "SOL",
};

/** Normalize a chain input string to its canonical short name */
export function normalizeChain(input: string): string {
  return CHAIN_ALIASES[input.toLowerCase()] || input.toUpperCase();
}
