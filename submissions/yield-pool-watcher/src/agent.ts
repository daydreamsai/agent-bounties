import { runYieldPoolWatcher } from './watcher.js';

export const agentMetadata = {
  name: 'yield-pool-watcher',
  version: '0.1.0',
  description: 'Tracks DeFi pool APY/TVL metrics from DefiLlama and emits threshold-based spike/drain alerts.'
};

export { runYieldPoolWatcher };