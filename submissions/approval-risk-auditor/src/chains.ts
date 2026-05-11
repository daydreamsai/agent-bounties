/**
 * Supported chain configurations — v0.2.1 (RPC URLs for each chain)
 */

export interface ChainConfig {
  name: string;
  chainId: number;
  apiUrl: string;
  apiKeyEnv: string;
  explorerUrl: string;
  currency: string;
  rpcPublic: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: "Ethereum", chainId: 1,
    apiUrl: "https://api.etherscan.io/api",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://etherscan.io", currency: "ETH",
    rpcPublic: "https://eth.merkle.io",
  },
  polygon: {
    name: "Polygon", chainId: 137,
    apiUrl: "https://api.polygonscan.com/api",
    apiKeyEnv: "POLYGONSCAN_API_KEY",
    explorerUrl: "https://polygonscan.com", currency: "MATIC",
    rpcPublic: "https://polygon-rpc.com",
  },
  bsc: {
    name: "BNB Smart Chain", chainId: 56,
    apiUrl: "https://api.bscscan.com/api",
    apiKeyEnv: "BSCSCAN_API_KEY",
    explorerUrl: "https://bscscan.com", currency: "BNB",
    rpcPublic: "https://bsc-dataseed.binance.org",
  },
  arbitrum: {
    name: "Arbitrum One", chainId: 42161,
    apiUrl: "https://api.arbiscan.io/api",
    apiKeyEnv: "ARBISCAN_API_KEY",
    explorerUrl: "https://arbiscan.io", currency: "ETH",
    rpcPublic: "https://arb1.arbitrum.io/rpc",
  },
  optimism: {
    name: "Optimism", chainId: 10,
    apiUrl: "https://api-optimistic.etherscan.io/api",
    apiKeyEnv: "OPTIMISTIC_ETHERSCAN_API_KEY",
    explorerUrl: "https://optimistic.etherscan.io", currency: "ETH",
    rpcPublic: "https://mainnet.optimism.io",
  },
  base: {
    name: "Base", chainId: 8453,
    apiUrl: "https://api.basescan.org/api",
    apiKeyEnv: "BASESCAN_API_KEY",
    explorerUrl: "https://basescan.org", currency: "ETH",
    rpcPublic: "https://mainnet.base.org",
  },
  avalanche: {
    name: "Avalanche C-Chain", chainId: 43114,
    apiUrl: "https://api.snowtrace.io/api",
    apiKeyEnv: "AVALANCHESCAN_API_KEY",
    explorerUrl: "https://snowtrace.io", currency: "AVAX",
    rpcPublic: "https://api.avax.network/ext/bc/C/rpc",
  },
};

export function getChain(name: string): ChainConfig | undefined {
  return CHAINS[name.toLowerCase().trim()];
}

export function getApiKey(chain: ChainConfig): string | undefined {
  return process.env[chain.apiKeyEnv] || process.env["ETHERSCAN_API_KEY"];
}
