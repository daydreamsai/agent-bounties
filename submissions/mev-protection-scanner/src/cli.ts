import { runMevScanner } from './agent.js';

const input = {
  token_in: process.env.MEV_TOKEN_IN || 'USDC',
  token_out: process.env.MEV_TOKEN_OUT || 'ETH',
  amount_in: process.env.MEV_AMOUNT_IN || '10000',
  dex: process.env.MEV_DEX || 'uniswap-v2',
  chain: process.env.MEV_CHAIN || 'eth',
  transaction_hash: process.env.MEV_TRANSACTION_HASH || undefined,
  max_pending_txs: Number(process.env.MEV_MAX_PENDING_TXS || 20)
};

console.log(JSON.stringify(await runMevScanner(input), null, 2));
