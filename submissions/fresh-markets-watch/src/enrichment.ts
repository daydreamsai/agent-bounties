import type { RpcClient, RpcLog } from './rpc.js';
import type { FreshMarket, InitLiquidityEvidence, TopHolderEvidence } from './types.js';

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC_ADDRESS = '0000000000000000000000000000000000000000';
const GET_RESERVES_SELECTOR = '0x0902f1ac';
const SLOT0_SELECTOR = '0x3850c7bd';
const LIQUIDITY_SELECTOR = '0x1a686502';

function cleanHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function word(data: string, index: number): string {
  return cleanHex(data).slice(index * 64, (index + 1) * 64).padStart(64, '0');
}

function wordToDecimalString(data: string, index: number): string {
  const value = BigInt(`0x${word(data, index) || '0'}`);
  return value.toString();
}

function topicAddress(topic: string): string {
  return `0x${topic.slice(-40)}`;
}

function isZeroAddressTopic(topic: string | undefined): boolean {
  return cleanHex(topic ?? '').slice(-40).toLowerCase() === ZERO_TOPIC_ADDRESS;
}

async function enrichV2Liquidity(rpc: RpcClient, market: FreshMarket): Promise<InitLiquidityEvidence | null> {
  const data = await rpc.ethCall(market.pair_address, GET_RESERVES_SELECTOR, market.block_number);
  if (!data || data === '0x') return null;
  const reserve0 = wordToDecimalString(data, 0);
  const reserve1 = wordToDecimalString(data, 1);
  return {
    source: 'eth_call:getReserves@creation_block',
    block_number: market.block_number,
    token0: market.tokens[0],
    token1: market.tokens[1],
    reserve0_raw: reserve0,
    reserve1_raw: reserve1,
    initialized: reserve0 !== '0' || reserve1 !== '0',
    note: reserve0 === '0' && reserve1 === '0' ? 'Pair existed at creation block but no reserves were initialized by that block.' : undefined
  };
}

async function enrichV3Liquidity(rpc: RpcClient, market: FreshMarket): Promise<InitLiquidityEvidence | null> {
  const [slot0, liquidity] = await Promise.all([
    rpc.ethCall(market.pair_address, SLOT0_SELECTOR, market.block_number),
    rpc.ethCall(market.pair_address, LIQUIDITY_SELECTOR, market.block_number)
  ]);
  if (!slot0 || slot0 === '0x') return null;
  const sqrtPriceX96 = wordToDecimalString(slot0, 0);
  const liquidityRaw = liquidity && liquidity !== '0x' ? wordToDecimalString(liquidity, 0) : '0';
  return {
    source: 'eth_call:slot0+liquidity@creation_block',
    block_number: market.block_number,
    token0: market.tokens[0],
    token1: market.tokens[1],
    sqrt_price_x96: sqrtPriceX96,
    liquidity_raw: liquidityRaw,
    initialized: sqrtPriceX96 !== '0' || liquidityRaw !== '0',
    note: sqrtPriceX96 === '0' && liquidityRaw === '0' ? 'Pool existed at creation block but was not initialized by that block.' : undefined
  };
}

export function extractInitialLpHolders(logs: RpcLog[], pairAddress: string): TopHolderEvidence[] {
  const pair = pairAddress.toLowerCase();
  const holders = new Map<string, bigint>();
  for (const log of logs) {
    if (log.address.toLowerCase() !== pair) continue;
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if (!isZeroAddressTopic(log.topics[1])) continue;
    const holder = topicAddress(log.topics[2] ?? '').toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(holder)) continue;
    if (holder === `0x${ZERO_TOPIC_ADDRESS}`) continue;
    const amount = BigInt(`0x${cleanHex(log.data) || '0'}`);
    holders.set(holder, (holders.get(holder) ?? 0n) + amount);
  }
  return [...holders.entries()]
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1))
    .slice(0, 10)
    .map(([address, amount]) => ({ address, amount_raw: amount.toString(), source: 'eth_getTransactionReceipt:lp_transfer_from_zero' }));
}

export async function enrichMarket(rpc: RpcClient, market: FreshMarket): Promise<FreshMarket> {
  const enriched: FreshMarket = { ...market };
  try {
    enriched.init_liquidity = market.event_type === 'PairCreated'
      ? await enrichV2Liquidity(rpc, market)
      : await enrichV3Liquidity(rpc, market);
  } catch (error) {
    enriched.init_liquidity = {
      source: market.event_type === 'PairCreated' ? 'eth_call:getReserves@creation_block' : 'eth_call:slot0+liquidity@creation_block',
      block_number: market.block_number,
      token0: market.tokens[0],
      token1: market.tokens[1],
      initialized: false,
      note: error instanceof Error ? error.message : String(error)
    };
  }

  if (market.event_type === 'PairCreated') {
    try {
      const receipt = await rpc.getTransactionReceipt(market.transaction_hash);
      enriched.top_holders = receipt ? extractInitialLpHolders(receipt.logs, market.pair_address) : [];
      if (enriched.top_holders.length === 0) enriched.top_holders_unavailable_reason = 'No LP token mint Transfer logs from zero address were found in the creation transaction receipt.';
    } catch (error) {
      enriched.top_holders = [];
      enriched.top_holders_unavailable_reason = error instanceof Error ? error.message : String(error);
    }
  } else {
    enriched.top_holders = [];
    enriched.top_holders_unavailable_reason = 'V3 pools do not issue ERC20 LP tokens; concentrated-liquidity positions are represented outside the pool contract.';
  }

  return enriched;
}

export const testInternals = { wordToDecimalString, extractInitialLpHolders };
