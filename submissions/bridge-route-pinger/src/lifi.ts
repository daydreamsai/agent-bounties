import type { BridgeRoute } from './types.js';

const LIFI_BASE = 'https://li.quest/v1';
const NATIVE = '0x0000000000000000000000000000000000000000';

export const chains: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  optimism: 10,
  op: 10,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  arb: 42161,
  avalanche: 43114,
  base: 8453,
  scroll: 534352,
  linea: 59144
};

const tokens: Record<string, Record<number, { address: string; decimals: number }>> = {
  ETH: {
    1: { address: NATIVE, decimals: 18 },
    10: { address: NATIVE, decimals: 18 },
    42161: { address: NATIVE, decimals: 18 },
    8453: { address: NATIVE, decimals: 18 },
    534352: { address: NATIVE, decimals: 18 },
    59144: { address: NATIVE, decimals: 18 }
  },
  USDC: {
    1: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    10: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    137: { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
    42161: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    8453: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    43114: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 }
  },
  USDT: {
    1: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    10: { address: '0x94b008aD1B9A1696C2ccB3eBf9b3729dF2C0F5d2', decimals: 6 },
    137: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    42161: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    43114: { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 }
  }
};

interface LifiFeeCost { name?: string; description?: string; amountUSD?: string; included?: boolean }
interface LifiGasCost { type?: string; amountUSD?: string; token?: { symbol?: string; chainId?: number } }
interface LifiStep { tool?: string; toolDetails?: { name?: string }; estimate?: { executionDuration?: number; feeCosts?: LifiFeeCost[]; gasCosts?: LifiGasCost[] } }
interface LifiQuote {
  id?: string;
  tool?: string;
  toolDetails?: { name?: string };
  action?: { fromToken?: { symbol?: string; chainId?: number }; toToken?: { symbol?: string; chainId?: number }; fromAmount?: string };
  estimate?: { fromAmount?: string; toAmount?: string; toAmountMin?: string; fromAmountUSD?: string; toAmountUSD?: string; executionDuration?: number; feeCosts?: LifiFeeCost[]; gasCosts?: LifiGasCost[] };
  includedSteps?: LifiStep[];
}

function numeric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveChain(value: string): number {
  const normalized = value.trim().toLowerCase();
  const asNumber = Number(normalized);
  if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;
  const chainId = chains[normalized];
  if (!chainId) throw new Error(`Unsupported chain: ${value}`);
  return chainId;
}

export function resolveToken(symbolOrAddress: string, chainId: number): { symbol: string; address: string; decimals: number } {
  const token = symbolOrAddress.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(token)) return { symbol: token, address: token, decimals: 18 };
  const symbol = token.toUpperCase();
  const resolved = tokens[symbol]?.[chainId];
  if (!resolved) throw new Error(`Unsupported token ${token} on chain ${chainId}. Use a token address for custom tokens.`);
  return { symbol, ...resolved };
}

export function decimalToAtomic(amount: string | number, decimals: number): string {
  const raw = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid positive decimal amount: ${raw}`);
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimals`);
  return `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
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

function sumUsd(items: Array<{ amountUSD?: string }> | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + (numeric(item.amountUSD) ?? 0), 0);
}

function usd(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizeQuote(quote: LifiQuote, fromChainName: string, toChainName: string): BridgeRoute {
  const feeCosts = quote.estimate?.feeCosts ?? [];
  const gasCosts = quote.estimate?.gasCosts ?? [];
  const etaSeconds = quote.estimate?.executionDuration ?? quote.includedSteps?.reduce((sum, step) => sum + (step.estimate?.executionDuration ?? 0), 0) ?? null;
  const requirements = [
    ...gasCosts.map((gas) => `source gas token required: ${gas.token?.symbol ?? 'native'} on chain ${gas.token?.chainId ?? quote.action?.fromToken?.chainId ?? 'source'}`),
    ...feeCosts.filter((fee) => fee.included === false).map((fee) => `not included fee: ${fee.name ?? 'unknown fee'}`)
  ];
  const bridgeFeeUsd = usd(sumUsd(feeCosts));
  const gasFeeUsd = usd(sumUsd(gasCosts));
  return {
    route_id: quote.id ?? `${quote.tool ?? 'lifi'}:${Date.now()}`,
    tool: quote.tool ?? 'lifi',
    bridge: quote.toolDetails?.name ?? quote.tool ?? 'unknown',
    from_chain: fromChainName,
    to_chain: toChainName,
    from_token: quote.action?.fromToken?.symbol ?? 'unknown',
    to_token: quote.action?.toToken?.symbol ?? 'unknown',
    from_amount: quote.estimate?.fromAmount ?? quote.action?.fromAmount ?? '0',
    to_amount: quote.estimate?.toAmount ?? null,
    to_amount_min: quote.estimate?.toAmountMin ?? null,
    from_amount_usd: numeric(quote.estimate?.fromAmountUSD),
    to_amount_usd: numeric(quote.estimate?.toAmountUSD),
    eta_minutes: etaSeconds === null ? null : Math.max(1, Math.ceil(etaSeconds / 60)),
    fee_usd: usd(bridgeFeeUsd + gasFeeUsd),
    gas_fee_usd: gasFeeUsd,
    bridge_fee_usd: bridgeFeeUsd,
    requirements: requirements.length > 0 ? requirements : ['source wallet must hold source token and gas token'],
    included_steps: (quote.includedSteps ?? []).map((step) => step.toolDetails?.name ?? step.tool ?? 'step'),
    data_source: 'lifi:v1:quote'
  };
}

export async function fetchLifiQuote(input: { token: string; amount: string | number; from_chain: string; to_chain: string; from_address: string; slippage: number }): Promise<BridgeRoute> {
  const fromChain = resolveChain(input.from_chain);
  const toChain = resolveChain(input.to_chain);
  const fromToken = resolveToken(input.token, fromChain);
  const toToken = resolveToken(input.token, toChain);
  const fromAmount = decimalToAtomic(input.amount, fromToken.decimals);
  const params = new URLSearchParams({
    fromChain: String(fromChain),
    toChain: String(toChain),
    fromToken: fromToken.address,
    toToken: toToken.address,
    fromAmount,
    fromAddress: input.from_address,
    slippage: String(input.slippage)
  });
  const quote = await fetchJson<LifiQuote>(`${LIFI_BASE}/quote?${params.toString()}`);
  return normalizeQuote(quote, input.from_chain, input.to_chain);
}

export const testInternals = { decimalToAtomic, resolveChain, resolveToken, normalizeQuote, numeric };
