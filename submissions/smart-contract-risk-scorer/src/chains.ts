import { arbitrum, base, mainnet, optimism, polygon, type Chain } from 'viem/chains';
import type { SupportedChain } from './types.js';

export type ChainConfig = {
  key: SupportedChain;
  chainId: number;
  viemChain: Chain;
  rpcUrl: string;
  rpcFallbackUrls: string[];
  explorerApiUrl: string;
};

export const chainConfigs: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    key: 'ethereum',
    chainId: 1,
    viemChain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org',
    rpcFallbackUrls: ['https://eth.drpc.org', 'https://ethereum-rpc.publicnode.com', 'https://ethereum.publicnode.com'],
    explorerApiUrl: 'https://api.etherscan.io/v2/api'
  },
  polygon: {
    key: 'polygon',
    chainId: 137,
    viemChain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    rpcFallbackUrls: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon-bor.publicnode.com'],
    explorerApiUrl: 'https://api.etherscan.io/v2/api'
  },
  arbitrum: {
    key: 'arbitrum',
    chainId: 42161,
    viemChain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
    rpcFallbackUrls: ['https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum-one.publicnode.com'],
    explorerApiUrl: 'https://api.etherscan.io/v2/api'
  },
  optimism: {
    key: 'optimism',
    chainId: 10,
    viemChain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism-rpc.publicnode.com',
    rpcFallbackUrls: ['https://optimism-rpc.publicnode.com', 'https://optimism.publicnode.com'],
    explorerApiUrl: 'https://api.etherscan.io/v2/api'
  },
  base: {
    key: 'base',
    chainId: 8453,
    viemChain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
    rpcFallbackUrls: ['https://base-rpc.publicnode.com', 'https://base.publicnode.com'],
    explorerApiUrl: 'https://api.etherscan.io/v2/api'
  }
};

export function getChainConfig(chain: SupportedChain): ChainConfig {
  return chainConfigs[chain];
}
