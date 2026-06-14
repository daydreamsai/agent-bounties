import { buildPulseCalculationEvidence, fetchVenue } from './sources.js';
import { pulseInputSchema, type PulseOutput } from './types.js';

export async function runPerpsFundingPulse(rawInput: unknown): Promise<PulseOutput> {
  const input = pulseInputSchema.parse(rawInput ?? {});
  const results = await Promise.all(input.venue_ids.map(async (venue) => {
    try {
      return await fetchVenue(venue, input.markets, input.include_raw);
    } catch (error) {
      return { metrics: [], warnings: [`${venue}: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }));

  const metrics = results.flatMap((result) => result.metrics);
  const warnings = results.flatMap((result) => result.warnings);

  return {
    metrics,
    warnings,
    data_sources: ['hyperliquid:info', 'binance:fapi', 'bybit:v5', 'okx:v5'],
    calculation_evidence: buildPulseCalculationEvidence(),
    fetched_at: new Date().toISOString()
  };
}
