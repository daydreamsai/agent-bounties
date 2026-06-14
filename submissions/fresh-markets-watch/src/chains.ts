export interface FactoryConfig {
  address: string;
  protocol: string;
  type: 'v2' | 'v3';
}

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  avgBlockSeconds: number;
  factories: FactoryConfig[];
}

export const chainConfigs: Record<string, ChainConfig> = {
  base: {
    id: 8453,
    name: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    avgBlockSeconds: 2,
    factories: [
      { address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', protocol: 'Uniswap V3', type: 'v3' },
      { address: '0x71524B4f93c58fcbF659783284E38825f0622859', protocol: 'SushiSwap V2', type: 'v2' }
    ]
  },
  arbitrum: {
    id: 42161,
    name: 'arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    avgBlockSeconds: 1,
    factories: [
      { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', protocol: 'Uniswap V3', type: 'v3' },
      { address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', protocol: 'SushiSwap V2', type: 'v2' }
    ]
  }
};

export function getChainConfig(chain: string): ChainConfig {
  const normalized = chain.trim().toLowerCase();
  const config = chainConfigs[normalized];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);
  return config;
}
