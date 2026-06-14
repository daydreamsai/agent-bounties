export { runLendingLiquidationSentinel } from './sentinel.js';

export const agentMetadata = {
  name: 'lending-liquidation-sentinel',
  version: '0.1.0',
  description: 'Reads Aave V3 account health factors and emits early liquidation risk alerts.'
};
