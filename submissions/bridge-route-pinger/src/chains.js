/**
 * Chain name/alias to LI.FI chain ID mapping.
 */
export const CHAIN_MAP = {
  ethereum: 1, eth: 1,
  polygon: 137, pol: 137, matic: 137,
  arbitrum: 42161, arb: 42161,
  optimism: 10, opt: 10, op: 10,
  base: 8453,
  avalanche: 43114, avax: 43114,
  bsc: 56, bnb: 56, "binance smart chain": 56,
  gnosis: 100, xdai: 100,
  fantom: 250, ftm: 250,
  zksync: 324, "zksync era": 324,
  linea: 59144,
  scroll: 534352,
  blast: 81457,
  solana: 1151111081099710,
};

/**
 * Common token symbols to addresses per chain.
 * We let LI.FI resolve most tokens by symbol, but this helps for native tokens.
 */
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export function resolveChainId(input) {
  if (typeof input === "number") {
    return Number.isInteger(input) && input > 0 ? input : null;
  }
  const key = String(input).toLowerCase().trim();
  if (CHAIN_MAP[key] !== undefined) return CHAIN_MAP[key];
  const num = Number(key);
  if (Number.isInteger(num) && num > 0) return num;
  return null;
}
