import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Log,
  type PublicClient
} from 'viem';
import { getChainConfig } from './chains.js';
import { alertsFor, buildHolderCalculationEvidence, centralizationRisk, concentrationMetrics, shareBps } from './metrics.js';
import type { ExternalCheck, LargeTransfer, MonitorInput, MonitorOutput, SupportedChain, WhaleWallet } from './types.js';

type AnyClient = PublicClient<any, any, any>;

const transferTopic = keccak256(toBytes('Transfer(address,address,uint256)'));
const zeroAddress = '0x0000000000000000000000000000000000000000';
const erc20Abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]);

type TransferEvent = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  blockNumber: bigint;
  transactionHash?: `0x${string}`;
};

export async function monitorTokenHolders(input: MonitorInput): Promise<MonitorOutput> {
  const token = getAddress(input.contract_address);
  const config = getChainConfig(input.chain);
  const client = createPublicClient({ chain: config.viemChain, transport: http(config.rpcUrl, { timeout: 15_000 }) }) as AnyClient;
  const latestBlock = await client.getBlockNumber();
  const lookback = input.lookback_blocks || config.defaultLookbackBlocks;
  const fromBlock = latestBlock > BigInt(lookback) ? latestBlock - BigInt(lookback) : 0n;
  const externalChecks: ExternalCheck[] = [];
  const warnings: string[] = [];
  const dataSources = new Set<string>();

  const [meta, transferResult] = await Promise.all([
    readTokenMeta(client, token),
    collectTransfers({ chain: input.chain, token, client, fromBlock, toBlock: latestBlock }, warnings)
  ]);
  externalChecks.push(transferResult.check);
  if (transferResult.check.status === 'ok') dataSources.add(transferResult.check.provider);

  const candidateMap = buildCandidateMap(transferResult.transfers);
  const candidateAddresses = [...candidateMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([address]) => address);
  const balances = await readBalances(client, token, candidateAddresses, input.min_holders || 100);
  const sorted = balances.sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
  const totalSupply = meta.totalSupply;
  const balanceValues = sorted.map((item) => item.balance);
  const metrics = concentrationMetrics(balanceValues, totalSupply);
  const risk = centralizationRisk(metrics);
  const topN = input.top_n || 25;
  const decimals = meta.decimals ?? 18;

  const whale_wallets: WhaleWallet[] = sorted.slice(0, topN).map((item) => ({
    address: item.address,
    balance_raw: item.balance.toString(),
    balance_display: formatUnits(item.balance, decimals),
    share_bps: shareBps(item.balance, totalSupply),
    transfer_count_observed: candidateMap.get(item.address.toLowerCase())?.count || 0
  }));

  const largeTransfers = selectLargeTransfers(transferResult.transfers, totalSupply, decimals, input.large_transfer_threshold_bps || 50);
  const sampled = true;
  const alerts = alertsFor(metrics, sorted.length, sampled);
  for (const transfer of largeTransfers.slice(0, 5)) {
    alerts.push({
      severity: (transfer.amount_supply_bps || 0) >= 500 ? 'high' : 'medium',
      type: 'large_transfer',
      message: `Observed transfer of ${transfer.amount_display || transfer.amount_raw} ${meta.symbol || 'tokens'} in the scan window.`,
      evidence: transfer
    });
  }

  if (sorted.length < (input.min_holders || 100)) {
    warnings.push(`Observed ${sorted.length} current holders from transfer candidates, below requested min_holders=${input.min_holders || 100}. Increase lookback_blocks or configure explorer access for broader coverage.`);
  }

  return {
    holder_count: sorted.length,
    holder_count_is_sampled: sampled,
    whale_wallets,
    concentration_metrics: metrics,
    centralization_risk: risk,
    alerts,
    large_transfers: largeTransfers,
    token_info: {
      chain: input.chain,
      chain_id: config.chainId,
      contract_address: token,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      total_supply_raw: totalSupply?.toString(),
      total_supply_display: totalSupply !== undefined ? formatUnits(totalSupply, decimals) : undefined
    },
    external_checks: externalChecks,
    data_sources: [...dataSources].sort(),
    warnings,
    calculation_evidence: buildHolderCalculationEvidence(),
    generated_at: new Date().toISOString(),
    scan_window: { from_block: fromBlock.toString(), to_block: latestBlock.toString(), lookback_blocks: lookback }
  };
}

async function collectTransfers(args: {
  chain: SupportedChain;
  token: `0x${string}`;
  client: AnyClient;
  fromBlock: bigint;
  toBlock: bigint;
}, warnings: string[]): Promise<{ transfers: TransferEvent[]; check: ExternalCheck }> {
  if (process.env.ETHERSCAN_API_KEY) {
    const explorer = await getExplorerTransfers(args, warnings);
    if (explorer.transfers.length > 0 || explorer.check.status === 'ok') return explorer;
  }
  return getRpcTransfers(args, warnings);
}

async function getExplorerTransfers(args: {
  chain: SupportedChain;
  token: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
}, warnings: string[]): Promise<{ transfers: TransferEvent[]; check: ExternalCheck }> {
  const config = getChainConfig(args.chain);
  const url = `${config.explorerApiUrl}?chainid=${config.chainId}&module=logs&action=getLogs&address=${args.token}&fromBlock=${args.fromBlock}&toBlock=${args.toBlock}&topic0=${transferTopic}&page=1&offset=10000&apikey=${process.env.ETHERSCAN_API_KEY}`;
  try {
    const json = await fetchJson<{ status?: string; message?: string; result?: unknown }>(url);
    if (!Array.isArray(json.result)) throw new Error(json.message || 'non-array result');
    const transfers = json.result.map(explorerLogToViemLog).map(decodeTransfer).filter((item): item is TransferEvent => Boolean(item));
    if (json.result.length >= 10_000) warnings.push('Explorer result hit offset=10000; increase pagination for exhaustive scans.');
    return { transfers, check: { provider: 'etherscan-v2', status: 'ok', evidence: { logs: transfers.length, capped: json.result.length >= 10_000 } } };
  } catch (error) {
    return { transfers: [], check: { provider: 'etherscan-v2', status: 'error', error: error instanceof Error ? error.message : String(error) } };
  }
}

async function getRpcTransfers(args: {
  token: `0x${string}`;
  client: AnyClient;
  fromBlock: bigint;
  toBlock: bigint;
}, warnings: string[]): Promise<{ transfers: TransferEvent[]; check: ExternalCheck }> {
  const transfers: TransferEvent[] = [];
  let chunk = 200n;
  let queries = 0;
  try {
    for (let start = args.fromBlock; start <= args.toBlock && queries < 40; ) {
      const end = start + chunk > args.toBlock ? args.toBlock : start + chunk;
      try {
        const logs = await args.client.getLogs({
          address: args.token,
          fromBlock: start,
          toBlock: end,
          event: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])[0]
        } as any);
        transfers.push(...logs.map(decodeTransfer).filter((item): item is TransferEvent => Boolean(item)));
        start = end + 1n;
        queries += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (chunk > 25n && /max results|too many|exceed/i.test(message)) {
          chunk = chunk / 2n;
          continue;
        }
        throw error;
      }
    }
    if (queries >= 40 && args.fromBlock + BigInt(40) * chunk <= args.toBlock) warnings.push('RPC log scan hit the 40-query safety cap; increase explorer access for broader coverage.');
    warnings.push('ETHERSCAN_API_KEY not configured; holder set is sampled from bounded RPC Transfer logs.');
    return { transfers, check: { provider: 'rpc', status: 'ok', evidence: { logs: transfers.length, queries, chunk_blocks: chunk.toString() } } };
  } catch (error) {
    return { transfers: [], check: { provider: 'rpc', status: 'error', error: error instanceof Error ? error.message : String(error) } };
  }
}

function decodeTransfer(log: Log): TransferEvent | null {
  try {
    const decoded = decodeEventLog({ abi: erc20Abi, data: log.data || '0x', topics: log.topics });
    if (decoded.eventName !== 'Transfer') return null;
    return {
      from: getAddress(String(decoded.args.from)),
      to: getAddress(String(decoded.args.to)),
      value: decoded.args.value as bigint,
      blockNumber: log.blockNumber || 0n,
      transactionHash: log.transactionHash || undefined
    };
  } catch {
    return null;
  }
}

function buildCandidateMap(transfers: TransferEvent[]): Map<string, { count: number }> {
  const map = new Map<string, { count: number }>();
  for (const transfer of transfers) {
    for (const address of [transfer.from, transfer.to]) {
      if (address.toLowerCase() === zeroAddress) continue;
      const key = address.toLowerCase();
      const current = map.get(key) || { count: 0 };
      current.count += 1;
      map.set(key, current);
    }
  }
  return map;
}

async function readBalances(client: AnyClient, token: `0x${string}`, addresses: string[], minHolders: number): Promise<Array<{ address: string; balance: bigint }>> {
  const sortedCandidates = addresses.slice(0, Math.min(Math.max(minHolders * 8, 160), 800));
  const out: Array<{ address: string; balance: bigint }> = [];
  const batchSize = 100;
  for (let i = 0; i < sortedCandidates.length; i += batchSize) {
    const batch = sortedCandidates.slice(i, i + batchSize).map((address) => getAddress(address));
    const balances = await readBalanceBatch(client, token, batch);
    for (const item of balances) if (item.balance > 0n) out.push(item);
    if (out.length >= minHolders * 2 && i >= minHolders * 4) break;
  }
  return out;
}

async function readBalanceBatch(client: AnyClient, token: `0x${string}`, addresses: `0x${string}`[]): Promise<Array<{ address: string; balance: bigint }>> {
  try {
    const results = await client.multicall({
      contracts: addresses.map((address) => ({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })),
      allowFailure: true
    });
    return results.map((result, index) => ({
      address: addresses[index],
      balance: result.status === 'success' ? result.result as bigint : 0n
    }));
  } catch {
    const fallback = await Promise.all(addresses.map(async (address) => ({
      address,
      balance: await safeRead<bigint>(client, { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) || 0n
    })));
    return fallback;
  }
}

function selectLargeTransfers(transfers: TransferEvent[], totalSupply: bigint | undefined, decimals: number, thresholdBps: number): LargeTransfer[] {
  return transfers
    .map((transfer) => ({
      transaction_hash: transfer.transactionHash,
      block_number: transfer.blockNumber.toString(),
      from: transfer.from,
      to: transfer.to,
      amount_raw: transfer.value.toString(),
      amount_display: formatUnits(transfer.value, decimals),
      amount_supply_bps: shareBps(transfer.value, totalSupply)
    }))
    .filter((transfer) => (transfer.amount_supply_bps || 0) >= thresholdBps)
    .sort((a, b) => BigInt(b.amount_raw) > BigInt(a.amount_raw) ? 1 : -1)
    .slice(0, 25);
}

async function readTokenMeta(client: AnyClient, token: `0x${string}`): Promise<{ name?: string; symbol?: string; decimals?: number; totalSupply?: bigint }> {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    safeRead<string>(client, { address: token, abi: erc20Abi, functionName: 'name' }),
    safeRead<string>(client, { address: token, abi: erc20Abi, functionName: 'symbol' }),
    safeRead<number>(client, { address: token, abi: erc20Abi, functionName: 'decimals' }),
    safeRead<bigint>(client, { address: token, abi: erc20Abi, functionName: 'totalSupply' })
  ]);
  return { name, symbol, decimals, totalSupply };
}

async function safeRead<T>(client: AnyClient, request: Parameters<AnyClient['readContract']>[0]): Promise<T | undefined> {
  try {
    return await client.readContract(request) as T;
  } catch {
    return undefined;
  }
}

export function explorerLogToViemLog(item: unknown): Log {
  const row = item as Record<string, unknown>;
  const rawTopics = Array.isArray(row.topics) ? row.topics : [];
  return {
    address: getAddress(String(row.address)),
    topics: rawTopics.filter((topic): topic is `0x${string}` => typeof topic === 'string' && topic.startsWith('0x')),
    data: (typeof row.data === 'string' ? row.data : '0x') as `0x${string}`,
    blockNumber: BigInt(typeof row.blockNumber === 'string' ? row.blockNumber : '0'),
    transactionHash: typeof row.transactionHash === 'string' ? row.transactionHash as `0x${string}` : undefined
  } as Log;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'token-holder-monitor/0.1' }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
