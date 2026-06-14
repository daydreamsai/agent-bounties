import { fetch as undiciFetch } from 'undici';
import type { PendingTxSample, SupportedChain } from './types.js';

const rpcUrls: Record<SupportedChain, string[]> = {
  eth: ['https://eth.drpc.org', 'https://rpc.flashbots.net', 'https://ethereum.publicnode.com'],
  base: ['https://base.drpc.org', 'https://base-rpc.publicnode.com']
};

export class RpcClient {
  constructor(readonly chain: SupportedChain, private readonly urls = rpcUrls[chain]) {}

  async rpc<T>(method: string, params: unknown[], timeoutMs = 900): Promise<T> {
    let lastError: unknown;
    for (const url of this.urls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await undiciFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: controller.signal
        });
        const json = await response.json() as { result?: T; error?: { message?: string } };
        if (json.result !== undefined) return json.result;
        lastError = new Error(json.error?.message || `RPC ${url} returned no result`);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async pendingBlock(limit: number): Promise<PendingTxSample[]> {
    const block = await this.rpc<{ transactions?: Array<Record<string, unknown>> }>('eth_getBlockByNumber', ['pending', true], 2200);
    const txs = Array.isArray(block.transactions) ? block.transactions.slice(0, limit) : [];
    return txs.map(normalizeTx);
  }

  async feeHistory(): Promise<{ p50: number | null; p90: number | null }> {
    const history = await this.rpc<{ reward?: string[][] }>('eth_feeHistory', ['0x5', 'pending', [50, 90]], 1400);
    const rewards = history.reward || [];
    const p50 = median(rewards.map((row) => row[0]).filter(Boolean).map(hexWeiToGwei));
    const p90 = median(rewards.map((row) => row[1]).filter(Boolean).map(hexWeiToGwei));
    return { p50, p90 };
  }

  async txByHash(hash: string): Promise<PendingTxSample | null> {
    const tx = await this.rpc<Record<string, unknown> | null>('eth_getTransactionByHash', [hash], 1000);
    return tx ? normalizeTx(tx) : null;
  }
}

export function normalizeTx(tx: Record<string, unknown>): PendingTxSample {
  return {
    hash: typeof tx.hash === 'string' ? tx.hash : '',
    to: typeof tx.to === 'string' ? tx.to : null,
    from: typeof tx.from === 'string' ? tx.from : null,
    gas_price_gwei: typeof tx.gasPrice === 'string' ? hexWeiToGwei(tx.gasPrice) : null,
    max_fee_per_gas_gwei: typeof tx.maxFeePerGas === 'string' ? hexWeiToGwei(tx.maxFeePerGas) : null,
    input_prefix: typeof tx.input === 'string' ? tx.input.slice(0, 10).toLowerCase() : '0x',
    value_eth: typeof tx.value === 'string' ? Number(formatEth(BigInt(tx.value))) : 0
  };
}

export function gasPrice(tx: PendingTxSample): number | null {
  return tx.max_fee_per_gas_gwei ?? tx.gas_price_gwei;
}

export function hexWeiToGwei(hex: string): number {
  return Number(BigInt(hex)) / 1e9;
}

function formatEth(value: bigint): string {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  return clean[Math.floor(clean.length / 2)];
}
