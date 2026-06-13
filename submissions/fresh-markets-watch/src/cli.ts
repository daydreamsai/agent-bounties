import { runFreshMarketsWatch } from './agent.js';

const output = await runFreshMarketsWatch({
  chain: process.env.FRESH_CHAIN || 'base',
  window_minutes: Number(process.env.FRESH_WINDOW_MINUTES || 10),
  from_block: process.env.FRESH_FROM_BLOCK ? Number(process.env.FRESH_FROM_BLOCK) : undefined
});
console.log(JSON.stringify(output, null, 2));
