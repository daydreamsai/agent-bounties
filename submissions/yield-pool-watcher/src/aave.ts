import type { BlockLevelYieldSignal, ThresholdRules, YieldAlert } from './types.js';

const RESERVE_DATA_UPDATED_TOPIC = '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a';

const AAVE_V3_BASE = {
  protocol: 'aave-v3',
  chain: 'base',
  pool: '0xa238dd80c259a72e81d7e4664a9801593f98d1c5',
  rpcUrl: process.env.AAVE_BASE_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  avgBlockSeconds: 2
};

interface RpcLog {
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

class RpcClient {
  constructor(private readonly url: string) {}

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'yield-pool-watcher/0.1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const payload = await response.json() as { result?: T; error?: { message?: string } };
    if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC HTTP ${response.status}`);
    return payload.result as T;
  }

  async blockNumber(): Promise<number> {
    return Number.parseInt(await this.call<string>('eth_blockNumber', []), 16);
  }

  async getLogs(fromBlock: number, toBlock: number, address: string): Promise<RpcLog[]> {
    return this.call<RpcLog[]>('eth_getLogs', [{
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      address,
      topics: [RESERVE_DATA_UPDATED_TOPIC]
    }]);
  }

  async blockTimestamp(blockNumber: number): Promise<string | null> {
    const block = await this.call<{ timestamp?: string } | null>('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]);
    return block?.timestamp ? new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString() : null;
  }
}

function topicAddress(topic: string | undefined): string {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return '0x0000000000000000000000000000000000000000';
  return `0x${topic.slice(26)}`.toLowerCase();
}

function word(data: string, index: number): bigint {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  const start = index * 64;
  const chunk = clean.slice(start, start + 64);
  return BigInt(`0x${chunk || '0'}`);
}

function rayToApyPct(value: bigint): number {
  return Math.round((Number(value) / 1e27) * 100 * 1_000_000) / 1_000_000;
}

export function decodeReserveDataUpdated(log: RpcLog, timestamp: string | null): BlockLevelYieldSignal {
  const blockNumber = Number.parseInt(log.blockNumber, 16);
  const logIndex = Number.parseInt(log.logIndex, 16);
  const liquidityRate = word(log.data, 0);
  const variableBorrowRate = word(log.data, 2);
  return {
    protocol: AAVE_V3_BASE.protocol,
    chain: AAVE_V3_BASE.chain,
    pool: AAVE_V3_BASE.pool,
    reserve: topicAddress(log.topics[1]),
    block_number: blockNumber,
    block_timestamp: timestamp,
    transaction_hash: log.transactionHash,
    log_index: logIndex,
    liquidity_rate_ray: liquidityRate.toString(),
    liquidity_apy_pct: rayToApyPct(liquidityRate),
    variable_borrow_rate_ray: variableBorrowRate.toString(),
    variable_borrow_apy_pct: rayToApyPct(variableBorrowRate),
    source: 'aave-v3:ReserveDataUpdated'
  };
}

function shouldScanAave(protocolIds: string[]): boolean {
  if (protocolIds.length === 0) return true;
  const normalized = protocolIds.map((value) => value.trim().toLowerCase());
  return normalized.includes('aave-v3') || normalized.includes('aave') || normalized.includes('aave v3');
}

export async function fetchAaveV3BaseSignals(input: { protocolIds: string[]; windowMinutes: number; rules: ThresholdRules }): Promise<{ signals: BlockLevelYieldSignal[]; alerts: YieldAlert[]; warnings: string[]; evidence: { enabled: boolean; latest_block: number | null; from_block: number | null; to_block: number | null; raw_log_count: number; decoded_signal_count: number; source: string } }> {
  const emptyEvidence = { enabled: false, latest_block: null, from_block: null, to_block: null, raw_log_count: 0, decoded_signal_count: 0, source: 'aave-v3:ReserveDataUpdated' };
  if (!shouldScanAave(input.protocolIds)) return { signals: [], alerts: [], warnings: [], evidence: emptyEvidence };

  try {
    const rpc = new RpcClient(AAVE_V3_BASE.rpcUrl);
    const latest = await rpc.blockNumber();
    const requestedBlocks = Math.ceil((input.windowMinutes * 60) / AAVE_V3_BASE.avgBlockSeconds);
    const scanBlocks = Math.min(Math.max(requestedBlocks, 1), 500);
    const fromBlock = Math.max(0, latest - scanBlocks);
    const logs = await rpc.getLogs(fromBlock, latest, AAVE_V3_BASE.pool);
    const timestamps = new Map<number, string | null>();
    const signals: BlockLevelYieldSignal[] = [];
    for (const log of logs) {
      const blockNumber = Number.parseInt(log.blockNumber, 16);
      if (!timestamps.has(blockNumber)) timestamps.set(blockNumber, await rpc.blockTimestamp(blockNumber));
      signals.push(decodeReserveDataUpdated(log, timestamps.get(blockNumber) ?? null));
    }
    signals.sort((a, b) => a.block_number - b.block_number || a.log_index - b.log_index);
    const alerts = buildBlockLevelAlerts(signals, input.rules);
    return {
      signals,
      alerts,
      warnings: [],
      evidence: { enabled: true, latest_block: latest, from_block: fromBlock, to_block: latest, raw_log_count: logs.length, decoded_signal_count: signals.length, source: 'aave-v3:ReserveDataUpdated' }
    };
  } catch (error) {
    return { signals: [], alerts: [], warnings: [`aave-v3-base block-level scan failed: ${error instanceof Error ? error.message : String(error)}`], evidence: emptyEvidence };
  }
}

export function buildBlockLevelAlerts(signals: BlockLevelYieldSignal[], rules: ThresholdRules): YieldAlert[] {
  const byReserve = new Map<string, BlockLevelYieldSignal[]>();
  for (const signal of signals) byReserve.set(signal.reserve, [...(byReserve.get(signal.reserve) ?? []), signal]);
  const alerts: YieldAlert[] = [];
  for (const [reserve, reserveSignals] of byReserve) {
    for (let index = 1; index < reserveSignals.length; index += 1) {
      const previous = reserveSignals[index - 1];
      const current = reserveSignals[index];
      const delta = Math.round((current.liquidity_apy_pct - previous.liquidity_apy_pct) * 1_000_000) / 1_000_000;
      if (Math.abs(delta) >= rules.apy_abs_change) {
        alerts.push({
          pool: `aave-v3-base:${reserve}`,
          project: 'aave-v3',
          chain: 'base',
          severity: Math.abs(delta) >= rules.apy_abs_change * 5 ? 'high' : 'medium',
          type: 'apy_abs_change',
          message: `Aave V3 Base liquidity APY changed ${delta.toFixed(6)} points within block ${current.block_number}`,
          observed_value: delta,
          threshold: rules.apy_abs_change,
          source: 'aave-v3:ReserveDataUpdated',
          block_number: current.block_number,
          transaction_hash: current.transaction_hash
        });
      }
    }
  }
  return alerts;
}

export const aaveTestInternals = { decodeReserveDataUpdated, buildBlockLevelAlerts, rayToApyPct };
