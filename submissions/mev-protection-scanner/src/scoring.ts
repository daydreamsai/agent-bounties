import { gasPrice } from './rpc.js';
import type { MevCalculationEvidence, MevRiskClassification, PendingTxSample } from './types.js';

const swapSelectors = new Set([
  '0x38ed1739',
  '0x8803dbee',
  '0x7ff36ab5',
  '0x18cbafe5',
  '0x414bf389',
  '0xc04b8d59',
  '0x04e45aaf',
  '0x5023b4df'
]);

export function isSwapLike(tx: PendingTxSample): boolean {
  return swapSelectors.has(tx.input_prefix);
}

export function percentile(value: number, peers: number[]): number | null {
  const clean = peers.filter(Number.isFinite).sort((a, b) => a - b);
  if (!Number.isFinite(value) || clean.length === 0) return null;
  const belowOrEqual = clean.filter((peer) => peer <= value).length;
  return Math.round((belowOrEqual / clean.length) * 100);
}

export function classifyRisk(args: {
  amountUsd: number;
  pending: PendingTxSample[];
  userTx: PendingTxSample | null;
  feeP50: number | null;
  feeP90: number | null;
  startMs: number;
  dataSources: string[];
  notes: string[];
}): MevRiskClassification {
  const swapLike = args.pending.filter(isSwapLike);
  const gasPeers = args.pending.map(gasPrice).filter((n): n is number => n !== null);
  const userGas = args.userTx ? gasPrice(args.userTx) : args.feeP50;
  const gasPct = userGas === null ? null : percentile(userGas, gasPeers);
  const highGasCompetitors = userGas === null ? 0 : gasPeers.filter((gas) => gas > userGas * 1.15).length;
  const pendingSwapScore = Math.min(25, swapLike.length * 2);
  const gasScore = gasPct === null ? 10 : gasPct < 25 ? 30 : gasPct < 50 ? 20 : gasPct < 75 ? 10 : 0;
  const priorityFeeScore = args.feeP90 !== null && args.feeP50 !== null && args.feeP90 > args.feeP50 * 1.8 ? 15 : 0;
  const sizeScore = args.amountUsd >= 100_000 ? 25 : args.amountUsd >= 25_000 ? 18 : args.amountUsd >= 5_000 ? 10 : 4;
  const competitorScore = Math.min(20, highGasCompetitors * 3);
  const riskScore = Math.min(100, Math.round(pendingSwapScore + gasScore + priorityFeeScore + sizeScore + competitorScore));
  const attackType = riskScore >= 70 && highGasCompetitors >= 2 && swapLike.length >= 2
    ? 'sandwich'
    : riskScore >= 45 && highGasCompetitors >= 1
      ? 'front-run'
      : riskScore >= 30
        ? 'back-run'
        : 'none';
  const lossRate = attackType === 'sandwich' ? 0.008 : attackType === 'front-run' ? 0.004 : attackType === 'back-run' ? 0.0015 : 0;
  const suggestions = protectionSuggestions(riskScore, attackType);

  return {
    risk_score: riskScore,
    attack_type: attackType,
    estimated_loss_usd: Math.round(args.amountUsd * lossRate * 100) / 100,
    protection_suggestions: suggestions,
    competing_txs: highGasCompetitors,
    gas_price_percentile: gasPct,
    response_time_ms: Date.now() - args.startMs,
    signals: {
      pending_sample_size: args.pending.length,
      pending_swap_like_txs: swapLike.length,
      high_gas_competitors: highGasCompetitors,
      fee_history_p50_gwei: round(args.feeP50),
      fee_history_p90_gwei: round(args.feeP90),
      user_gas_gwei: round(userGas),
      transaction_found: args.userTx !== null
    },
    notes: args.notes,
    data_sources: args.dataSources,
    confidence: confidence(args.pending.length, gasPct, args.userTx !== null)
  };
}

export function buildMevCalculationEvidence(): MevCalculationEvidence {
  const now = Date.now();
  const cases = [
    {
      name: 'small trade with no swap competition is no MEV alert',
      expected_attack_type: 'none' as const,
      expected_min_risk_score: 0,
      output: classifyRisk({
        amountUsd: 1000,
        pending: [fixtureTx(20, '0x12345678'), fixtureTx(22, '0x12345678')],
        userTx: fixtureTx(80, '0x12345678'),
        feeP50: 20,
        feeP90: 28,
        startMs: now,
        dataSources: ['fixture'],
        notes: []
      })
    },
    {
      name: 'medium trade with swap flow but no high-gas competitor is back-run risk',
      expected_attack_type: 'back-run' as const,
      expected_min_risk_score: 30,
      output: classifyRisk({
        amountUsd: 25000,
        pending: [fixtureTx(20), fixtureTx(21), fixtureTx(22), fixtureTx(23), fixtureTx(24), fixtureTx(25)],
        userTx: fixtureTx(70),
        feeP50: 20,
        feeP90: 26,
        startMs: now,
        dataSources: ['fixture'],
        notes: []
      })
    },
    {
      name: 'large trade with high-gas competitor is front-run risk',
      expected_attack_type: 'front-run' as const,
      expected_min_risk_score: 45,
      output: classifyRisk({
        amountUsd: 50000,
        pending: [fixtureTx(100), fixtureTx(120), fixtureTx(90), fixtureTx(10, '0x12345678')],
        userTx: fixtureTx(20),
        feeP50: 20,
        feeP90: 100,
        startMs: now,
        dataSources: ['fixture'],
        notes: []
      })
    },
    {
      name: 'very large trade with several high-gas swaps is sandwich risk',
      expected_attack_type: 'sandwich' as const,
      expected_min_risk_score: 70,
      output: classifyRisk({
        amountUsd: 150000,
        pending: [fixtureTx(100), fixtureTx(120), fixtureTx(90), fixtureTx(80), fixtureTx(70)],
        userTx: fixtureTx(15),
        feeP50: 15,
        feeP90: 100,
        startMs: now,
        dataSources: ['fixture'],
        notes: []
      })
    }
  ];

  const results = cases.map((testCase) => {
    const pass =
      testCase.output.attack_type === testCase.expected_attack_type &&
      testCase.output.risk_score >= testCase.expected_min_risk_score &&
      (testCase.expected_attack_type === 'none' ? testCase.output.estimated_loss_usd === 0 : testCase.output.estimated_loss_usd > 0);
    return {
      name: testCase.name,
      expected_attack_type: testCase.expected_attack_type,
      actual_attack_type: testCase.output.attack_type,
      risk_score: testCase.output.risk_score,
      expected_min_risk_score: testCase.expected_min_risk_score,
      gas_price_percentile: testCase.output.gas_price_percentile,
      estimated_loss_usd: testCase.output.estimated_loss_usd,
      pass
    };
  });
  const passCount = results.filter((testCase) => testCase.pass).length;
  return {
    case_count: results.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / results.length) * 10000) / 100,
    cases: results
  };
}

function fixtureTx(gas: number, inputPrefix = '0x38ed1739'): PendingTxSample {
  return {
    hash: '0x',
    to: null,
    from: null,
    gas_price_gwei: gas,
    max_fee_per_gas_gwei: null,
    input_prefix: inputPrefix,
    value_eth: 0
  };
}

function protectionSuggestions(score: number, attackType: string): string[] {
  const suggestions = ['Use a private transaction route such as Flashbots Protect or MEV Blocker for large swaps'];
  if (score >= 45) suggestions.push('Reduce slippage tolerance and split the order into smaller chunks');
  if (attackType === 'sandwich') suggestions.push('Avoid public mempool execution for this trade; use an RFQ or batch-auction venue such as CoW Swap');
  suggestions.push('Set a short transaction deadline and simulate the route immediately before signing');
  return suggestions;
}

function confidence(pendingCount: number, gasPct: number | null, hasTx: boolean): number {
  let score = 0.35;
  if (pendingCount > 0) score += 0.25;
  if (pendingCount >= 20) score += 0.15;
  if (gasPct !== null) score += 0.15;
  if (hasTx) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

function round(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
}
