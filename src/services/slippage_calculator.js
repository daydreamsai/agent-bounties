// Import necessary libraries
const axios = require('axios');

class SlippageCalculator {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  // Calculate slippage for a given transaction
  async calculateSlippage(transactionDetails) {
    try {
      const { data } = await axios.post(`${this.apiUrl}/calculate-slippage`, transactionDetails);
      return data.slippage;
    } catch (error) {
      console.error('Error calculating slippage:', error);
      throw new Error('Slippage calculation failed');
    }
  }

  // Fetch external data to calculate slippage
  async fetchMarketData() {
    try {
      const { data } = await axios.get(`${this.apiUrl}/market-data`);
      return data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw new Error('Market data fetch failed');
    }
  }
}

module.exports = SlippageCalculator;
