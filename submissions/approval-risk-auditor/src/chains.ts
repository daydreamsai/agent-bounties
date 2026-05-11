/**
 * Supported chain configurations with Etherscan-compatible API endpoints
 */

export interface ChainConfig {
  name: string;
  chainId: number;
  apiUrl: string;
  apiKeyEnv: string;
  explorerUrl: string;
  currency: string;
  rpcUrl?: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    apiUrl: "https://api.etherscan.io/api",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://etherscan.io",
    currency: "ETH",
    rpcUrl: "https://eth.merkle.io",
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    apiUrl: "https://api.polygonscan.com/api",
    apiKeyEnv: "POLYGONSCAN_API_KEY",
    explorerUrl: "https://polygonscan.com",
    currency: "MATIC",
  },
  bsc: {
    name: "BNB Smart Chain",
    chainId: 56,
    apiUrl: "https://api.bscscan.com/api",
    apiKeyEnv: "BSCSCAN_API_KEY",
    explorerUrl: "https://bscscan.com",
    currency: "BNB",
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    apiUrl: "https://api.arbiscan.io/api",
    apiKeyEnv: "ARBISCAN_API_KEY",
    explorerUrl: "https://arbiscan.io",
    currency: "ETH",
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    apiUrl: "https://api-optimistic.etherscan.io/api",
    apiKeyEnv: "OPTIMISTIC_ETHERSCAN_API_KEY",
    explorerUrl: "https://optimistic.etherscan.io",
    currency: "ETH",
  },
  base: {
    name: "Base",
    chainId: 8453,
    apiUrl: "https://api.basescan.org/api",
    apiKeyEnv: "BASESCAN_API_KEY",
    explorerUrl: "https://basescan.org",
    currency: "ETH",
  },
  avalanche: {
    name: "Avalanche C-Chain",
    chainId: 43114,
    apiUrl: "https://api.snowtrace.io/api",
    apiKeyEnv: "AVALANCHESCAN_API_KEY",
    explorerUrl: "https://snowtrace.io",
    currency: "AVAX",
  },
};

export const CHAIN_NAMES = Object.keys(CHAINS);

/**
 * Get chain config by name, case-insensitive
 */
export function getChain(name: string): ChainConfig | undefined {
  const key = name.toLowerCase().trim();
  return CHAINS[key];
}

/**
 * Get API key from environment for a given chain
 */
export function getApiKey(chain: ChainConfig): string | undefined {
  return process.env[chain.apiKeyEnv] || process.env["ETHERSCAN_API_KEY"];
}
