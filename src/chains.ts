export interface ChainConfig {
  chain: string;
  rpcUrl: string;
  blocksPerMinute: number;
  factories: string[];
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    chain: "ethereum",
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
    blocksPerMinute: 5,
    factories: [
      "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    ],
  },
  bsc: {
    chain: "bsc",
    rpcUrl: "https://bnb-mainnet.g.alchemy.com/v2/demo",
    blocksPerMinute: 20,
    factories: [
      "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
      "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    ],
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}

export function getFactoryAddresses(chain: string): string[] {
  return getChainConfig(chain).factories;
}
