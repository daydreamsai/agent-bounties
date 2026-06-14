export { runFreshMarketsWatch } from './watch.js';

export const agentMetadata = {
  name: 'fresh-markets-watch',
  version: '0.1.0',
  description: 'Scans AMM factory PairCreated and PoolCreated logs for newly created pools in a recent block window.'
};
