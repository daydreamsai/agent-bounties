import { ChainConfig, ChainName, FACTORIES } from "./types";

export const CHAINS: Record<ChainName, ChainConfig> = {
  ethereum: {
    name: "ethereum",
    rpc_url: "https://ethereum-rpc.publicnode.com",
    blocks_per_minute: 5,
    factories: FACTORIES.ethereum,
  },

  bsc: {
    name: "bsc",
    rpc_url: "https://bsc-rpc.publicnode.com",
    blocks_per_minute: 20,
    factories: FACTORIES.bsc,
  },
};

export function getChainConfig(chain: ChainName): ChainConfig {
  return CHAINS[chain];
}

export function isSupportedChain(
  chain: string
): chain is ChainName {
  return chain === "ethereum" || chain === "bsc";
}
