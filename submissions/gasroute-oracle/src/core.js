const GWEI = 1_000_000_000;
const WEI_PER_NATIVE = 1_000_000_000_000_000_000;

export const DEFAULT_CHAINS = {
  ethereum: {
    chainId: 1,
    symbol: "ETH",
    coingeckoId: "ethereum",
    rpcEnv: "ETHEREUM_RPC_URL",
    rpcUrl: "https://ethereum.publicnode.com",
    calldataGasPerByte: 16,
    l1DataFeeMultiplier: 0
  },
  base: {
    chainId: 8453,
    symbol: "ETH",
    coingeckoId: "ethereum",
    rpcEnv: "BASE_RPC_URL",
    rpcUrl: "https://base.publicnode.com",
    calldataGasPerByte: 16,
    l1DataFeeMultiplier: 0.18
  },
  arbitrum: {
    chainId: 42161,
    symbol: "ETH",
    coingeckoId: "ethereum",
    rpcEnv: "ARBITRUM_RPC_URL",
    rpcUrl: "https://arbitrum-one.publicnode.com",
    calldataGasPerByte: 16,
    l1DataFeeMultiplier: 0.12
  },
  optimism: {
    chainId: 10,
    symbol: "ETH",
    coingeckoId: "ethereum",
    rpcEnv: "OPTIMISM_RPC_URL",
    rpcUrl: "https://optimism.publicnode.com",
    calldataGasPerByte: 16,
    l1DataFeeMultiplier: 0.16
  },
  polygon: {
    chainId: 137,
    symbol: "POL",
    coingeckoId: "polygon-ecosystem-token",
    rpcEnv: "POLYGON_RPC_URL",
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    calldataGasPerByte: 16,
    l1DataFeeMultiplier: 0
  }
};

export function normalizeChainName(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function classifyBusyLevel(baseFeeGwei, rewardGwei) {
  const pressure = Number(baseFeeGwei) + Number(rewardGwei) * 2;
  if (pressure >= 80) return "extreme";
  if (pressure >= 35) return "high";
  if (pressure >= 10) return "medium";
  return "low";
}

export function computeFee({ gasUnitsEst, calldataSizeBytes, baseFeeGwei, priorityFeeGwei, chain }) {
  const executionGas = Math.max(21_000, Number(gasUnitsEst || 0));
  const calldataGas = Math.max(0, Number(calldataSizeBytes || 0)) * (chain.calldataGasPerByte || 16);
  const totalGas = executionGas + calldataGas;
  const gasPriceGwei = Number(baseFeeGwei) + Number(priorityFeeGwei);
  const executionFeeNative = (totalGas * gasPriceGwei * GWEI) / WEI_PER_NATIVE;
  const l1DataFeeNative = executionFeeNative * (chain.l1DataFeeMultiplier || 0);
  return {
    totalGas,
    feeNative: executionFeeNative + l1DataFeeNative
  };
}

async function rpcCall(rpcUrl, method, params = [], fetchImpl = fetch) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  if (!response.ok) {
    throw new Error(`rpc ${method} failed: ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`rpc ${method} failed: ${payload.error.message || payload.error.code}`);
  }
  return payload.result;
}

function hexToGwei(hexValue) {
  return Number(BigInt(hexValue || "0x0")) / GWEI;
}

export async function fetchGasSample(chain, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const rpcUrl = options.rpcUrl || process.env?.[chain.rpcEnv] || chain.rpcUrl;
  const feeHistory = await rpcCall(
    rpcUrl,
    "eth_feeHistory",
    ["0x5", "latest", [25, 50, 75]],
    fetchImpl
  );

  const baseFees = (feeHistory.baseFeePerGas || []).map(hexToGwei);
  const rewards = (feeHistory.reward || []).flat().map(hexToGwei);
  const latestBaseFee = baseFees.at(-1) || hexToGwei(await rpcCall(rpcUrl, "eth_gasPrice", [], fetchImpl));
  const priorityFee = percentile(rewards.length ? rewards : [1], 0.75);

  return {
    baseFeeGwei: latestBaseFee,
    priorityFeeGwei: Math.max(0.01, priorityFee),
    source: rpcUrl
  };
}

export async function fetchNativePriceUsd(coingeckoId, options = {}) {
  if (options.priceOverrides?.[coingeckoId]) return options.priceOverrides[coingeckoId];
  const fetchImpl = options.fetchImpl || fetch;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`coingecko price failed: ${response.status}`);
  const payload = await response.json();
  return Number(payload?.[coingeckoId]?.usd || 0);
}

export function percentile(values, pct) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * pct) - 1));
  return sorted[idx];
}

export async function estimateGasRoute(input, options = {}) {
  const chains = options.chains || DEFAULT_CHAINS;
  const requested = Array.isArray(input.chain_set) && input.chain_set.length
    ? input.chain_set.map(normalizeChainName)
    : Object.keys(chains);

  const estimates = [];
  for (const chainName of requested) {
    const chain = chains[chainName];
    if (!chain) continue;

    const sample = options.gasOverrides?.[chainName] || await fetchGasSample(chain, options);
    const priceUsd = await fetchNativePriceUsd(chain.coingeckoId, options);
    const fee = computeFee({
      gasUnitsEst: input.gas_units_est,
      calldataSizeBytes: input.calldata_size_bytes,
      baseFeeGwei: sample.baseFeeGwei,
      priorityFeeGwei: sample.priorityFeeGwei,
      chain
    });

    estimates.push({
      chain: chainName,
      chain_id: chain.chainId,
      native_symbol: chain.symbol,
      fee_native: round(fee.feeNative, 12),
      fee_usd: round(fee.feeNative * priceUsd, 6),
      busy_level: classifyBusyLevel(sample.baseFeeGwei, sample.priorityFeeGwei),
      tip_hint: `${round(sample.priorityFeeGwei, 3)} gwei`,
      gas_price_gwei: round(sample.baseFeeGwei + sample.priorityFeeGwei, 3),
      estimated_gas_units: fee.totalGas,
      source: sample.source || "override"
    });
  }

  if (!estimates.length) {
    throw new Error("No supported chains in chain_set");
  }

  estimates.sort((a, b) => a.fee_usd - b.fee_usd);
  return {
    ...estimates[0],
    alternatives: estimates.slice(1),
    checked_at: new Date().toISOString()
  };
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

