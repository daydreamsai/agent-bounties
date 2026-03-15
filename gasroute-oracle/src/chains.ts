/**
 * Supported chain definitions for the GasRoute Oracle.
 * Each chain includes RPC endpoints, native token info, and gas pricing metadata.
 */

export interface ChainDef {
  id: string;
  name: string;
  chainId: number;
  /** Public RPC endpoints (tried in order) */
  rpcs: string[];
  /** Native token symbol */
  nativeToken: string;
  /** CoinGecko ID for native token price lookups */
  coingeckoId: string;
  /** Whether this chain supports EIP-1559 */
  eip1559: boolean;
  /** Typical block time in seconds */
  blockTimeSeconds: number;
}

export const SUPPORTED_CHAINS: Record<string, ChainDef> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    rpcs: [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
    ],
    nativeToken: "ETH",
    coingeckoId: "ethereum",
    eip1559: true,
    blockTimeSeconds: 12,
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    rpcs: [
      "https://polygon.llamarpc.com",
      "https://rpc.ankr.com/polygon",
      "https://polygon-bor-rpc.publicnode.com",
    ],
    nativeToken: "MATIC",
    coingeckoId: "matic-network",
    eip1559: true,
    blockTimeSeconds: 2,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    rpcs: [
      "https://arbitrum.llamarpc.com",
      "https://rpc.ankr.com/arbitrum",
      "https://arbitrum-one-rpc.publicnode.com",
    ],
    nativeToken: "ETH",
    coingeckoId: "ethereum",
    eip1559: true,
    blockTimeSeconds: 0.25,
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    rpcs: [
      "https://optimism.llamarpc.com",
      "https://rpc.ankr.com/optimism",
      "https://optimism-rpc.publicnode.com",
    ],
    nativeToken: "ETH",
    coingeckoId: "ethereum",
    eip1559: true,
    blockTimeSeconds: 2,
  },
  base: {
    id: "base",
    name: "Base",
    chainId: 8453,
    rpcs: [
      "https://base.llamarpc.com",
      "https://rpc.ankr.com/base",
      "https://base-rpc.publicnode.com",
    ],
    nativeToken: "ETH",
    coingeckoId: "ethereum",
    eip1559: true,
    blockTimeSeconds: 2,
  },
};

/** Default set of chains when none specified */
export const DEFAULT_CHAIN_SET = Object.keys(SUPPORTED_CHAINS);
