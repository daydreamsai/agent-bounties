import { createAgentApp, type AgentContext } from '@lucid-dreams/agent-kit';
import { z } from 'zod';
import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
  type PublicClient,
  type Chain,
} from 'viem';
import { mainnet, base, arbitrum, optimism, polygon } from 'viem/chains';

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const ArbitrageInput = z.object({
  token_in: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address'),
  token_out: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address'),
  amount_in: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, 'Must be a numeric string (wei or decimal)'),
  chains: z
    .array(z.enum(['ethereum', 'base', 'arbitrum', 'optimism', 'polygon']))
    .min(1)
    .describe('Chains to scan for arbitrage opportunities'),
});

const ArbitrageRoute = z.object({
  buy_dex: z.string(),
  sell_dex: z.string(),
  chain: z.string(),
  buy_price: z.number(),
  sell_price: z.number(),
  spread_bps: z.number(),
  estimated_gas_cost_usd: z.number(),
  estimated_fees_usd: z.number(),
  net_spread_bps: z.number(),
  profitable: z.boolean(),
});

const ArbitrageOutput = z.object({
  best_route: ArbitrageRoute.nullable(),
  alt_routes: z.array(ArbitrageRoute),
  net_spread_bps: z.number(),
  est_fill_cost: z.object({
    gas_usd: z.number(),
    dex_fees_usd: z.number(),
    total_usd: z.number(),
  }),
  scanned_chains: z.array(z.string()),
  scanned_dexes: z.array(z.string()),
});

type ArbitrageInputType = z.infer<typeof ArbitrageInput>;

/* ------------------------------------------------------------------ */
/*  DEX configuration per chain                                        */
/* ------------------------------------------------------------------ */

interface DexConfig {
  name: string;
  factoryAddress: Address;
  initCodeHash: string;
  feeBps: number; // e.g. 30 = 0.30%
}

interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  nativeToken: string;
  nativeUsdPrice: number; // approximate, for gas estimation
  dexes: DexConfig[];
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    chain: mainnet,
    rpcUrl: 'https://eth.merkle.io',
    nativeToken: 'ETH',
    nativeUsdPrice: 3500,
    dexes: [
      { name: 'UniswapV2', factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', feeBps: 30 },
      { name: 'Sushiswap', factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303', feeBps: 30 },
      { name: 'ShibaSwap', factoryAddress: '0x115934131916C8b277DD010Ee02de363c09f4ba1', initCodeHash: '0x48c322b506c29b0f6b3e1d8b73b66d8d5a0ac680793f4abf4e48fd62a751fba2', feeBps: 30 },
    ],
  },
  base: {
    chain: base,
    rpcUrl: 'https://base.merkle.io',
    nativeToken: 'ETH',
    nativeUsdPrice: 3500,
    dexes: [
      { name: 'UniswapV2', factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6', initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', feeBps: 30 },
      { name: 'Sushiswap', factoryAddress: '0x71524B4f93c58fcEbf6492E3F0E0Df44c4CbD71A', initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303', feeBps: 30 },
    ],
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: 'https://arbitrum.merkle.io',
    nativeToken: 'ETH',
    nativeUsdPrice: 3500,
    dexes: [
      { name: 'UniswapV3', factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984', initCodeHash: '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54', feeBps: 30 },
      { name: 'Sushiswap', factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303', feeBps: 50 },
    ],
  },
  optimism: {
    chain: optimism,
    rpcUrl: 'https://optimism.merkle.io',
    nativeToken: 'ETH',
    nativeUsdPrice: 3500,
    dexes: [
      { name: 'UniswapV2', factoryAddress: '0x0c8aFD1b58a3B6e2cF8f7F2f7b3c5f8a7b6e5d4c3', initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', feeBps: 30 },
    ],
  },
  polygon: {
    chain: polygon,
    rpcUrl: 'https://polygon.merkle.io',
    nativeToken: 'MATIC',
    nativeUsdPrice: 0.55,
    dexes: [
      { name: 'QuickSwap', factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', feeBps: 30 },
      { name: 'Sushiswap', factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303', feeBps: 50 },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Uniswap V2 pair ABI (minimal: getReserves, token0, token1)         */
/* ------------------------------------------------------------------ */

const UNISWAP_V2_PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' },
    ],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
] as const;

const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Core helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Compute Uniswap V2 pair address from factory, token0, token1, and init code hash.
 */
function computePairAddress(
  factory: Address,
  tokenA: Address,
  tokenB: Address,
  initCodeHash: string,
): Address {
  const [token0, token1] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const salt = `0x${Buffer.from(token0.slice(2) + token1.slice(2), 'hex').toString('hex').padStart(64, '0')}`;
  // Note: For production use ethers/viem's getCreate2Address. This is a non-cryptographic
  // deterministic placeholder that illustrates the intent. Real deployment uses
  // viem's getContractAddress with CREATE2 opcode.
  return `0x${Buffer.from(token0.slice(2) + token1.slice(2) + initCodeHash.slice(2), 'hex').toString('hex').slice(0, 40)}` as Address;
}

/**
 * Get on-chain quote for a token amount on a Uniswap V2-style DEX.
 * Returns the output amount after fee, or null if the pair doesn't exist.
 */
async function getV2Quote(
  client: PublicClient,
  pairAddress: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  feeBps: number,
): Promise<{ amountOut: bigint; price: number; reserve0: bigint; reserve1: bigint } | null> {
  try {
    const [reserves, t0] = await Promise.all([
      client.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'getReserves',
      }),
      client.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'token0',
      }),
    ]);

    const [reserve0, reserve1] = reserves;
    const token0Addr = t0.toLowerCase() as Address;
    const tokenInAddr = tokenIn.toLowerCase() as Address;

    // Determine which reserve is the input token
    const [reserveIn, reserveOut] =
      token0Addr === tokenInAddr
        ? [reserve0, reserve1]
        : [reserve1, reserve0];

    if (reserveIn <= 0n || reserveOut <= 0n) return null;

    // Uniswap V2 quote with 0.30% fee: amountIn * 997 / 1000
    const amountInWithFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    const amountOut = numerator / denominator;

    if (amountOut <= 0n) return null;

    // Price = amountOut / amountIn (in raw units)
    const price = Number(amountOut) / Number(amountIn);

    return { amountOut, price, reserve0, reserve1 };
  } catch {
    return null;
  }
}

/**
 * Estimate gas cost for a swap on a given chain.
 * Uses a simple model based on average gas prices.
 */
async function estimateGasCost(
  client: PublicClient,
  chainConfig: ChainConfig,
): Promise<{ gasUsd: number; gasWei: bigint; gasPriceGwei: number }> {
  try {
    const gasPrice = await client.getGasPrice();
    // Uniswap V2 swap ~ 120k-200k gas
    const estimatedGas = 150_000n;
    const totalWei = gasPrice * estimatedGas;
    const gasPriceGwei = Number(formatUnits(gasPrice, 9));
    const gasInEth = Number(formatUnits(totalWei, 18));
    const gasUsd = gasInEth * chainConfig.nativeUsdPrice;
    return { gasUsd, gasWei: totalWei, gasPriceGwei };
  } catch {
    // Fallback estimate
    const fallbackGwei = chainConfig.chain.id === 1n ? 20 : 0.1;
    const totalWei = BigInt(Math.floor(fallbackGwei * 150_000 * 1e9));
    const gasUsd = (fallbackGwei * 150_000 * 1e-9) * chainConfig.nativeUsdPrice;
    return { gasUsd, gasWei: totalWei, gasPriceGwei: fallbackGwei };
  }
}

/**
 * Get token decimals
 */
async function getTokenDecimals(client: PublicClient, token: Address): Promise<number> {
  try {
    const decimals = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    return decimals;
  } catch {
    return 18; // assume 18 decimals
  }
}

/**
 * Get token symbol
 */
async function getTokenSymbol(client: PublicClient, token: Address): Promise<string> {
  try {
    const symbol = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    return symbol;
  } catch {
    return token.slice(0, 10);
  }
}

/* ------------------------------------------------------------------ */
/*  Main arbitrage scanner                                             */
/* ------------------------------------------------------------------ */

interface DexPrice {
  dexName: string;
  chainName: string;
  price: number; // output token per input token
  amountOut: bigint;
  gasCostUsd: number;
  dexFeeUsd: number;
  reserve0: bigint;
  reserve1: bigint;
}

async function scanChainForPrices(
  chainName: string,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsIn: number,
  decimalsOut: number,
): Promise<DexPrice[]> {
  const chainConfig = CHAIN_CONFIGS[chainName];
  if (!chainConfig) return [];

  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const results: DexPrice[] = [];
  const gasCost = await estimateGasCost(client, chainConfig);

  for (const dex of chainConfig.dexes) {
    // For Uniswap V2, we need the pair address. Since the create2 address computation
    // requires exact init code hash, we use a direct approach: compute deterministic pair address.
    // In a full production system you'd cache this or use the graph. Here we compute it.
    // Actually, let's use a more practical approach - we'll query multiple pairs using
    // the actual pair address derivation method.

    // Try to get the pair address via getPair on the factory
    const FACTORY_ABI = [
      {
        constant: true,
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
        ],
        name: 'getPair',
        outputs: [{ name: '', type: 'address' }],
        type: 'function',
      },
    ] as const;

    let pairAddress: Address;
    try {
      pairAddress = await client.readContract({
        address: dex.factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenIn, tokenOut],
      });
    } catch {
      // Try reversed tokens
      try {
        pairAddress = await client.readContract({
          address: dex.factoryAddress,
          abi: FACTORY_ABI,
          functionName: 'getPair',
          args: [tokenOut, tokenIn],
        });
      } catch {
        continue;
      }
    }

    // Zero address means pair doesn't exist
    if (pairAddress === '0x0000000000000000000000000000000000000000') continue;

    const quote = await getV2Quote(client, pairAddress, tokenIn, tokenOut, amountIn, dex.feeBps);
    if (!quote) continue;

    const amountOutFormatted = Number(formatUnits(quote.amountOut, decimalsOut));
    const amountInFormatted = Number(formatUnits(amountIn, decimalsIn));
    const price = amountOutFormatted / amountInFormatted;

    // DEX fee in USD (approximate: feeBps of the trade value)
    const feePortion = dex.feeBps / 10000;
    // Estimated trade value in native token
    // We approximate by checking if tokenIn is WETH/WMATIC
    const isNativeIn = tokenIn.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' || // WETH
      tokenIn.toLowerCase() === '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270' || // WMATIC
      tokenIn.toLowerCase() === '0x4200000000000000000000000000000000000006'; // Optimism/base WETH
    const tradeValueNative = isNativeIn ? amountInFormatted : (amountOutFormatted * 0.001); // rough estimate
    const dexFeeUsd = tradeValueNative * chainConfig.nativeUsdPrice * feePortion;

    results.push({
      dexName: dex.name,
      chainName,
      price,
      amountOut: quote.amountOut,
      gasCostUsd: gasCost.gasUsd,
      dexFeeUsd,
      reserve0: quote.reserve0,
      reserve1: quote.reserve1,
    });
  }

  return results;
}

/**
 * Format amount based on input
 */
function parseAmount(amountIn: string, decimals: number): bigint {
  if (amountIn.includes('.')) {
    const parts = amountIn.split('.');
    const whole = parts[0];
    let fraction = parts[1];
    // Pad or truncate to match decimals
    if (fraction.length > decimals) {
      fraction = fraction.slice(0, decimals);
    } else {
      fraction = fraction.padEnd(decimals, '0');
    }
    return BigInt(whole + fraction);
  }
  return BigInt(amountIn);
}

/* ------------------------------------------------------------------ */
/*  Agent setup                                                        */
/* ------------------------------------------------------------------ */

const agent = createAgentApp(
  {
    name: 'Cross DEX Arbitrage Alert',
    version: '1.0.0',
    description:
      'Detects cross-DEX token price spreads exceeding threshold. ' +
      'Scans multiple chains and DEXes to find profitable arbitrage opportunities.',
  },
  {
    entrypoints: [
      {
        key: 'scan-arbitrage',
        description:
          'Scan specified chains and DEXes for arbitrage opportunities between two tokens. ' +
          'Returns the best route, alternative profitable routes, net spread in bps, and estimated fill costs.',
        input: ArbitrageInput,
        output: ArbitrageOutput,
        price: '0.001',
        handler: async (ctx: AgentContext) => {
          const input = ctx.input as ArbitrageInputType;

          const tokenIn = input.token_in.toLowerCase() as Address;
          const tokenOut = input.token_out.toLowerCase() as Address;
          const chains = input.chains;

          // Get a client for decimals lookup (use first chain)
          const primaryChain = CHAIN_CONFIGS[chains[0]];
          const primaryClient = createPublicClient({
            chain: primaryChain.chain,
            transport: http(primaryChain.rpcUrl),
          });

          const [decimalsIn, decimalsOut, symbolIn, symbolOut] = await Promise.all([
            getTokenDecimals(primaryClient, tokenIn),
            getTokenDecimals(primaryClient, tokenOut),
            getTokenSymbol(primaryClient, tokenIn),
            getTokenSymbol(primaryClient, tokenOut),
          ]);

          const amountIn = parseAmount(input.amount_in, decimalsIn);

          // Scan all requested chains in parallel
          const chainScans = await Promise.all(
            chains.map((chain) =>
              scanChainForPrices(chain, tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut),
            ),
          );

          const allPrices = chainScans.flat();
          const scannedDexes = [...new Set(allPrices.map((p) => p.dexName))];

          if (allPrices.length < 2) {
            return {
              output: {
                best_route: null,
                alt_routes: [],
                net_spread_bps: 0,
                est_fill_cost: { gas_usd: 0, dex_fees_usd: 0, total_usd: 0 },
                scanned_chains: chains,
                scanned_dexes: scannedDexes,
              },
            };
          }

          // Build routes: for each pair of prices on each chain, calculate spread
          const routes: Array<{
            buy_dex: string;
            sell_dex: string;
            chain: string;
            buy_price: number;
            sell_price: number;
            spread_bps: number;
            estimated_gas_cost_usd: number;
            estimated_fees_usd: number;
            net_spread_bps: number;
            profitable: boolean;
          }> = [];

          // Group prices by chain for cross-DEX comparison within the same chain
          const pricesByChain = new Map<string, DexPrice[]>();
          for (const p of allPrices) {
            if (!pricesByChain.has(p.chainName)) {
              pricesByChain.set(p.chainName, []);
            }
            pricesByChain.get(p.chainName)!.push(p);
          }

          for (const [chainName, prices] of pricesByChain) {
            if (prices.length < 2) continue;

            // Sort by price ascending -> buy low on first, sell high on second
            const sorted = [...prices].sort((a, b) => a.price - b.price);

            for (let i = 0; i < sorted.length; i++) {
              for (let j = i + 1; j < sorted.length; j++) {
                const buy = sorted[i];  // lower price (buy)
                const sell = sorted[j]; // higher price (sell on another DEX)

                const spreadBps = ((sell.price - buy.price) / buy.price) * 10000;
                if (spreadBps <= 0) continue;

                const totalGasCost = buy.gasCostUsd + sell.gasCostUsd;
                const totalFees = buy.dexFeeUsd + sell.dexFeeUsd;
                const totalCostUsd = totalGasCost + totalFees;

                // Net spread: what % is left after costs
                // We estimate profit on a $1000 trade
                const tradeValueUsd = 1000; // notional for bps calculation
                const grossProfitUsd = (spreadBps / 10000) * tradeValueUsd;
                const netProfitUsd = grossProfitUsd - totalCostUsd;
                const netSpreadBps = (netProfitUsd / tradeValueUsd) * 10000;

                routes.push({
                  buy_dex: buy.dexName,
                  sell_dex: sell.dexName,
                  chain: chainName,
                  buy_price: buy.price,
                  sell_price: sell.price,
                  spread_bps: Math.round(spreadBps * 100) / 100,
                  estimated_gas_cost_usd: Math.round(totalGasCost * 100) / 100,
                  estimated_fees_usd: Math.round(totalFees * 100) / 100,
                  net_spread_bps: Math.round(netSpreadBps * 100) / 100,
                  profitable: netProfitUsd > 0,
                });
              }
            }
          }

          // Also check cross-chain arbitrage (simplified: compare best buy on each chain)
          // Group by chain, find best buy and best sell per chain
          for (let i = 0; i < chains.length; i++) {
            for (let j = i + 1; j < chains.length; j++) {
              const chainIPrices = pricesByChain.get(chains[i]) || [];
              const chainJPrices = pricesByChain.get(chains[j]) || [];
              if (chainIPrices.length === 0 || chainJPrices.length === 0) continue;

              for (const pI of chainIPrices) {
                for (const pJ of chainJPrices) {
                  // Buy on chain i, sell on chain j
                  let spreadBps = ((pJ.price - pI.price) / pI.price) * 10000;
                  if (spreadBps > 0) {
                    const totalGasCost = pI.gasCostUsd + pJ.gasCostUsd;
                    const totalFees = pI.dexFeeUsd + pJ.dexFeeUsd;
                    const totalCostUsd = totalGasCost + totalFees;
                    const tradeValueUsd = 1000;
                    const grossProfitUsd = (spreadBps / 10000) * tradeValueUsd;
                    const netProfitUsd = grossProfitUsd - totalCostUsd;
                    const netSpreadBps = (netProfitUsd / tradeValueUsd) * 10000;

                    routes.push({
                      buy_dex: `${pI.dexName}@${pI.chainName}`,
                      sell_dex: `${pJ.dexName}@${pJ.chainName}`,
                      chain: `${pI.chainName}→${pJ.chainName}`,
                      buy_price: pI.price,
                      sell_price: pJ.price,
                      spread_bps: Math.round(spreadBps * 100) / 100,
                      estimated_gas_cost_usd: Math.round(totalGasCost * 100) / 100,
                      estimated_fees_usd: Math.round(totalFees * 100) / 100,
                      net_spread_bps: Math.round(netSpreadBps * 100) / 100,
                      profitable: netProfitUsd > 0,
                    });
                  }

                  // Buy on chain j, sell on chain i (reverse)
                  spreadBps = ((pI.price - pJ.price) / pJ.price) * 10000;
                  if (spreadBps > 0) {
                    const totalGasCost = pI.gasCostUsd + pJ.gasCostUsd;
                    const totalFees = pI.dexFeeUsd + pJ.dexFeeUsd;
                    const totalCostUsd = totalGasCost + totalFees;
                    const tradeValueUsd = 1000;
                    const grossProfitUsd = (spreadBps / 10000) * tradeValueUsd;
                    const netProfitUsd = grossProfitUsd - totalCostUsd;
                    const netSpreadBps = (netProfitUsd / tradeValueUsd) * 10000;

                    routes.push({
                      buy_dex: `${pJ.dexName}@${pJ.chainName}`,
                      sell_dex: `${pI.dexName}@${pI.chainName}`,
                      chain: `${pJ.chainName}→${pI.chainName}`,
                      buy_price: pJ.price,
                      sell_price: pI.price,
                      spread_bps: Math.round(spreadBps * 100) / 100,
                      estimated_gas_cost_usd: Math.round(totalGasCost * 100) / 100,
                      estimated_fees_usd: Math.round(totalFees * 100) / 100,
                      net_spread_bps: Math.round(netSpreadBps * 100) / 100,
                      profitable: netProfitUsd > 0,
                    });
                  }
                }
              }
            }
          }

          // Sort by net spread descending
          routes.sort((a, b) => b.net_spread_bps - a.net_spread_bps);
          const profitableRoutes = routes.filter((r) => r.profitable);
          const bestRoute = profitableRoutes.length > 0 ? profitableRoutes[0] : (routes.length > 0 ? routes[0] : null);
          const altRoutes = profitableRoutes.slice(1, 5); // top 5 alt routes

          const totalGas = routes.reduce((s, r) => s + r.estimated_gas_cost_usd, 0);
          const totalFees = routes.reduce((s, r) => s + r.estimated_fees_usd, 0);

          return {
            output: {
              best_route: bestRoute,
              alt_routes: altRoutes,
              net_spread_bps: bestRoute ? bestRoute.net_spread_bps : 0,
              est_fill_cost: {
                gas_usd: Math.round(totalGas * 100) / 100,
                dex_fees_usd: Math.round(totalFees * 100) / 100,
                total_usd: Math.round((totalGas + totalFees) * 100) / 100,
              },
              scanned_chains: chains,
              scanned_dexes: scannedDexes,
            },
          };
        },
      },
    ],
  },
);

// Export the Hono app for deployment
export default agent.app;
