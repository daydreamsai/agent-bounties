import { arbitrum, base, mainnet, optimism, polygon, type Chain } from 'viem/chains';
import type { SupportedChain } from './types.js';

export type ChainConfig = {
  key: SupportedChain;
  chainId: number;
  viemChain: Chain;
  rpcUrl: string;
  explorerApiUrl: string;
  defaultLookbackBlocks: number;
};

export const chainConfigs: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    key: 'ethereum',
    chainId: 1,
    viemChain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    defaultLookbackBlocks: 80_000
  },
  polygon: {
    key: 'polygon',
    chainId: 137,
    viemChain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    defaultLookbackBlocks: 160_000
  },
  arbitrum: {
    key: 'arbitrum',
    chainId: 42161,
    viemChain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    defaultLookbackBlocks: 240_000
  },
  optimism: {
    key: 'optimism',
    chainId: 10,
    viemChain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism-rpc.publicnode.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    defaultLookbackBlocks: 240_000
  },
  base: {
    key: 'base',
    chainId: 8453,
    viemChain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    defaultLookbackBlocks: 240_000
  }
};

export function getChainConfig(chain: SupportedChain): ChainConfig {
  return chainConfigs[chain];
}
