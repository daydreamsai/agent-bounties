
// RPC configuration for live gas estimates
const RPCS = {
  ethereum: 'https://cloudflare-eth.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com'
};

// Fetch token prices in USD
async function getUSDPrices() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network&vs_currencies=usd');
    const data = await res.json();
    return {
      eth: data['ethereum']?.usd || 3000,
      matic: data['matic-network']?.usd || 0.70
    };
  } catch (err) {
    console.warn('Price fetch error, using fallbacks:', err.message);
    return { eth: 3000, matic: 0.70 };
  }
}

// Fetch live gas price from RPC
async function getGasPrice(chain) {
  const url = RPCS[chain];
  if (!url) return 100000000;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: []
      })
    });
    const data = await res.json();
    const hexPrice = data.result;
    if (!hexPrice) throw new Error('No gasPrice result');
    const parsed = parseInt(hexPrice, 16);
    return isNaN(parsed) ? 100000000 : parsed;
  } catch (err) {
    console.warn(`Failed to get live gas price for ${chain}, using fallback:`, err.message);
    const fallbacks = { 
      ethereum: 30000000000, 
      base: 100000000, 
      optimism: 100000000, 
      arbitrum: 100000000, 
      polygon: 50000000000 
    };
    return fallbacks[chain] || 100000000;
  }
}

// Calculate precise L1 Data Fee for L2s (Optimism/Base/Arbitrum)
function calculateL1DataFee(calldataSize, l1BaseFeeWei) {
  const l1GasUsed = calldataSize * 16 + 2100;
  return BigInt(l1GasUsed) * BigInt(l1BaseFeeWei);
}

// Main oracle handler
export async function evaluateGasRoute(chainSet, calldataSize, gasUnitsEst) {
  const prices = await getUSDPrices();
  const l1GasPriceWei = await getGasPrice('ethereum');
  
  const results = [];
  
  for (const chain of chainSet) {
    const cleanChain = chain.toLowerCase().trim();
    if (!RPCS[cleanChain]) continue;
    
    const l2GasPriceWei = await getGasPrice(cleanChain);
    let feeWei = BigInt(l2GasPriceWei) * BigInt(gasUnitsEst);
    
    // Add L1 Data Fee for L2 rollups (optimism, base, arbitrum)
    if (['optimism', 'base', 'arbitrum'].includes(cleanChain)) {
      const l1Fee = calculateL1DataFee(calldataSize, l1GasPriceWei);
      feeWei += l1Fee / 10n; // scaled down based on rollup compression ratios
    }
    
    const nativeTokenPrice = cleanChain === 'polygon' ? prices.matic : prices.eth;
    const feeNative = Number(feeWei) / 1e18;
    const feeUSD = feeNative * nativeTokenPrice;
    
    // Busy level based on gas price relative to average
    let busyLevel = 'low';
    const gwei = Number(l2GasPriceWei) / 1e9;
    if (cleanChain === 'ethereum') {
      if (gwei > 50) busyLevel = 'high';
      else if (gwei > 20) busyLevel = 'medium';
    } else {
      if (gwei > 2) busyLevel = 'high';
      else if (gwei > 0.5) busyLevel = 'medium';
    }
    
    // Suggested priority fee tip hint
    const tipHintGwei = cleanChain === 'ethereum' ? '1.5' : '0.1';
    
    results.push({
      chain: cleanChain,
      fee_native: feeNative.toFixed(12),
      fee_usd: Number(feeUSD.toFixed(6)),
      busy_level: busyLevel,
      tip_hint: tipHintGwei
    });
  }
  
  // Sort by lowest fee in USD
  results.sort((a, b) => a.fee_usd - b.fee_usd);
  return results[0];
}
