import { runSlippageSentinel } from './slippage.js';

export const agentMetadata = {
  name: 'slippage-sentinel',
  version: '0.1.0',
  description: 'Suggests safe swap slippage from live pool depth, recent trade sizes, and short-window volatility.'
};

export { runSlippageSentinel };
