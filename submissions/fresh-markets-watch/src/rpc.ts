export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

export interface RpcReceipt {
  transactionHash: string;
  logs: RpcLog[];
}

export class RpcClient {
  constructor(private readonly url: string) {}

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'fresh-markets-watch/0.1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const payload = await response.json() as { result?: T; error?: { message?: string } };
    if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC HTTP ${response.status}`);
    return payload.result as T;
  }

  async blockNumber(): Promise<number> {
    return Number.parseInt(await this.call<string>('eth_blockNumber', []), 16);
  }

  async getLogs(filter: { fromBlock: number; toBlock: number; address: string; topics: string[] }): Promise<RpcLog[]> {
    return this.call<RpcLog[]>('eth_getLogs', [{
      fromBlock: `0x${filter.fromBlock.toString(16)}`,
      toBlock: `0x${filter.toBlock.toString(16)}`,
      address: filter.address,
      topics: filter.topics
    }]);
  }

  async getBlockTimestamp(blockNumber: number): Promise<string | null> {
    const block = await this.call<{ timestamp?: string } | null>('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]);
    if (!block?.timestamp) return null;
    return new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString();
  }

  async ethCall(to: string, data: string, blockNumber: number): Promise<string> {
    return this.call<string>('eth_call', [{ to, data }, `0x${blockNumber.toString(16)}`]);
  }

  async getTransactionReceipt(transactionHash: string): Promise<RpcReceipt | null> {
    return this.call<RpcReceipt | null>('eth_getTransactionReceipt', [transactionHash]);
  }
}
