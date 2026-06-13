import type { FactoryConfig } from './chains.js';
import type { RpcLog } from './rpc.js';
import type { FreshMarket } from './types.js';

export const PAIR_CREATED_TOPIC = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';
export const POOL_CREATED_TOPIC = '0x783cca1c0412dd0d695e784568c109d5c69c8ddc9b8b1f109c4e2f2b9e1e4f0b';

function topicAddress(topic: string): string {
  return `0x${topic.slice(-40)}`;
}

function word(data: string, index: number): string {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  return clean.slice(index * 64, (index + 1) * 64);
}

function wordAddress(data: string, index: number): string {
  return `0x${word(data, index).slice(-40)}`;
}

function wordNumber(data: string, index: number): number {
  return Number.parseInt(word(data, index) || '0', 16);
}

export function decodeFactoryLog(log: RpcLog, factory: FactoryConfig, chain: string, createdAt: string | null): FreshMarket | null {
  const topic0 = log.topics[0]?.toLowerCase();
  const blockNumber = Number.parseInt(log.blockNumber, 16);
  const logIndex = Number.parseInt(log.logIndex, 16);
  if (topic0 === PAIR_CREATED_TOPIC && factory.type === 'v2') {
    return {
      pair_address: wordAddress(log.data, 0),
      factory: log.address,
      protocol: factory.protocol,
      event_type: 'PairCreated',
      chain,
      tokens: [topicAddress(log.topics[1]), topicAddress(log.topics[2])],
      fee: null,
      init_liquidity: null,
      top_holders: [],
      created_at: createdAt,
      block_number: blockNumber,
      transaction_hash: log.transactionHash,
      log_index: logIndex
    };
  }
  if (topic0 === POOL_CREATED_TOPIC && factory.type === 'v3') {
    return {
      pair_address: wordAddress(log.data, 2),
      factory: log.address,
      protocol: factory.protocol,
      event_type: 'PoolCreated',
      chain,
      tokens: [topicAddress(log.topics[1]), topicAddress(log.topics[2])],
      fee: wordNumber(log.data, 0),
      init_liquidity: null,
      top_holders: [],
      created_at: createdAt,
      block_number: blockNumber,
      transaction_hash: log.transactionHash,
      log_index: logIndex
    };
  }
  return null;
}

export const testInternals = { topicAddress, wordAddress, wordNumber };
