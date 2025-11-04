import { createPublicClient, http, type PublicClient } from "viem";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  type Chain,
} from "viem/chains";

const supportedChains = new Map<number, Chain>([
  [mainnet.id, mainnet],
  [polygon.id, polygon],
  [optimism.id, optimism],
  [arbitrum.id, arbitrum],
  [base.id, base],
]);

const clients = new Map<number, PublicClient>();

function resolveChain(chainId: number): Chain {
  const chain = supportedChains.get(chainId);
  if (!chain) {
    throw new Error(`Unsupported chain id ${chainId}. Add it to supportedChains.`);
  }
  return chain;
}

function resolveRpcUrl(chain: Chain): string {
  const envVarName = `RPC_URL_${chain.id}`;
  const envValue = process.env[envVarName];
  if (envValue && envValue.trim().length > 0) {
    return envValue.trim();
  }

  const fallback =
    chain.rpcUrls.public?.http?.[0] ?? chain.rpcUrls.default?.http?.[0];
  if (!fallback) {
    throw new Error(
      `No RPC URL configured for chain ${chain.id}. Set ${envVarName}.`
    );
  }
  return fallback;
}

export function getPublicClient(chainId: number): PublicClient {
  const existing = clients.get(chainId);
  if (existing) {
    return existing;
  }

  const chain = resolveChain(chainId);
  const rpcUrl = resolveRpcUrl(chain);

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  clients.set(chainId, client);
  return client;
}
