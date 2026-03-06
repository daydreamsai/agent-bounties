/**
 * Cross-DEX Arbitrage Detection Engine
 *
 * Queries multiple DEX aggregator APIs (Paraswap, 0x, DexScreener) to find
 * price discrepancies for a given token pair, then calculates net profitability
 * after accounting for gas costs and protocol fees.
 */

// ---------------------------------------------------------------------------
// Token registry & chain config
// ---------------------------------------------------------------------------

/** Well-known token addresses per chain (checksummed, Ethereum mainnet shown). */
const TOKEN_ADDRESSES: Record<string, Record<string, { address: string; decimals: number }>> = {
  ethereum: {
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
    UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
  },
  base: {
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    DAI: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  },
  arbitrum: {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  },
  polygon: {
    WETH: { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
    MATIC: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    DAI: { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
  },
  optimism: {
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  },
};

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
};

/** Typical swap gas units and current average gas price (gwei) per chain. */
const GAS_ESTIMATES: Record<string, { swapGas: number; gasPriceGwei: number; nativeUsdPrice: number }> = {
  ethereum: { swapGas: 180_000, gasPriceGwei: 25, nativeUsdPrice: 3000 },
  base: { swapGas: 180_000, gasPriceGwei: 0.01, nativeUsdPrice: 3000 },
  arbitrum: { swapGas: 800_000, gasPriceGwei: 0.1, nativeUsdPrice: 3000 },
  polygon: { swapGas: 200_000, gasPriceGwei: 50, nativeUsdPrice: 0.5 },
  optimism: { swapGas: 180_000, gasPriceGwei: 0.01, nativeUsdPrice: 3000 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArbitrageInput {
  token_in: string;
  token_out: string;
  amount_in: string;
  chains: string[];
  min_spread_bps: number;
}

interface DexQuote {
  dex: string;
  outputAmount: bigint;
  outputHuman: number;
  chain: string;
  gasEstimateUsd: number;
  feeBps: number;
}

interface Opportunity {
  buy_dex: string;
  sell_dex: string;
  buy_price: string;
  sell_price: string;
  gross_spread_bps: number;
  net_spread_bps: number;
  est_profit_usd: string;
  est_gas_cost_usd: string;
  chain: string;
}

interface ArbitrageResult {
  opportunities: Opportunity[];
  best_route: {
    buy_dex: string;
    sell_dex: string;
    net_spread_bps: number;
    est_profit_usd: string;
  } | null;
  token_in: string;
  token_out: string;
  amount_in: string;
  dexes_queried: number;
  queried_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveToken(
  symbolOrAddress: string,
  chain: string,
): { address: string; decimals: number } {
  const upper = symbolOrAddress.toUpperCase();
  const chainTokens = TOKEN_ADDRESSES[chain] ?? TOKEN_ADDRESSES["ethereum"]!;
  if (chainTokens[upper]) return chainTokens[upper]!;

  // If it looks like an address, assume 18 decimals unless it matches known
  if (symbolOrAddress.startsWith("0x") && symbolOrAddress.length === 42) {
    // Try to match by address
    for (const info of Object.values(chainTokens)) {
      if (info.address.toLowerCase() === symbolOrAddress.toLowerCase()) {
        return info;
      }
    }
    // Unknown token — guess 18 decimals (most common)
    return { address: symbolOrAddress, decimals: 18 };
  }

  // Fallback to ethereum registry if chain doesn't have it
  const ethTokens = TOKEN_ADDRESSES["ethereum"]!;
  if (ethTokens[upper]) return ethTokens[upper]!;

  throw new Error(
    `Unknown token "${symbolOrAddress}" on chain "${chain}". Pass a full 0x address.`,
  );
}

function toWei(amount: string, decimals: number): string {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  let fraction = parts[1] ?? "";

  if (fraction.length > decimals) {
    fraction = fraction.slice(0, decimals);
  } else {
    fraction = fraction.padEnd(decimals, "0");
  }

  const raw = whole + fraction;
  // Strip leading zeros but keep at least "0"
  return raw.replace(/^0+/, "") || "0";
}

function fromWei(amountWei: bigint, decimals: number): number {
  const divisor = 10 ** decimals;
  // For large numbers, convert carefully to avoid precision loss
  const whole = amountWei / BigInt(divisor);
  const remainder = amountWei % BigInt(divisor);
  const fractionStr = remainder.toString().padStart(decimals, "0");
  return parseFloat(`${whole}.${fractionStr}`);
}

function estimateGasCostUsd(chain: string): number {
  const est = GAS_ESTIMATES[chain] ?? GAS_ESTIMATES["ethereum"]!;
  const gasCostEth = (est.swapGas * est.gasPriceGwei) / 1e9;
  return gasCostEth * est.nativeUsdPrice;
}

async function fetchJson(url: string, timeoutMs = 10_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// DEX Quote Sources
// ---------------------------------------------------------------------------

/**
 * Paraswap Prices API (free, no key required).
 * Returns destAmount in wei for a SELL-side quote.
 *
 * Endpoint: GET https://apiv5.paraswap.io/prices
 * Params: srcToken, destToken, amount (wei), srcDecimals, destDecimals, side=SELL, network
 */
async function queryParaswap(
  srcAddress: string,
  destAddress: string,
  amountWei: string,
  srcDecimals: number,
  destDecimals: number,
  chainId: number,
  chain: string,
): Promise<DexQuote | null> {
  try {
    const url = new URL("https://apiv5.paraswap.io/prices");
    url.searchParams.set("srcToken", srcAddress);
    url.searchParams.set("destToken", destAddress);
    url.searchParams.set("amount", amountWei);
    url.searchParams.set("srcDecimals", srcDecimals.toString());
    url.searchParams.set("destDecimals", destDecimals.toString());
    url.searchParams.set("side", "SELL");
    url.searchParams.set("network", chainId.toString());

    const data = await fetchJson(url.toString());
    if (!data?.priceRoute?.destAmount) return null;

    const outputAmount = BigInt(data.priceRoute.destAmount);
    const bestRoute = data.priceRoute.bestRoute?.[0];
    const dexName = bestRoute?.swaps?.[0]?.swapExchanges?.[0]?.exchange ?? "Paraswap";

    return {
      dex: `Paraswap (${dexName})`,
      outputAmount,
      outputHuman: fromWei(outputAmount, destDecimals),
      chain,
      gasEstimateUsd: estimateGasCostUsd(chain),
      feeBps: 0, // Paraswap has no protocol fee for price queries
    };
  } catch {
    return null;
  }
}

/**
 * 0x Swap API (free tier, rate limited).
 * Returns buyAmount in wei.
 *
 * Endpoint: GET https://api.0x.org/swap/v1/quote
 * Params: sellToken, buyToken, sellAmount
 *
 * Note: May require an API key for production use. We attempt without one.
 * Chain-specific base URLs are used for L2s.
 */
async function queryZeroX(
  srcAddress: string,
  destAddress: string,
  amountWei: string,
  destDecimals: number,
  chainId: number,
  chain: string,
): Promise<DexQuote | null> {
  try {
    const baseUrls: Record<number, string> = {
      1: "https://api.0x.org",
      8453: "https://base.api.0x.org",
      42161: "https://arbitrum.api.0x.org",
      137: "https://polygon.api.0x.org",
      10: "https://optimism.api.0x.org",
    };

    const base = baseUrls[chainId] ?? "https://api.0x.org";
    const url = new URL(`${base}/swap/v1/price`);
    url.searchParams.set("sellToken", srcAddress);
    url.searchParams.set("buyToken", destAddress);
    url.searchParams.set("sellAmount", amountWei);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.ZEROX_API_KEY) {
      headers["0x-api-key"] = process.env.ZEROX_API_KEY;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let data: any;
    try {
      const resp = await fetch(url.toString(), { signal: controller.signal, headers });
      if (!resp.ok) return null;
      data = await resp.json();
    } finally {
      clearTimeout(timer);
    }

    if (!data?.buyAmount) return null;

    const outputAmount = BigInt(data.buyAmount);
    const sources = (data.sources ?? []) as { name: string; proportion: string }[];
    const topSource = sources.find((s) => parseFloat(s.proportion) > 0);
    const dexName = topSource?.name ?? "0x";

    return {
      dex: `0x (${dexName})`,
      outputAmount,
      outputHuman: fromWei(outputAmount, destDecimals),
      chain,
      gasEstimateUsd: estimateGasCostUsd(chain),
      feeBps: 0,
    };
  } catch {
    return null;
  }
}

/**
 * DexScreener API (free, no key required).
 * Returns price data from real on-chain DEX pools.
 *
 * Endpoint: GET https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}
 *
 * We fetch pools for the input token, filter for pairs involving the output
 * token, and extract prices from individual DEX pools.
 */
async function queryDexScreener(
  srcAddress: string,
  destAddress: string,
  amountInHuman: number,
  destDecimals: number,
  chainId: number,
  chain: string,
): Promise<DexQuote[]> {
  const quotes: DexQuote[] = [];

  try {
    // Map our chain names to DexScreener chain IDs
    const dexScreenerChains: Record<string, string> = {
      ethereum: "ethereum",
      base: "base",
      arbitrum: "arbitrum",
      polygon: "polygon",
      optimism: "optimism",
    };
    const dsChain = dexScreenerChains[chain] ?? chain;

    const data = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${srcAddress}`,
    );

    if (!data?.pairs || !Array.isArray(data.pairs)) return quotes;

    // Filter pairs that match our destination token and chain
    const relevantPairs = data.pairs.filter((pair: any) => {
      if (pair.chainId !== dsChain) return false;

      const baseAddr = pair.baseToken?.address?.toLowerCase() ?? "";
      const quoteAddr = pair.quoteToken?.address?.toLowerCase() ?? "";
      const srcLower = srcAddress.toLowerCase();
      const destLower = destAddress.toLowerCase();

      return (
        (baseAddr === srcLower && quoteAddr === destLower) ||
        (baseAddr === destLower && quoteAddr === srcLower)
      );
    });

    // Deduplicate by DEX name — take the pool with highest liquidity per DEX
    const byDex = new Map<string, any>();
    for (const pair of relevantPairs) {
      const dexName = pair.dexId ?? "unknown";
      const existing = byDex.get(dexName);
      const liq = pair.liquidity?.usd ?? 0;
      if (!existing || liq > (existing.liquidity?.usd ?? 0)) {
        byDex.set(dexName, pair);
      }
    }

    for (const [dexName, pair] of byDex) {
      try {
        const baseAddr = pair.baseToken?.address?.toLowerCase() ?? "";
        const srcLower = srcAddress.toLowerCase();

        // Determine the price relationship
        let pricePerUnit: number;
        if (baseAddr === srcLower) {
          // base = srcToken, quote = destToken, priceNative gives dest/src ratio
          pricePerUnit = parseFloat(pair.priceNative ?? "0");
        } else {
          // base = destToken, quote = srcToken, invert
          const rawPrice = parseFloat(pair.priceNative ?? "0");
          pricePerUnit = rawPrice > 0 ? 1 / rawPrice : 0;
        }

        if (pricePerUnit <= 0) continue;

        const outputHuman = amountInHuman * pricePerUnit;
        const outputWei = BigInt(
          Math.round(outputHuman * 10 ** destDecimals).toString(),
        );

        // DEX-specific fee estimates (bps)
        let feeBps = 30; // default 0.3%
        const dexLower = dexName.toLowerCase();
        if (dexLower.includes("uniswap") && dexLower.includes("v3")) feeBps = pair.pairFee ?? 30;
        else if (dexLower.includes("uniswap")) feeBps = 30;
        else if (dexLower.includes("sushiswap") || dexLower.includes("sushi")) feeBps = 30;
        else if (dexLower.includes("curve")) feeBps = 4; // Curve is ~0.04%
        else if (dexLower.includes("pancake")) feeBps = 25;
        else if (dexLower.includes("balancer")) feeBps = 10;

        // Format the DEX name nicely
        const formattedDex = formatDexName(dexName);

        quotes.push({
          dex: formattedDex,
          outputAmount: outputWei,
          outputHuman,
          chain,
          gasEstimateUsd: estimateGasCostUsd(chain),
          feeBps,
        });
      } catch {
        // Skip this pair
      }
    }
  } catch {
    // DexScreener unavailable — not fatal
  }

  return quotes;
}

function formatDexName(raw: string): string {
  const mapping: Record<string, string> = {
    uniswap: "Uniswap V2",
    "uniswap-v3": "Uniswap V3",
    "uniswap_v3": "Uniswap V3",
    uniswapv3: "Uniswap V3",
    sushiswap: "SushiSwap",
    sushi: "SushiSwap",
    curve: "Curve",
    pancakeswap: "PancakeSwap",
    balancer: "Balancer",
    "1inch": "1inch",
  };
  return mapping[raw.toLowerCase()] ?? raw;
}

/**
 * Fetch an estimated USD price for the output token so we can express
 * profits in USD. Uses DexScreener's simple price endpoint.
 */
async function getTokenUsdPrice(tokenAddress: string, chain: string): Promise<number> {
  try {
    const data = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    );
    if (!data?.pairs?.length) return 0;

    // Filter to our chain and pick the highest-liquidity pair
    const dexScreenerChains: Record<string, string> = {
      ethereum: "ethereum",
      base: "base",
      arbitrum: "arbitrum",
      polygon: "polygon",
      optimism: "optimism",
    };
    const dsChain = dexScreenerChains[chain] ?? chain;

    const chainPairs = data.pairs.filter((p: any) => p.chainId === dsChain);
    if (!chainPairs.length) return 0;

    chainPairs.sort(
      (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    );

    const bestPair = chainPairs[0];
    const baseAddr = bestPair.baseToken?.address?.toLowerCase() ?? "";

    if (baseAddr === tokenAddress.toLowerCase()) {
      return parseFloat(bestPair.priceUsd ?? "0");
    } else {
      // It's the quote token
      const basePrice = parseFloat(bestPair.priceUsd ?? "0");
      const nativePrice = parseFloat(bestPair.priceNative ?? "0");
      if (nativePrice > 0 && basePrice > 0) {
        return basePrice / nativePrice;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Fallback USD price estimates for common stablecoins and major tokens.
 */
function fallbackUsdPrice(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX"].includes(upper)) return 1.0;
  if (["WETH", "ETH"].includes(upper)) return 3000;
  if (["WBTC", "BTC"].includes(upper)) return 95000;
  if (["MATIC", "POL"].includes(upper)) return 0.5;
  if (upper === "LINK") return 15;
  if (upper === "UNI") return 8;
  return 0;
}

// ---------------------------------------------------------------------------
// Main Arbitrage Detection
// ---------------------------------------------------------------------------

export async function detectArbitrage(input: ArbitrageInput): Promise<ArbitrageResult> {
  if (!input.token_in || input.token_in.trim().length === 0) {
    throw new Error("token_in is required.");
  }
  if (!input.token_out || input.token_out.trim().length === 0) {
    throw new Error("token_out is required.");
  }
  const parsedAmount = parseFloat(input.amount_in);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error(`Invalid amount_in: "${input.amount_in}". Must be a positive number.`);
  }
  if (input.token_in.toUpperCase() === input.token_out.toUpperCase()) {
    throw new Error("token_in and token_out must be different tokens.");
  }

  const allOpportunities: Opportunity[] = [];
  let totalDexesQueried = 0;

  for (const chain of input.chains) {
    const chainId = CHAIN_IDS[chain];
    if (!chainId) continue;

    // Resolve tokens
    let srcToken: { address: string; decimals: number };
    let destToken: { address: string; decimals: number };
    try {
      srcToken = resolveToken(input.token_in, chain);
      destToken = resolveToken(input.token_out, chain);
    } catch {
      continue; // Unknown token on this chain, skip
    }

    const amountWei = toWei(input.amount_in, srcToken.decimals);
    const amountInHuman = parseFloat(input.amount_in);

    // Query all sources in parallel
    const [paraswapQuote, zeroXQuote, dexScreenerQuotes] = await Promise.all([
      queryParaswap(
        srcToken.address,
        destToken.address,
        amountWei,
        srcToken.decimals,
        destToken.decimals,
        chainId,
        chain,
      ),
      queryZeroX(
        srcToken.address,
        destToken.address,
        amountWei,
        destToken.decimals,
        chainId,
        chain,
      ),
      queryDexScreener(
        srcToken.address,
        destToken.address,
        amountInHuman,
        destToken.decimals,
        chainId,
        chain,
      ),
    ]);

    // Collect all valid quotes
    const quotes: DexQuote[] = [];
    if (paraswapQuote) quotes.push(paraswapQuote);
    if (zeroXQuote) quotes.push(zeroXQuote);
    quotes.push(...dexScreenerQuotes);

    totalDexesQueried += quotes.length;

    if (quotes.length < 2) continue; // Need at least 2 quotes to compare

    // Get USD price for the dest token to calculate profit in USD
    let destUsdPrice = await getTokenUsdPrice(destToken.address, chain);
    if (destUsdPrice <= 0) {
      destUsdPrice = fallbackUsdPrice(input.token_out);
    }

    // Compare every pair of quotes to find spread opportunities
    for (let i = 0; i < quotes.length; i++) {
      for (let j = 0; j < quotes.length; j++) {
        if (i === j) continue;

        const buyQuote = quotes[i]!;   // Where we'd buy (higher output = cheaper price)
        const sellQuote = quotes[j]!;  // Where we'd sell (lower output = more expensive price)

        // We want: buy cheap on buyQuote (high output), sell expensive on sellQuote (low output)
        // Actually: arb = buy on DEX with MORE output per input, sell on DEX with LESS output
        // The spread exists when one DEX gives more output than another
        if (buyQuote.outputHuman <= sellQuote.outputHuman) continue;

        const midPrice = (buyQuote.outputHuman + sellQuote.outputHuman) / 2;
        if (midPrice <= 0) continue;

        const grossSpreadBps = Math.round(
          ((buyQuote.outputHuman - sellQuote.outputHuman) / midPrice) * 10_000,
        );

        // Net spread accounts for gas on two swaps (buy + sell) and DEX fees
        const totalGasCostUsd = buyQuote.gasEstimateUsd + sellQuote.gasEstimateUsd;
        const totalFeeBps = buyQuote.feeBps + sellQuote.feeBps;

        // Profit in dest token terms
        const grossProfitTokens = buyQuote.outputHuman - sellQuote.outputHuman;
        const grossProfitUsd = grossProfitTokens * destUsdPrice;
        const netProfitUsd = grossProfitUsd - totalGasCostUsd;

        // Net spread in bps = gross spread - fee bps - gas cost expressed as bps
        const tradeValueUsd = amountInHuman * (destUsdPrice > 0 ? (midPrice * destUsdPrice) / midPrice : 0) || grossProfitUsd * 100;
        const gasCostBps = tradeValueUsd > 0 ? Math.round((totalGasCostUsd / tradeValueUsd) * 10_000) : 0;
        const netSpreadBps = grossSpreadBps - totalFeeBps - gasCostBps;

        if (netSpreadBps < input.min_spread_bps) continue;

        // Price: how much dest token per 1 src token
        const buyPrice = buyQuote.outputHuman / amountInHuman;
        const sellPrice = sellQuote.outputHuman / amountInHuman;

        allOpportunities.push({
          buy_dex: buyQuote.dex,
          sell_dex: sellQuote.dex,
          buy_price: buyPrice.toFixed(6),
          sell_price: sellPrice.toFixed(6),
          gross_spread_bps: grossSpreadBps,
          net_spread_bps: netSpreadBps,
          est_profit_usd: netProfitUsd.toFixed(2),
          est_gas_cost_usd: totalGasCostUsd.toFixed(2),
          chain,
        });
      }
    }
  }

  // Sort by net spread descending (most profitable first)
  allOpportunities.sort((a, b) => b.net_spread_bps - a.net_spread_bps);

  // Determine best route
  const best = allOpportunities.length > 0 ? allOpportunities[0]! : null;

  return {
    opportunities: allOpportunities,
    best_route: best
      ? {
          buy_dex: best.buy_dex,
          sell_dex: best.sell_dex,
          net_spread_bps: best.net_spread_bps,
          est_profit_usd: best.est_profit_usd,
        }
      : null,
    token_in: input.token_in,
    token_out: input.token_out,
    amount_in: input.amount_in,
    dexes_queried: totalDexesQueried,
    queried_at: new Date().toISOString(),
  };
}
