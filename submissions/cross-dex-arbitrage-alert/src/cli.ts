import { runCrossDexArb } from './agent.js';

const input = {
  token_in: process.env.ARB_TOKEN_IN || '0x4200000000000000000000000000000000000006',
  token_out: process.env.ARB_TOKEN_OUT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount_in: process.env.ARB_AMOUNT_IN || '1',
  chains: (process.env.ARB_CHAINS || 'base').split(','),
  threshold_bps: Number(process.env.ARB_THRESHOLD_BPS || 0)
};

console.log(JSON.stringify(await runCrossDexArb(input), null, 2));
