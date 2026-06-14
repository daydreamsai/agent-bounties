import { RpcClient } from './rpc.js';
import { classifyRisk } from './scoring.js';
import { inputSchema, type MevInput, type MevOutput } from './types.js';

export const agentMetadata = {
  name: 'mev-protection-scanner',
  version: '0.1.0',
  description: 'Scores MEV risk from live pending-block, fee-history, and optional transaction lookup signals.'
};

export async function runMevScanner(rawInput: unknown): Promise<MevOutput> {
  const input = inputSchema.parse(rawInput);
  return scanMev(input);
}

export async function scanMev(input: MevInput): Promise<MevOutput> {
  const startMs = Date.now();
  const chain = input.chain || 'eth';
  const rpc = new RpcClient(chain);
  const notes = [
    'Uses public RPC pending-block and fee-history signals; no private mempool stream or transaction signing is required.',
    'Risk score is an actionable pre-trade indicator, not a guarantee that a specific attacker will execute.'
  ];
  const dataSources = [`rpc:${chain}:pending-block`, `rpc:${chain}:fee-history`];

  const [pendingResult, feeHistory, tx] = await Promise.all([
    rpc.pendingBlock(input.max_pending_txs || 20).catch(() => []),
    rpc.feeHistory().catch(() => ({ p50: null, p90: null })),
    input.transaction_hash ? rpc.txByHash(input.transaction_hash).catch(() => null) : Promise.resolve(null)
  ]);
  const pending = pendingResult;
  if (input.transaction_hash) dataSources.push(`rpc:${chain}:transaction`);
  if (pending.length === 0) notes.push('pending block sample timed out or was unavailable; score falls back to fee-history and notional-size signals');
  if (feeHistory.p50 === null && feeHistory.p90 === null) notes.push('fee-history unavailable; gas percentile and priority-fee spread are partial');

  const amountUsd = estimateAmountUsd(input);
  if (!/^(usdc|usdt|dai|usd)$/i.test(input.token_in)) {
    notes.push('amount_in is treated as notional risk size because token USD conversion was not requested in the bounty input schema');
  }

  return classifyRisk({
    amountUsd,
    pending,
    userTx: tx,
    feeP50: feeHistory.p50,
    feeP90: feeHistory.p90,
    startMs,
    dataSources,
    notes
  });
}


function estimateAmountUsd(input: MevInput): number {
  const n = Number(input.amount_in);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}
