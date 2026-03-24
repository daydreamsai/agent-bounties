import { z } from 'zod';
import { createAgentApp } from '@lucid-dreams/agent-kit';
import { checkPosition, simulateLiquidation, PROTOCOL_ADDRESSES } from './protocols.js';

const { app, addEntrypoint } = createAgentApp({
  name: 'lending-liquidation-sentinel-v2',
  version: '1.0.0',
  description: 'Watch borrow positions and warn before liquidation risk. Supports Aave v3, Compound v3, and Morpho Blue across multiple chains.',
});

// Schema definitions
const CheckPositionInput = z.object({
  wallet: z.string()
    .describe('Wallet address to monitor')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  protocol_ids: z.array(z.enum(['aave-v3', 'compound-v3', 'morpho']))
    .describe('Lending protocols to check')
    .default(['aave-v3', 'compound-v3', 'morpho']),
  chain: z.enum(['ethereum', 'arbitrum', 'polygon', 'optimism', 'base', 'avalanche'])
    .describe('Blockchain network')
    .default('ethereum'),
  alert_threshold: z.number()
    .describe('Health factor threshold below which alert fires')
    .min(1.0)
    .max(2.0)
    .default(1.3)
});

const SimulateLiquidationInput = z.object({
  current_health_factor: z.number()
    .describe('Current health factor of the position')
    .min(0),
  price_drops: z.array(z.number())
    .describe('Price drop percentages to simulate')
    .default([5, 10, 15, 20, 25, 30, 40, 50])
});

const SupportedProtocolsInput = z.object({});

// Entrypoint 1: Check Position
addEntrypoint({
  key: 'check_position',
  description: 'Check lending position health factor and get liquidation alerts for a wallet',
  input: CheckPositionInput,
  output: z.object({
    positions: z.array(z.object({
      health_factor: z.number(),
      liq_price_threshold: z.number(),
      buffer_percent: z.number(),
      alert_threshold_hit: z.boolean(),
      alert_level: z.enum(['safe', 'warning', 'danger', 'critical']),
      collateral_usd: z.number(),
      debt_usd: z.number(),
      protocol: z.string(),
      chain: z.string()
    })),
    summary: z.object({
      total_collateral_usd: z.number(),
      total_debt_usd: z.number(),
      lowest_health_factor: z.number(),
      highest_risk_protocol: z.string().optional(),
      any_alert_triggered: z.boolean()
    }),
    warnings: z.array(z.string()).optional()
  }),
  async handler({ input }) {
    const startTime = Date.now();
    
    try {
      const alerts = await checkPosition(
        input.wallet,
        input.protocol_ids,
        input.chain,
        input.alert_threshold
      );

      if (alerts.length === 0) {
        return {
          output: {
            positions: [],
            summary: {
              total_collateral_usd: 0,
              total_debt_usd: 0,
              lowest_health_factor: Infinity,
              any_alert_triggered: false
            },
            warnings: ['No positions found for the specified wallet and protocols']
          },
          usage: {
            total_tokens: 0,
            duration_ms: Date.now() - startTime
          }
        };
      }

      // Calculate summary
      const totalCollateral = alerts.reduce((sum, a) => sum + a.collateralUSD, 0);
      const totalDebt = alerts.reduce((sum, a) => sum + a.debtUSD, 0);
      const lowestHF = Math.min(...alerts.map(a => a.healthFactor));
      const highestRisk = alerts.find(a => a.healthFactor === lowestHF);
      const anyAlert = alerts.some(a => a.alertThresholdHit);

      const warnings: string[] = [];
      alerts.forEach(a => {
        if (a.alertLevel === 'critical') {
          warnings.push(`CRITICAL: ${a.protocol} position at immediate liquidation risk!`);
        } else if (a.alertLevel === 'danger') {
          warnings.push(`DANGER: ${a.protocol} position health factor is dangerously low`);
        }
      });

      return {
        output: {
          positions: alerts,
          summary: {
            total_collateral_usd: Math.round(totalCollateral * 100) / 100,
            total_debt_usd: Math.round(totalDebt * 100) / 100,
            lowest_health_factor: Math.round(lowestHF * 10000) / 10000,
            highest_risk_protocol: highestRisk?.protocol,
            any_alert_triggered: anyAlert
          },
          warnings: warnings.length > 0 ? warnings : undefined
        },
        usage: {
          total_tokens: JSON.stringify(alerts).length,
          duration_ms: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        output: {
          positions: [],
          summary: {
            total_collateral_usd: 0,
            total_debt_usd: 0,
            lowest_health_factor: 0,
            any_alert_triggered: false
          },
          warnings: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        },
        usage: {
          total_tokens: 0,
          duration_ms: Date.now() - startTime
        }
      };
    }
  }
});

// Entrypoint 2: Simulate Liquidation
addEntrypoint({
  key: 'simulate_liquidation',
  description: 'Simulate how health factor would change under different collateral price drops',
  input: SimulateLiquidationInput,
  output: z.object({
    simulations: z.array(z.object({
      price_drop_percent: z.number(),
      projected_health_factor: z.number(),
      would_liquidate: z.boolean()
    })),
    safe_drop_percent: z.number().describe('Maximum price drop before liquidation'),
    warning: z.string().optional()
  }),
  async handler({ input }) {
    const simulations = simulateLiquidation(input.current_health_factor, input.price_drops);
    
    // Find the safe drop threshold
    let safeDrop = 0;
    for (const sim of simulations) {
      if (!sim.wouldLiquidate) {
        safeDrop = Math.max(safeDrop, sim.priceDropPercent);
      }
    }

    // Calculate exact safe drop
    if (input.current_health_factor > 1) {
      const exactSafeDrop = (1 - 1 / input.current_health_factor) * 100;
      safeDrop = Math.round(exactSafeDrop * 100) / 100;
    }

    const warning = input.current_health_factor < 1.2
      ? 'Current health factor is already in danger zone. Immediate action required!'
      : input.current_health_factor < 1.5
        ? 'Current health factor is in warning zone. Consider reducing position.'
        : undefined;

    return {
      output: {
        simulations,
        safe_drop_percent: safeDrop,
        warning
      },
      usage: {
        total_tokens: JSON.stringify(simulations).length
      }
    };
  }
});

// Entrypoint 3: Get Supported Protocols
addEntrypoint({
  key: 'supported_protocols',
  description: 'Get list of supported protocols and chains with their contract addresses',
  input: SupportedProtocolsInput,
  output: z.object({
    protocols: z.array(z.object({
      name: z.string(),
      chains: z.array(z.string()),
      addresses: z.record(z.string(), z.string())
    }))
  }),
  async handler() {
    const protocols = Object.entries(PROTOCOL_ADDRESSES).map(([name, chains]) => ({
      name,
      chains: Object.keys(chains),
      addresses: Object.fromEntries(
        Object.entries(chains).flatMap(([chain, addrs]) =>
          Object.entries(addrs).map(([type, addr]) => [`${chain}_${type}`, addr])
        )
      )
    }));

    return {
      output: { protocols },
      usage: {
        total_tokens: JSON.stringify(protocols).length
      }
    };
  }
});

// Entrypoint 4: Echo (health check)
addEntrypoint({
  key: 'echo',
  description: 'Echo a message for health check',
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: {
        text: input.text ?? 'Lending Liquidation Sentinel v2 is operational',
        timestamp: new Date().toISOString(),
        supported_protocols: ['aave-v3', 'compound-v3', 'morpho'],
        supported_chains: ['ethereum', 'arbitrum', 'polygon', 'optimism', 'base', 'avalanche']
      },
      usage: {
        total_tokens: (input.text ?? '').length
      }
    };
  }
});

export default app;