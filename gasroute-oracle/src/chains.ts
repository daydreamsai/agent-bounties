/**
 * Chain configuration & public RPC endpoints for GasRoute Oracle.
 *
 * Each entry provides:
 *  - rpcUrl:       public JSON-RPC endpoint for gas price queries
 *  - nativeToken:  symbol of the native gas token
 *  - explorerUrl:  block explorer base URL (for reference)
 *  - coingeckoId:  CoinGecko price API identifier
 *  - defaultPriorityFee: default priority fee in gwei (used when RPC doesn't give one)
 */

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  nativeToken: string;
  nativeTokenDecimals: number;
  explorerUrl: string;
  coingeckoId: string;
  defaultPriorityFeeGwei: number;
  /** Some L2s have a fixed gas price or use a different fee model */
  fixedGasPrice?: boolean;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    nativeToken: "ETH",
    nativeTokenDecimals: 18,
    explorerUrl: "https://etherscan.io",
    coingeckoId: "ethereum",
    defaultPriorityFeeGwei: 1.5,
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    nativeToken: "ETH",
    nativeTokenDecimals: 18,
    explorerUrl: "https://basescan.org",
    coingeckoId: "ethereum",
    defaultPriorityFeeGwei: 0.01,
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon.llamarpc.com",
    nativeToken: "MATIC",
    nativeTokenDecimals: 18,
    explorerUrl: "https://polygonscan.com",
    coingeckoId: "matic-network",
    defaultPriorityFeeGwei: 30,
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arbitrum.llamarpc.com",
    nativeToken: "ETH",
    nativeTokenDecimals: 18,
    explorerUrl: "https://arbiscan.io",
    coingeckoId: "ethereum",
    defaultPriorityFeeGwei: 0.1,
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    rpcUrl: "https://optimism.llamarpc.com",
    nativeToken: "ETH",
    nativeTokenDecimals: 18,
    explorerUrl: "https://optimistic.etherscan.io",
    coingeckoId: "ethereum",
    defaultPriorityFeeGwei: 0.001,
  },
  bsc: {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: "https://bsc.llamarpc.com",
    nativeToken: "BNB",
    nativeTokenDecimals: 18,
    explorerUrl: "https://bscscan.com",
    coingeckoId: "binancecoin",
    defaultPriorityFeeGwei: 3,
  },
  avalanche: {
    name: "Avalanche C-Chain",
    chainId: 43114,
    rpcUrl: "https://avalanche.llamarpc.com",
    nativeToken: "AVAX",
    nativeTokenDecimals: 18,
    explorerUrl: "https://snowtrace.io",
    coingeckoId: "avalanche-2",
    defaultPriorityFeeGwei: 25,
  },
  gnosis: {
    name: "Gnosis Chain",
    chainId: 100,
    rpcUrl: "https://gnosis.llamarpc.com",
    nativeToken: "XDAI",
    nativeTokenDecimals: 18,
    explorerUrl: "https://gnosisscan.io",
    coingeckoId: "xdai",
    defaultPriorityFeeGwei: 1,
  },
};

/** Supported chain names — the canonical set the agent accepts */
export const SUPPORTED_CHAINS = Object.keys(CHAINS);

/** Validate that a chain_set input is a subset of supported chains */
export function validateChains(chains: string[]): string[] {
  const unknown = chains.filter((c) => !(c in CHAINS));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown chain(s): ${unknown.join(", ")}. Supported: ${SUPPORTED_CHAINS.join(", ")}`
    );
  }
  return chains;
}
