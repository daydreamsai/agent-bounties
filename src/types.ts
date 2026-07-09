export interface NewPair {
  pair_address: string;
  tokens: Array<{ address: string; symbol: string }>;
  init_liquidity: {
    token0_raw: string;
    token1_raw: string;
  };
  top_holders: string[];
  created_at: string;
}
