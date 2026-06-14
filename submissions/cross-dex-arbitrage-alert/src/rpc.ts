import { fetch as undiciFetch } from 'undici';
import type { SupportedChain } from './types.js';

const decimalsSelector = '0x313ce567';
const getPairSelector = '0xe6a43905';
const getReservesSelector = '0x0902f1ac';
const token0Selector = '0x0dfe1681';
const token1Selector = '0xd21220a7';

const rpcUrls: Record<SupportedChain, string[]> = {
  base: ['https://base-rpc.publicnode.com', 'https://base.drpc.org'],
  eth: ['https://ethereum.publicnode.com', 'https://eth.drpc.org']
};

export const llamaChains: Record<SupportedChain, string> = {
  base: 'base',
  eth: 'ethereum'
};

export class RpcClient {
  constructor(readonly chain: SupportedChain, private readonly urls = rpcUrls[chain]) {}

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

  async gasPrice(): Promise<bigint> {
    const result = await this.rpc('eth_gasPrice', []);
    return decodeUint(result);
  }

  async blockNumber(): Promise<string> {
    return this.rpc('eth_blockNumber', []);
  }

  private async rpc(method: string, params: unknown[]): Promise<string> {
    let lastError: unknown;
    for (const url of this.urls) {
      try {
        const response = await undiciFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
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

export async function tokenDecimals(rpc: RpcClient, token: string): Promise<number> {
  return Number(decodeUint(await rpc.call(token, decimalsSelector)));
}

export async function factoryPair(rpc: RpcClient, factory: string, tokenA: string, tokenB: string): Promise<string | null> {
  const result = await rpc.call(factory, `${getPairSelector}${encodeAddress(tokenA)}${encodeAddress(tokenB)}`);
  const pair = decodeAddress(result);
  return /^0x0{40}$/i.test(pair) ? null : pair;
}

export async function pairTokens(rpc: RpcClient, pair: string): Promise<{ token0: string; token1: string }> {
  const [token0, token1] = await Promise.all([
    rpc.call(pair, token0Selector).then(decodeAddress),
    rpc.call(pair, token1Selector).then(decodeAddress)
  ]);
  return { token0, token1 };
}

export async function pairReserves(rpc: RpcClient, pair: string): Promise<{ reserve0: bigint; reserve1: bigint }> {
  const result = cleanHex(await rpc.call(pair, getReservesSelector));
  if (result.length < 128) throw new Error('invalid getReserves result');
  return {
    reserve0: BigInt(`0x${result.slice(0, 64)}`),
    reserve1: BigInt(`0x${result.slice(64, 128)}`)
  };
}

export async function tokenUsdPrice(chain: SupportedChain, token: string): Promise<number | null> {
  const url = `https://coins.llama.fi/prices/current/${llamaChains[chain]}:${token}`;
  const response = await undiciFetch(url, { headers: { accept: 'application/json', 'user-agent': 'cross-dex-arbitrage-alert/0.1' } });
  if (!response.ok) return null;
  const json = await response.json() as { coins?: Record<string, { price?: number }> };
  const price = Object.values(json.coins || {})[0]?.price;
  return Number.isFinite(price) ? Number(price) : null;
}

export async function nativeUsdPrice(): Promise<number | null> {
  const response = await undiciFetch('https://coins.llama.fi/prices/current/coingecko:ethereum', {
    headers: { accept: 'application/json', 'user-agent': 'cross-dex-arbitrage-alert/0.1' }
  });
  if (!response.ok) return null;
  const json = await response.json() as { coins?: Record<string, { price?: number }> };
  const price = Object.values(json.coins || {})[0]?.price;
  return Number.isFinite(price) ? Number(price) : null;
}

export function encodeAddress(address: string): string {
  return cleanHex(address).padStart(64, '0');
}

export function decodeAddress(hex: string): string {
  const clean = cleanHex(hex);
  if (!clean) return '0x0000000000000000000000000000000000000000';
  if (clean.length < 40) throw new Error(`invalid address result ${hex}`);
  return `0x${clean.slice(-40)}`;
}

export function decodeUint(hex: string): bigint {
  const clean = cleanHex(hex);
  if (!clean) return 0n;
  return BigInt(`0x${clean}`);
}

export function cleanHex(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
