export type ChainName = "ethereum" | "bsc";

export interface TokenInfo {
  address: string;
  symbol: string;
}

export interface InitLiquidity {
  token0_raw: string;
  token1_raw: string;
}

export interface NewPair {
  pair_address: string;
  tokens: [TokenInfo, TokenInfo];
  init_liquidity: InitLiquidity;
  top_holders: string[];
  created_at: string;
  chain: ChainName;
}

export interface ChainConfig {
  name: ChainName;
  rpcUrl: string;
  blocksPerMinute: number;
  factories: string[];
}

export interface HolderResult {
  address: string;
  amount?: string;
}

export interface KVStore {
  write(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<void>;

  read<T = unknown>(key: string): Promise<T | null>;

  listByChain(chain: ChainName): Promise<NewPair[]>;

  isDuplicate(key: string): Promise<boolean>;
}

export const DEFAULT_KV_TTL_SECONDS = 10 * 60;

export const FACTORIES = {
  ethereum: {
    uniswapV2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    uniswapV3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  },
  bsc: {
    pancakeswapV2: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    pancakeswapV3: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  },
} as const;
