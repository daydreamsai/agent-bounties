import type { SupportedChain } from './types.js';

export type ChainConfig = {
  name: SupportedChain;
  chainId: number;
  explorerApiUrl: string;
  rpcUrl: string;
  defaultFromBlock: bigint;
};

export const chainConfigs: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    name: 'ethereum',
    chainId: 1,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com',
    defaultFromBlock: 18_000_000n
  },
  base: {
    name: 'base',
    chainId: 8453,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base.publicnode.com',
    defaultFromBlock: 12_000_000n
  },
  polygon: {
    name: 'polygon',
    chainId: 137,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
    defaultFromBlock: 50_000_000n
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one.publicnode.com',
    defaultFromBlock: 160_000_000n
  },
  optimism: {
    name: 'optimism',
    chainId: 10,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism.publicnode.com',
    defaultFromBlock: 110_000_000n
  },
  bsc: {
    name: 'bsc',
    chainId: 56,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc.publicnode.com',
    defaultFromBlock: 33_000_000n
  },
  avalanche: {
    name: 'avalanche',
    chainId: 43114,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://avalanche-c-chain-rpc.publicnode.com',
    defaultFromBlock: 35_000_000n
  },
  gnosis: {
    name: 'gnosis',
    chainId: 100,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://gnosis-rpc.publicnode.com',
    defaultFromBlock: 28_000_000n
  },
  fantom: {
    name: 'fantom',
    chainId: 250,
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    rpcUrl: process.env.FANTOM_RPC_URL || 'https://fantom.drpc.org',
    defaultFromBlock: 70_000_000n
  }
};

export function getChainConfig(chain: SupportedChain): ChainConfig {
  return chainConfigs[chain];
}
