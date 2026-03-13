// GasRoute Oracle Agent Implementation

const { Agent } = require('@lucid-dreams/agent-kit');
const axios = require('axios');

class GasRouteOracleAgent extends Agent {
  constructor(config) {
    super(config);
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.gasprice.io';
    this.chainIds = config.chainIds || ['1', '56', '137']; // Default to Ethereum, Binance Smart Chain, Polygon
  }

  async getGasPrice(chainId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/gas-price/${chainId}`);
      return response.data.gasPrice;
    } catch (error) {
      console.error(`Error fetching gas price for chain ${chainId}:`, error);
      return null;
    }
  }

  async getMultiChainGasPrices() {
    const gasPrices = {};
    for (let chainId of this.chainIds) {
      const price = await this.getGasPrice(chainId);
      if (price !== null) {
        gasPrices[chainId] = price;
      }
    }
    return gasPrices;
  }

  async run() {
    try {
      const gasPrices = await this.getMultiChainGasPrices();
      this.emit('gasPrices', gasPrices);
    } catch (error) {
      console.error('Error fetching multi-chain gas prices:', error);
    }
  }
}

module.exports = GasRouteOracleAgent;
