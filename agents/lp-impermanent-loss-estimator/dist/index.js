/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { createPublicClient, http, getAddress } from "viem";
import { mainnet, arbitrum, optimism, polygon, base } from "viem/chains";
// ─── Chain Config ─────────────────────────────────────────────────────────────
const CHAINS = {
    ethereum: { client: createPublicClient({ chain: mainnet, transport: http("https://eth.llamarpc.com") }), rpcUrl: "https://eth.llamarpc.com" },
    arbitrum: { client: createPublicClient({ chain: arbitrum, transport: http("https://arb1.arbitrum.io/rpc") }), rpcUrl: "https://arb1.arbitrum.io/rpc" },
    optimism: { client: createPublicClient({ chain: optimism, transport: http("https://mainnet.optimism.io") }), rpcUrl: "https://mainnet.optimism.io" },
    polygon: { client: createPublicClient({ chain: polygon, transport: http("https://polygon-rpc.com") }), rpcUrl: "https://polygon-rpc.com" },
    base: { client: createPublicClient({ chain: base, transport: http("https://mainnet.base.org") }), rpcUrl: "https://mainnet.base.org" },
};
// ─── ABI ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
    { name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function", inputs: [] },
    { name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function", inputs: [] },
];
const PAIR_ABI = [
    { name: "getReserves", outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }], stateMutability: "view", type: "function", inputs: [] },
    { name: "token0", outputs: [{ type: "address" }], stateMutability: "view", type: "function", inputs: [] },
    { name: "token1", outputs: [{ type: "address" }], stateMutability: "view", type: "function", inputs: [] },
];
// ─── IL Calculation ──────────────────────────────────────────────────────────
/**
 * Standard constant-product AMM IL formula.
 * IL = 1 - (2 * sqrt(price_ratio) / (1 + price_ratio))
 * where price_ratio = new_price / initial_price
 * Returns positive percentage (e.g. 5.7 = 5.7% loss).
 */
function calcIL(currentPriceRatio) {
    if (currentPriceRatio <= 0)
        return 0;
    const sqrtR = Math.sqrt(currentPriceRatio);
    const il = 1 - (2 * sqrtR) / (1 + currentPriceRatio);
    return Math.max(0, il * 100);
}
/**
 * Estimate fee APR from volume/TVL ratio, annualised.
 * Uses 0.30% base fee (Uniswap V2 standard).
 */
function calcFeeAPR(totalVolumeUSD, tvlUSD, windowHours) {
    if (tvlUSD <= 0 || windowHours <= 0)
        return 0;
    const feeRate = 0.003;
    const feeYield = (totalVolumeUSD / tvlUSD) * feeRate;
    const hoursPerYear = 8760;
    const apr = feeYield * (hoursPerYear / windowHours);
    return Math.min(10000, Math.max(0, apr * 100));
}
// ─── Fetch Pool Info ─────────────────────────────────────────────────────────
async function getPoolInfo(chain, poolAddress) {
    const chainKey = chain.toLowerCase();
    const chainConfig = CHAINS[chainKey] ?? CHAINS["ethereum"];
    const addr = getAddress(poolAddress);
    const [token0Addr, token1Addr] = await Promise.all([
        chainConfig.client.readContract({ address: addr, abi: PAIR_ABI, functionName: "token0" }),
        chainConfig.client.readContract({ address: addr, abi: PAIR_ABI, functionName: "token1" }),
    ]);
    const [r0, r1] = await chainConfig.client.readContract({
        address: addr, abi: PAIR_ABI, functionName: "getReserves",
    });
    const [dec0, dec1] = await Promise.all([
        chainConfig.client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }),
        chainConfig.client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    let sym0 = "UNKNOWN", sym1 = "UNKNOWN";
    try {
        [sym0, sym1] = await Promise.all([
            chainConfig.client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }),
            chainConfig.client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }),
        ]);
    }
    catch { /* ignore symbol errors */ }
    return {
        token0: { address: token0Addr, symbol: sym0, decimals: dec0 },
        token1: { address: token1Addr, symbol: sym1, decimals: dec1 },
        reserve0: r0,
        reserve1: r1,
        fee: 30,
    };
}
// ─── Historical Price ────────────────────────────────────────────────────────
function symbolToCGId(symbol) {
    const map = {
        WETH: "ethereum", ETH: "ethereum", WBTC: "bitcoin", BTC: "bitcoin",
        USDC: "usd-coin", USDT: "tether", DAI: "dai",
        WMATIC: "matic-network", MATIC: "matic-network",
        WBNB: "binancecoin", BNB: "binancecoin",
        WAVAX: "avalanche-2", AVAX: "avalanche-2",
        ARB: "arbitrum", OP: "optimism", CBETH: "coinbase-wrapped-staked-eth",
        STETH: "staked-ether", WSTETH: "staked-ether",
        RETH: "rocket-pool-eth",
    };
    return map[symbol.toUpperCase()] ?? symbol.toLowerCase();
}
async function getHistoricalPrices(token0Symbol, token1Symbol, hours) {
    try {
        const cgId0 = symbolToCGId(token0Symbol);
        const cgId1 = symbolToCGId(token1Symbol);
        const days = Math.max(1, Math.ceil(hours / 24) + 1);
        const url = `https://api.coingecko.com/api/v3/coins/${cgId0}/market_chart?vs_currency=usd&days=${days}`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`CoinGecko: ${res.status}`);
        const data = await res.json();
        if (!data.prices || data.prices.length < 2)
            throw new Error("No price data");
        const firstPrice = data.prices[0][1];
        const lastPrice = data.prices[data.prices.length - 1][1];
        const volumeUSD = data.total_volumes?.[data.total_volumes.length - 1]?.[1] ?? 0;
        // Get token1 USD price
        let price1USD = 1;
        try {
            const r1 = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId1}&vs_currencies=usd`);
            if (r1.ok) {
                const d1 = await r1.json();
                price1USD = d1[cgId1]?.usd ?? 1;
            }
        }
        catch { /* ignore */ }
        const priceRatio = price1USD > 0 ? lastPrice / price1USD : 1;
        const firstRatio = price1USD > 0 ? firstPrice / price1USD : 1;
        const ratioChange = firstRatio > 0 ? priceRatio / firstRatio : 1;
        return { priceRatio: ratioChange, volumeUSD };
    }
    catch {
        return { priceRatio: 1, volumeUSD: 0 };
    }
}
// ─── Main Estimation ─────────────────────────────────────────────────────────
async function estimateIL(params) {
    const chain = params.chain ?? "ethereum";
    const windowHours = params.window_hours ?? 24;
    if (!params.pool_address || !/^0x[0-9a-fA-F]{40}$/.test(params.pool_address)) {
        return { IL_percent: 0, fee_apr_est: 0, volume_window: 0, notes: "ERROR: Invalid pool address. Must be a valid Ethereum-style address (0x...)." };
    }
    let poolInfo;
    try {
        poolInfo = await getPoolInfo(chain, params.pool_address);
    }
    catch (err) {
        return { IL_percent: 0, fee_apr_est: 0, volume_window: 0, notes: `ERROR: Could not fetch pool info: ${err?.message ?? "Unknown error"}. Check pool address (must be Uniswap V2 pair) and chain (ethereum/arbitrum/optimism/polygon/base).` };
    }
    const { token0, token1, reserve0, reserve1 } = poolInfo;
    const r0 = Number(reserve0) / 10 ** token0.decimals;
    const r1 = Number(reserve1) / 10 ** token1.decimals;
    const currentPrice = r0 > 0 ? r1 / r0 : 1; // token1 per token0
    const { priceRatio, volumeUSD } = await getHistoricalPrices(token0.symbol, token1.symbol, windowHours);
    const priceRatioSafe = Math.max(0.0001, Math.min(10000, priceRatio));
    const IL = calcIL(priceRatioSafe);
    const tvlUSD = (r0 + r1 * currentPrice) * 2;
    const estimatedVolumeUSD = volumeUSD > 0 ? volumeUSD * Math.max(1, windowHours / 24) : tvlUSD * 0.5 * (windowHours / 24);
    const feeAPR = calcFeeAPR(estimatedVolumeUSD, tvlUSD, windowHours);
    const notes = [
        `Pool: ${token0.symbol}/${token1.symbol} on ${chain}`,
        `Reserves: ${r0.toFixed(4)} ${token0.symbol} + ${r1.toFixed(4)} ${token1.symbol}`,
        `Current price: 1 ${token0.symbol} = ${currentPrice.toFixed(6)} ${token1.symbol}`,
        `Price change (${windowHours}h): ${priceRatio > 1 ? "+" : ""}${((priceRatio - 1) * 100).toFixed(2)}%`,
        `TVL estimate: $${tvlUSD.toFixed(0)}`,
        `Volume (${windowHours}h) estimate: $${estimatedVolumeUSD.toFixed(0)}`,
        `⚠️ Estimates based on CoinGecko historical data. Actual IL varies with exact entry/exit timing.`,
        `⚠️ Fee APR is estimated from volume/TVL ratios. Verify with pool analytics dashboards.`,
        `⚠️ IL is unrealised until position is closed. Does not account for fee income offset.`,
    ].join("; ");
    return {
        IL_percent: Math.round(IL * 100) / 100,
        fee_apr_est: Math.round(feeAPR * 100) / 100,
        volume_window: Math.round(estimatedVolumeUSD * 100) / 100,
        notes,
    };
}
// ─── Agent App ────────────────────────────────────────────────────────────────
const { app, addEntrypoint } = await createAgentApp({
    name: "lp-impermanent-loss-estimator",
    version: "0.1.0",
    description: "Calculate IL and fee APR for any LP position",
});
addEntrypoint({
    key: "estimate",
    description: "Estimate impermanent loss and fee APR for an LP position",
    input: z.object({
        pool_address: z.string().describe("LP pool address (Uniswap V2 pair contract)"),
        token_weights: z.array(z.number()).optional().describe("Token weight distribution [w0, w1], default [50, 50]"),
        deposit_amounts: z.array(z.number()).optional().describe("Amount of each token deposited (for HODL comparison)"),
        window_hours: z.number().optional().default(24).describe("Historical window for calculation in hours"),
        chain: z.string().optional().default("ethereum").describe("Blockchain: ethereum, arbitrum, optimism, polygon, base"),
    }),
    async handler({ input }) {
        const result = await estimateIL({
            pool_address: input.pool_address,
            token_weights: input.token_weights,
            deposit_amounts: input.deposit_amounts,
            window_hours: input.window_hours ?? 24,
            chain: input.chain ?? "ethereum",
        });
        return { output: result, usage: { total_tokens: 0 } };
    },
});
export default app;
