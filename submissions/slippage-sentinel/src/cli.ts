import 'dotenv/config';
import { runSlippageSentinel } from './slippage.js';

const input = {
  chain: process.env.SLIPPAGE_CHAIN ?? 'base',
  token_in: process.env.SLIPPAGE_TOKEN_IN ?? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  token_out: process.env.SLIPPAGE_TOKEN_OUT ?? '0x4200000000000000000000000000000000000006',
  amount_in: process.env.SLIPPAGE_AMOUNT_IN ?? '1000',
  route_hint: process.env.SLIPPAGE_POOL_ADDRESS ? { pool_address: process.env.SLIPPAGE_POOL_ADDRESS } : undefined
};

const output = await runSlippageSentinel(input);
console.log(JSON.stringify(output, null, 2));
