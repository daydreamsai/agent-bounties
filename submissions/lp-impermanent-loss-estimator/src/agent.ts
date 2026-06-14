import { runLpIlEstimator } from './estimator.js';

export const agentMetadata = {
  name: 'lp-impermanent-loss-estimator',
  version: '0.1.0',
  description: 'Calculates LP impermanent loss and fee APR from observed AMM pool price, volume, and TVL data.'
};

export { runLpIlEstimator };
