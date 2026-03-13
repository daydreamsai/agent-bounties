// GasRoute Oracle Agent Entry Point

const GasRouteOracleAgent = require('./agent');

const agentConfig = {
  apiBaseUrl: 'https://api.gasprice.io',
  chainIds: ['1', '56', '137'] // Ethereum, Binance Smart Chain, Polygon
};

const gasRouteAgent = new GasRouteOracleAgent(agentConfig);

gasRouteAgent.on('gasPrices', (gasPrices) => {
  console.log('Fetched multi-chain gas prices:', gasPrices);
});

gasRouteAgent.run();
