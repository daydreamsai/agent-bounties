import 'dotenv/config';
import { runYieldPoolWatcher } from './watcher.js';

const input = {
  protocol_ids: (process.env.YIELD_PROTOCOL_IDS ?? 'aave-v3').split(',').map((item) => item.trim()).filter(Boolean),
  pools: (process.env.YIELD_POOLS ?? '').split(',').map((item) => item.trim()).filter(Boolean),
  limit: Number(process.env.YIELD_LIMIT ?? 5),
  include_charts: process.env.YIELD_INCLUDE_CHARTS !== 'false',
  threshold_rules: {
    tvl_drop_pct: Number(process.env.YIELD_TVL_DROP_PCT ?? 10),
    apy_spike_pct: Number(process.env.YIELD_APY_SPIKE_PCT ?? 50),
    apy_abs_change: Number(process.env.YIELD_APY_ABS_CHANGE ?? 5)
  }
};

const output = await runYieldPoolWatcher(input);
console.log(JSON.stringify(output, null, 2));