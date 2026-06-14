import { decimalToAtomic, resolveChain, resolveToken } from './lifi.js';
import type { BridgeInput, BridgeRoute } from './types.js';

const ACROSS_SUGGESTED_FEES = 'https://app.across.to/api/suggested-fees';

interface AcrossFeePart {
  total?: string;
}

interface AcrossSuggestedFees {
  estimatedFillTimeSec?: number;
  relayFeeTotal?: string;
  relayerGasFee?: AcrossFeePart;
  relayerCapitalFee?: AcrossFeePart;
  lpFee?: AcrossFeePart;
  totalRelayFee?: AcrossFeePart;
  outputAmount?: string;
  quoteBlock?: string;
  inputToken?: { symbol?: string; decimals?: number; chainId?: number };
  outputToken?: { symbol?: string; decimals?: number; chainId?: number };
  id?: string;
}

function atomicToDecimal(value: string | undefined, decimals: number): number {
  if (!value || !/^\d+$/.test(value)) return 0;
  return Number(value) / 10 ** decimals;
}

function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { headers: { accept: 'application/json', 'user-agent': 'bridge-route-pinger/0.1' } }),
      new Promise<Response>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${url} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    const text = await response.text();
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeAcrossQuote(quote: AcrossSuggestedFees, input: BridgeInput): BridgeRoute {
  const fromChain = resolveChain(input.from_chain);
  const toChain = resolveChain(input.to_chain);
  const fromToken = resolveToken(input.token, fromChain);
  const toToken = resolveToken(input.token, toChain);
  const relayFeeUsd = roundUsd(atomicToDecimal(quote.totalRelayFee?.total ?? quote.relayFeeTotal, fromToken.decimals));
  const gasFeeUsd = roundUsd(atomicToDecimal(quote.relayerGasFee?.total, fromToken.decimals));
  const capitalFeeUsd = roundUsd(atomicToDecimal(quote.relayerCapitalFee?.total, fromToken.decimals));
  const lpFeeUsd = roundUsd(atomicToDecimal(quote.lpFee?.total, fromToken.decimals));
  const etaSeconds = quote.estimatedFillTimeSec ?? null;

  return {
    route_id: `across:${quote.quoteBlock ?? 'latest'}:${quote.id ?? 'suggested-fees'}`,
    tool: 'across',
    bridge: 'Across',
    from_chain: input.from_chain,
    to_chain: input.to_chain,
    from_token: quote.inputToken?.symbol ?? fromToken.symbol,
    to_token: quote.outputToken?.symbol ?? toToken.symbol,
    from_amount: decimalToAtomic(input.amount, fromToken.decimals),
    to_amount: quote.outputAmount ?? null,
    to_amount_min: quote.outputAmount ?? null,
    from_amount_usd: Number(input.amount),
    to_amount_usd: quote.outputAmount ? roundUsd(atomicToDecimal(quote.outputAmount, toToken.decimals)) : null,
    eta_minutes: etaSeconds === null ? null : Math.max(1, Math.ceil(etaSeconds / 60)),
    fee_usd: relayFeeUsd,
    gas_fee_usd: gasFeeUsd,
    bridge_fee_usd: roundUsd(Math.max(0, relayFeeUsd - gasFeeUsd)),
    requirements: [
      'source wallet must hold source token and gas token',
      `Across quote block: ${quote.quoteBlock ?? 'not returned'}`,
      `capital fee USD: ${capitalFeeUsd}`,
      `lp fee USD: ${lpFeeUsd}`
    ],
    included_steps: ['Across suggested-fees'],
    data_source: 'across:suggested-fees'
  };
}

export async function fetchAcrossQuote(input: BridgeInput): Promise<BridgeRoute> {
  if (input.token.trim().toUpperCase() !== 'USDC') {
    throw new Error('Across direct provider is enabled for USDC routes only so fee_usd remains token-accurate.');
  }
  const fromChain = resolveChain(input.from_chain);
  const toChain = resolveChain(input.to_chain);
  const fromToken = resolveToken(input.token, fromChain);
  const toToken = resolveToken(input.token, toChain);
  const amount = decimalToAtomic(input.amount, fromToken.decimals);
  const params = new URLSearchParams({
    inputToken: fromToken.address,
    outputToken: toToken.address,
    originChainId: String(fromChain),
    destinationChainId: String(toChain),
    amount
  });
  const quote = await fetchJson<AcrossSuggestedFees>(`${ACROSS_SUGGESTED_FEES}?${params.toString()}`);
  return normalizeAcrossQuote(quote, input);
}

export const acrossTestInternals = { normalizeAcrossQuote, atomicToDecimal };
