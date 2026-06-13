import { runLendingLiquidationSentinel } from './agent.js';

const output = await runLendingLiquidationSentinel({
  wallet: process.env.SENTINEL_WALLET || '0x0000000000000000000000000000000000000001',
  protocol_ids: (process.env.SENTINEL_PROTOCOL_IDS || 'aave-v3-base').split(',').map((value) => value.trim()).filter(Boolean),
  alert_threshold: Number(process.env.SENTINEL_ALERT_THRESHOLD || 1.2)
});
console.log(JSON.stringify(output, null, 2));
