import type { SupportedChain } from './types.js';

export interface ChainConfig {
  key: SupportedChain;
  chainId: number;
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  priceId: string;
  rpcEnv: string;
  publicRpcUrls: string[];
}

export const chainConfigs: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    key: 'ethereum', chainId: 1, name: 'Ethereum', nativeSymbol: 'ETH', nativeDecimals: 18, priceId: 'ethereum', rpcEnv: 'ETHEREUM_RPC_URL',
    publicRpcUrls: ['https://ethereum.publicnode.com', 'https://rpc.ankr.com/eth']
  },
  base: {
    key: 'base', chainId: 8453, name: 'Base', nativeSymbol: 'ETH', nativeDecimals: 18, priceId: 'ethereum', rpcEnv: 'BASE_RPC_URL',
    publicRpcUrls: ['https://mainnet.base.org', 'https://base.publicnode.com']
  },
  polygon: {
    key: 'polygon', chainId: 137, name: 'Polygon', nativeSymbol: 'POL', nativeDecimals: 18, priceId: 'polygon-ecosystem-token', rpcEnv: 'POLYGON_RPC_URL',
    publicRpcUrls: ['https://polygon-bor.publicnode.com', 'https://polygon.drpc.org', 'https://1rpc.io/matic']
  },
  arbitrum: {
    key: 'arbitrum', chainId: 42161, name: 'Arbitrum One', nativeSymbol: 'ETH', nativeDecimals: 18, priceId: 'ethereum', rpcEnv: 'ARBITRUM_RPC_URL',
    publicRpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one.publicnode.com']
  },
  optimism: {
    key: 'optimism', chainId: 10, name: 'Optimism', nativeSymbol: 'ETH', nativeDecimals: 18, priceId: 'ethereum', rpcEnv: 'OPTIMISM_RPC_URL',
    publicRpcUrls: ['https://optimism.drpc.org', 'https://1rpc.io/op', 'https://mainnet.optimism.io', 'https://optimism.publicnode.com']
  },
  bsc: {
    key: 'bsc', chainId: 56, name: 'BNB Smart Chain', nativeSymbol: 'BNB', nativeDecimals: 18, priceId: 'binancecoin', rpcEnv: 'BSC_RPC_URL',
    publicRpcUrls: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com']
  },
  avalanche: {
    key: 'avalanche', chainId: 43114, name: 'Avalanche C-Chain', nativeSymbol: 'AVAX', nativeDecimals: 18, priceId: 'avalanche-2', rpcEnv: 'AVALANCHE_RPC_URL',
    publicRpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain.publicnode.com']
  }
};

export function rpcUrlsFor(config: ChainConfig): string[] {
  const configured = process.env[config.rpcEnv]?.trim();
  return configured ? [configured, ...config.publicRpcUrls] : config.publicRpcUrls;
}