import { runGasRouteOracle } from './oracle.js';

export const agentMetadata = {
  name: 'gasroute-oracle',
  version: '0.1.0',
  description: 'Chooses the cheapest supported EVM chain for a gas load using live RPC gas data and native token USD prices.'
};

export { runGasRouteOracle };