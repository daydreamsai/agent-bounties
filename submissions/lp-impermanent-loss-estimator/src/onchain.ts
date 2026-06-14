import { fetch as undiciFetch } from 'undici';
import type { SupportedNetwork } from './types.js';

const token0Selector = '0x0dfe1681';
const token1Selector = '0xd21220a7';
const feeSelector = '0xddca3f43';
const decimalsSelector = '0x313ce567';
const balanceOfSelector = '0x70a08231';

const chainConfig: Partial<Record<SupportedNetwork, { llamaChain: string; rpcUrls: string[] }>> = {
  eth: {
    llamaChain: 'ethereum',
    rpcUrls: ['https://ethereum.publicnode.com', 'https://eth.drpc.org']
  },
  base: {
    llamaChain: 'base',
    rpcUrls: ['https://base-rpc.publicnode.com', 'https://base.drpc.org']
  },
  polygon_pos: {
    llamaChain: 'polygon',
    rpcUrls: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org']
  },
  arbitrum: {
    llamaChain: 'arbitrum',
    rpcUrls: ['https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org']
  },
  optimism: {
    llamaChain: 'optimism',
    rpcUrls: ['https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org']
  },
  bsc: {
    llamaChain: 'bsc',
    rpcUrls: ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org']
  },
  avalanche: {
    llamaChain: 'avax',
    rpcUrls: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://avalanche.drpc.org']
  },
  gnosis: {
    llamaChain: 'xdai',
    rpcUrls: ['https://gnosis-rpc.publicnode.com', 'https://gnosis.drpc.org']
  },
  fantom: {
    llamaChain: 'fantom',
    rpcUrls: ['https://fantom-rpc.publicnode.com', 'https://fantom.drpc.org']
  }
};

export type OnchainFallbackSnapshot = {
  token0: string;
  token1: string;
  feeBps: number | null;
  tvlUsd: number | null;
  priceRatioStart: number | null;
  priceRatioEnd: number | null;
  priceRelative: number | null;
  dataSources: string[];
};

export async function fetchOnchainFallback(network: SupportedNetwork, poolAddress: string, windowHours: number): Promise<OnchainFallbackSnapshot> {
  const config = chainConfig[network];
  if (!config) throw new Error(`on-chain fallback unsupported for network ${network}`);

  const rpc = new RpcFallback(config.rpcUrls);
  const [token0, token1, feeRaw] = await Promise.all([
    rpc.call(poolAddress, token0Selector),
    rpc.call(poolAddress, token1Selector),
    rpc.call(poolAddress, feeSelector).catch(() => null)
  ]);
  const token0Address = decodeAddress(token0);
  const token1Address = decodeAddress(token1);
  const feeBps = feeRaw ? Number(decodeUint(feeRaw)) / 100 : null;

  const [decimals0Raw, decimals1Raw, balance0Raw, balance1Raw] = await Promise.all([
    rpc.call(token0Address, decimalsSelector),
    rpc.call(token1Address, decimalsSelector),
    rpc.call(token0Address, balanceOfCalldata(poolAddress)),
    rpc.call(token1Address, balanceOfCalldata(poolAddress))
  ]);
  const decimals0 = Number(decodeUint(decimals0Raw));
  const decimals1 = Number(decodeUint(decimals1Raw));
  const balance0 = Number(formatUnits(decodeUint(balance0Raw), decimals0));
  const balance1 = Number(formatUnits(decodeUint(balance1Raw), decimals1));

  const [prices0, prices1] = await Promise.all([
    fetchLlamaPrices(config.llamaChain, token0Address, windowHours),
    fetchLlamaPrices(config.llamaChain, token1Address, windowHours)
  ]);
  const start0 = firstPrice(prices0);
  const end0 = lastPrice(prices0);
  const start1 = firstPrice(prices1);
  const end1 = lastPrice(prices1);
  const priceRatioStart = start0 !== null && start1 !== null && start1 > 0 ? start0 / start1 : null;
  const priceRatioEnd = end0 !== null && end1 !== null && end1 > 0 ? end0 / end1 : null;
  const priceRelative = priceRatioStart !== null && priceRatioEnd !== null && priceRatioStart > 0 ? priceRatioEnd / priceRatioStart : null;
  const tvlUsd = end0 !== null && end1 !== null ? balance0 * end0 + balance1 * end1 : null;

  return {
    token0: token0Address,
    token1: token1Address,
    feeBps,
    tvlUsd,
    priceRatioStart,
    priceRatioEnd,
    priceRelative,
    dataSources: [`rpc:${network}`, `defillama:coins:${config.llamaChain}`]
  };
}

export function decodeAddress(hex: string): string {
  const clean = cleanHex(hex);
  if (clean.length < 40) throw new Error(`invalid address result ${hex}`);
  return `0x${clean.slice(-40)}`;
}

export function decodeUint(hex: string): bigint {
  const clean = cleanHex(hex);
  if (!clean) return 0n;
  return BigInt(`0x${clean}`);
}

export function formatUnits(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const negative = value < 0n;
  const raw = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

function balanceOfCalldata(owner: string): string {
  return `${balanceOfSelector}${cleanHex(owner).padStart(64, '0')}`;
}

function cleanHex(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

class RpcFallback {
  constructor(private readonly urls: string[]) {}

  async call(to: string, data: string): Promise<string> {
    let lastError: unknown;
    for (const url of this.urls) {
      try {
        const response = await undiciFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] })
        });
        const json = await response.json() as { result?: string; error?: { message?: string } };
        if (json.result) return json.result;
        lastError = new Error(json.error?.message || `RPC ${url} returned no result`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

async function fetchLlamaPrices(chain: string, token: string, windowHours: number): Promise<Array<{ timestamp: number; price: number }>> {
  const span = Math.min(Math.max(Math.ceil(windowHours), 1), 720);
  const start = Math.floor(Date.now() / 1000) - Math.ceil(windowHours * 3600);
  const url = `https://coins.llama.fi/chart/${chain}:${token}?start=${start}&period=1h&span=${span}`;
  const response = await undiciFetch(url, { headers: { accept: 'application/json', 'user-agent': 'lp-impermanent-loss-estimator/0.1' } });
  if (!response.ok) throw new Error(`DefiLlama chart request failed: HTTP ${response.status}`);
  const json = await response.json() as { coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }> };
  const prices = Object.values(json.coins || {})[0]?.prices || [];
  return prices.filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price) && point.price > 0);
}

function firstPrice(prices: Array<{ timestamp: number; price: number }>): number | null {
  return prices.length > 0 ? prices[0].price : null;
}

function lastPrice(prices: Array<{ timestamp: number; price: number }>): number | null {
  return prices.length > 0 ? prices[prices.length - 1].price : null;
}
