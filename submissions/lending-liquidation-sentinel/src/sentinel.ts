import { buildLiquidationCalculationEvidence, fetchAaveAccountRisk } from './aave.js';
import { sentinelInputSchema, type SentinelOutput } from './types.js';

export async function runLendingLiquidationSentinel(rawInput: unknown): Promise<SentinelOutput> {
  const input = sentinelInputSchema.parse(rawInput);
  const warnings: string[] = [];
  const positions = [];
  for (const protocolId of input.protocol_ids) {
    try {
      positions.push(await fetchAaveAccountRisk(protocolId, input.wallet, input.alert_threshold, input.positions));
    } catch (error) {
      warnings.push(`${protocolId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    positions,
    warnings,
    data_sources: ['aave-v3:Pool.getUserAccountData'],
    calculation_evidence: buildLiquidationCalculationEvidence(),
    fetched_at: new Date().toISOString()
  };
}
