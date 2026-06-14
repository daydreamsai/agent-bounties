import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toBytes,
  type Log,
  type PublicClient,
  type Chain
} from 'viem';
import { arbitrum, avalanche, base, bsc, fantom, gnosis, mainnet, optimism, polygon } from 'viem/chains';
import { attachRiskScore, erc20RevokeTx, erc721TokenRevokeTx, maxUint256, operatorRevokeTx } from './calldata.js';
import { getChainConfig, type ChainConfig } from './chains.js';
import { buildApprovalCalculationEvidence } from './evidence.js';
import { baseRiskFlags, isLikelyHighValue } from './risk.js';
import type { ApprovalRecord, AuditInput, AuditOutput, RiskFlag, SupportedChain } from './types.js';

const approvalTopic = keccak256(toBytes('Approval(address,address,uint256)'));
const approvalForAllTopic = keccak256(toBytes('ApprovalForAll(address,address,bool)'));
const defaultScanSpan = 750_000n;
type AnyClient = PublicClient<any, any, any>;

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]);

const erc721Abi = parseAbi([
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]);

const knownSpenders = new Map<string, string>([
  ['0x1111111254eeb25477b68fb85ed929f73a960582', '1inch Router'],
  ['0x111111125421ca6dc452d289314280a0f8842a65', '1inch Router v6'],
  ['0xdef1c0ded9bec7f1a1670819833240f027b25eff', '0x Exchange Proxy'],
  ['0x000000000022d473030f116ddee9f6b43ac78ba3', 'Uniswap Permit2'],
  ['0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', 'Uniswap SwapRouter02'],
  ['0xe592427a0aece92de3edee1f18e0157c05861564', 'Uniswap SwapRouter'],
  ['0x00000000006c3852cbef3e08e8df289169ede581', 'OpenSea Seaport 1.1'],
  ['0x00000000000000adc04c56bf30ac9d3c0aaf14dc', 'OpenSea Seaport 1.5']
]);

export async function auditApprovals(rawInput: AuditInput): Promise<AuditOutput> {
  const wallet = getAddress(rawInput.wallet);
  const staleDays = rawInput.stale_days || 90;
  const approvals: ApprovalRecord[] = [];
  const warnings: string[] = [];
  const dataSources = new Set<string>();

  for (const chain of rawInput.chains) {
    const config = getChainConfig(chain);
    const client = createClient(chain, config);
    const latestBlock = await client.getBlockNumber();
    const requestedFromBlock = rawInput.from_block?.[chain];
    const fromBlock = chooseFromBlock({
      requestedFromBlock,
      latestBlock,
      defaultFromBlock: config.defaultFromBlock,
      hasExplorerKey: Boolean(process.env.ETHERSCAN_API_KEY),
      warnings,
      chain
    });

    const events = await collectEvents({
      chain,
      config,
      client,
      owner: wallet,
      fromBlock,
      toBlock: latestBlock,
      tokenFilter: new Set((rawInput.token_addresses || []).map((item) => getAddress(item)))
    }, warnings, dataSources);

    const grouped = latestEventByApproval(events);
    for (const event of grouped.values()) {
      const record = await eventToCurrentApproval({ chain, client, event, owner: wallet, staleDays }, warnings);
      if (record) approvals.push(record);
    }
  }

  return {
    wallet,
    chains: rawInput.chains,
    generated_at: new Date().toISOString(),
    approvals: approvals.sort((a, b) => b.risk_score - a.risk_score),
    risk_flags: Object.fromEntries(approvals.map((approval) => [approval.id, approval.risk_flags])),
    revoke_tx_data: approvals.map((approval) => approval.revoke_tx_data),
    warnings,
    data_sources: [...dataSources].sort(),
    calculation_evidence: buildApprovalCalculationEvidence()
  };
}

type ApprovalEvent = {
  chain: SupportedChain;
  standard: 'erc20_or_erc721_token' | 'operator';
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  value?: bigint;
  tokenId?: bigint;
  approved?: boolean;
  blockNumber: bigint;
  logIndex?: number;
  transactionHash?: `0x${string}`;
};

async function collectEvents(args: {
  chain: SupportedChain;
  config: ChainConfig;
  client: AnyClient;
  owner: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  tokenFilter: Set<string>;
}, warnings: string[], dataSources: Set<string>): Promise<ApprovalEvent[]> {
  if (process.env.ETHERSCAN_API_KEY) {
    const explorer = await getExplorerLogs(args, warnings);
    if (explorer.length > 0) {
      dataSources.add(`etherscan-v2:${args.chain}`);
      return explorer;
    }
  }

  dataSources.add(`rpc-logs:${args.chain}`);
  return getRpcLogs(args, warnings);
}

async function getExplorerLogs(args: {
  chain: SupportedChain;
  config: ChainConfig;
  owner: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  tokenFilter: Set<string>;
}, warnings: string[]): Promise<ApprovalEvent[]> {
  const ownerTopic = addressTopic(args.owner);
  const common = `chainid=${args.config.chainId}&module=logs&action=getLogs&fromBlock=${args.fromBlock}&toBlock=${args.toBlock}&topic1=${ownerTopic}&apikey=${process.env.ETHERSCAN_API_KEY}`;
  const urls = [
    `${args.config.explorerApiUrl}?${common}&topic0=${approvalTopic}`,
    `${args.config.explorerApiUrl}?${common}&topic0=${approvalForAllTopic}`
  ];
  const out: ApprovalEvent[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'approval-risk-auditor/0.1' } });
      const json = await response.json() as { status?: string; message?: string; result?: unknown };
      if (!Array.isArray(json.result)) {
        warnings.push(`${args.chain}: explorer log query returned ${json.message || 'non-array result'}`);
        continue;
      }
      for (const item of json.result) {
        const log = explorerLogToViemLog(item);
        const event = decodeApprovalLog(args.chain, log, args.owner);
        if (event && tokenAllowed(event.token, args.tokenFilter)) out.push(event);
      }
    } catch (error) {
      warnings.push(`${args.chain}: explorer log query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return out;
}

async function getRpcLogs(args: {
  chain: SupportedChain;
  client: AnyClient;
  owner: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  tokenFilter: Set<string>;
}, warnings: string[]): Promise<ApprovalEvent[]> {
  const out: ApprovalEvent[] = [];
  for (const topic0 of [approvalTopic, approvalForAllTopic]) {
    try {
      const logs = await args.client.getLogs({
        address: args.tokenFilter.size ? [...args.tokenFilter] as `0x${string}`[] : undefined,
        fromBlock: args.fromBlock,
        toBlock: args.toBlock,
        topics: [topic0, addressTopic(args.owner)]
      } as any);
      for (const log of logs) {
        const event = decodeApprovalLog(args.chain, log, args.owner);
        if (event && tokenAllowed(event.token, args.tokenFilter)) out.push(event);
      }
    } catch (error) {
      warnings.push(`${args.chain}: RPC log query failed for ${topic0}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return out;
}

export function decodeApprovalLog(chain: SupportedChain, log: Log, owner: `0x${string}`): ApprovalEvent | null {
  if (!log.address || !log.topics[0]) return null;
  try {
    if (log.topics[0].toLowerCase() === approvalTopic.toLowerCase()) {
      if (log.topics.length >= 4) {
        const decoded = decodeEventLog({
          abi: parseAbi(['event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)']),
          data: log.data || '0x',
          topics: log.topics
        });
        return {
          chain,
          standard: 'erc20_or_erc721_token',
          token: getAddress(log.address),
          owner,
          spender: getAddress(String(decoded.args.approved)),
          tokenId: decoded.args.tokenId as bigint,
          blockNumber: log.blockNumber || 0n,
          logIndex: typeof log.logIndex === 'number' ? log.logIndex : undefined,
          transactionHash: log.transactionHash || undefined
        };
      }

      const decoded = decodeEventLog({
        abi: parseAbi(['event Approval(address indexed owner, address indexed spender, uint256 value)']),
        data: log.data || '0x',
        topics: log.topics
      });
      return {
        chain,
        standard: 'erc20_or_erc721_token',
        token: getAddress(log.address),
        owner,
        spender: getAddress(String(decoded.args.spender)),
        value: decoded.args.value as bigint,
        blockNumber: log.blockNumber || 0n,
        logIndex: typeof log.logIndex === 'number' ? log.logIndex : undefined,
        transactionHash: log.transactionHash || undefined
      };
    }
    if (log.topics[0].toLowerCase() === approvalForAllTopic.toLowerCase()) {
      const decoded = decodeEventLog({
        abi: parseAbi(['event ApprovalForAll(address indexed owner, address indexed operator, bool approved)']),
        data: log.data || '0x',
        topics: log.topics
      });
      return {
        chain,
        standard: 'operator',
        token: getAddress(log.address),
        owner,
        spender: getAddress(String(decoded.args.operator)),
        approved: Boolean(decoded.args.approved),
        blockNumber: log.blockNumber || 0n,
        logIndex: typeof log.logIndex === 'number' ? log.logIndex : undefined,
        transactionHash: log.transactionHash || undefined
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function eventToCurrentApproval(args: {
  chain: SupportedChain;
  client: AnyClient;
  event: ApprovalEvent;
  owner: `0x${string}`;
  staleDays: number;
}, warnings: string[]): Promise<ApprovalRecord | null> {
  const { chain, client, event } = args;
  const token = event.token;
  const spender = event.spender;
  const block = event.blockNumber ? await safeBlock(client, event.blockNumber) : null;
  const ageDays = block ? (Date.now() / 1000 - Number(block.timestamp)) / 86400 : null;
  const spenderInfo = await spenderStatus(client, spender, chain, warnings);

  if (event.standard === 'operator') {
    const active = await safeRead<boolean>(client, {
      address: token,
      abi: erc721Abi,
      functionName: 'isApprovedForAll',
      args: [args.owner, spender]
    });
    if (!active) return null;
    const nftKind = await nftKindForOperator(client, token);
    const flags = baseRiskFlags({ ageDays, staleDays: args.staleDays, spenderInfo });
    flags.push('operator_approval', 'current_approval_confirmed');
    const meta = await tokenMeta(client, token);
    return attachRiskScore({
      id: approvalId(chain, token, spender, 'operator'),
      chain,
      standard: nftKind,
      token,
      token_symbol: meta.symbol,
      token_name: meta.name,
      owner: args.owner,
      spender,
      approved: true,
      last_approval_tx: event.transactionHash,
      last_approval_block: event.blockNumber.toString(),
      last_approval_at: block ? new Date(Number(block.timestamp) * 1000).toISOString() : undefined,
      spender_verified: spenderInfo.verified,
      spender_label: spenderInfo.label,
      risk_flags: flags,
      revoke_tx_data: operatorRevokeTx(chain, token, spender)
    });
  }

  if (event.tokenId !== undefined) {
    const approved = await safeRead<`0x${string}`>(client, {
      address: token,
      abi: erc721Abi,
      functionName: 'getApproved',
      args: [event.tokenId]
    });
    if (!approved || getAddress(approved) !== spender) return null;
    const flags = baseRiskFlags({ ageDays, staleDays: args.staleDays, spenderInfo });
    flags.push('current_approval_confirmed');
    const meta = await tokenMeta(client, token);
    return attachRiskScore({
      id: approvalId(chain, token, spender, `token:${event.tokenId}`),
      chain,
      standard: 'erc721_token',
      token,
      token_symbol: meta.symbol,
      token_name: meta.name,
      owner: args.owner,
      spender,
      token_id: event.tokenId.toString(),
      approved: true,
      last_approval_tx: event.transactionHash,
      last_approval_block: event.blockNumber.toString(),
      last_approval_at: block ? new Date(Number(block.timestamp) * 1000).toISOString() : undefined,
      spender_verified: spenderInfo.verified,
      spender_label: spenderInfo.label,
      risk_flags: flags,
      revoke_tx_data: erc721TokenRevokeTx(chain, token, event.tokenId)
    });
  }

  const allowance = await safeRead<bigint>(client, {
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [args.owner, spender]
  });
  if (!allowance || allowance <= 0n) return null;

  const meta = await tokenMeta(client, token);
  const balance = await safeRead<bigint>(client, {
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [args.owner]
  });
  const decimals = meta.decimals ?? 18;
  const flags = baseRiskFlags({ ageDays, staleDays: args.staleDays, spenderInfo });
  if (allowance === maxUint256) flags.push('max_uint_allowance', 'unlimited_allowance');
  if (isLikelyHighValue(meta.symbol, allowance, balance || 0n, decimals)) flags.push('high_value_token_approval');
  flags.push('current_approval_confirmed');

  return attachRiskScore({
    id: approvalId(chain, token, spender, 'erc20'),
    chain,
    standard: 'erc20',
    token,
    token_symbol: meta.symbol,
    token_name: meta.name,
    token_decimals: meta.decimals,
    owner: args.owner,
    spender,
    allowance_raw: allowance.toString(),
    allowance_display: formatUnits(allowance, decimals),
    approved: true,
    last_approval_tx: event.transactionHash,
    last_approval_block: event.blockNumber.toString(),
    last_approval_at: block ? new Date(Number(block.timestamp) * 1000).toISOString() : undefined,
    spender_verified: spenderInfo.verified,
    spender_label: spenderInfo.label,
    risk_flags: flags,
    revoke_tx_data: erc20RevokeTx(chain, token, spender)
  });
}

export function latestEventByApproval(events: ApprovalEvent[]): Map<string, ApprovalEvent> {
  const map = new Map<string, ApprovalEvent>();
  for (const event of events) {
    const key = approvalId(event.chain, event.token, event.spender, event.tokenId !== undefined ? `token:${event.tokenId}` : event.standard === 'operator' ? 'operator' : 'erc20');
    const prev = map.get(key);
    if (!prev || isNewerApprovalEvent(event, prev)) map.set(key, event);
  }
  return map;
}

function isNewerApprovalEvent(candidate: ApprovalEvent, current: ApprovalEvent) {
  if (candidate.blockNumber !== current.blockNumber) return candidate.blockNumber > current.blockNumber;
  return (candidate.logIndex ?? -1) >= (current.logIndex ?? -1);
}

async function tokenMeta(client: AnyClient, token: `0x${string}`): Promise<{ symbol?: string; name?: string; decimals?: number }> {
  const [symbol, name, decimals] = await Promise.all([
    safeRead<string>(client, { address: token, abi: erc20Abi, functionName: 'symbol' }),
    safeRead<string>(client, { address: token, abi: erc20Abi, functionName: 'name' }),
    safeRead<number>(client, { address: token, abi: erc20Abi, functionName: 'decimals' })
  ]);
  return { symbol, name, decimals };
}

async function nftKindForOperator(client: AnyClient, token: `0x${string}`): Promise<'erc721_operator' | 'erc1155_operator' | 'erc721_or_erc1155_operator'> {
  const erc721 = await safeRead<boolean>(client, {
    address: token,
    abi: erc721Abi,
    functionName: 'supportsInterface',
    args: ['0x80ac58cd']
  });
  if (erc721) return 'erc721_operator';
  const erc1155 = await safeRead<boolean>(client, {
    address: token,
    abi: erc721Abi,
    functionName: 'supportsInterface',
    args: ['0xd9b67a26']
  });
  return erc1155 ? 'erc1155_operator' : 'erc721_or_erc1155_operator';
}

async function spenderStatus(client: AnyClient, spender: `0x${string}`, chain: SupportedChain, warnings: string[]) {
  const normalized = spender.toLowerCase();
  const label = knownSpenders.get(normalized);
  const code = await client.getCode({ address: spender }).catch(() => undefined);
  const isEoa = !code || code === '0x';
  let verified: boolean | undefined = label ? true : undefined;

  if (process.env.ETHERSCAN_API_KEY && !isEoa) {
    try {
      const config = getChainConfig(chain);
      const url = `${config.explorerApiUrl}?chainid=${config.chainId}&module=contract&action=getsourcecode&address=${spender}&apikey=${process.env.ETHERSCAN_API_KEY}`;
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'approval-risk-auditor/0.1' } });
      const json = await response.json() as { result?: Array<{ SourceCode?: string; ContractName?: string }> };
      const result = Array.isArray(json.result) ? json.result[0] : undefined;
      verified = Boolean(result?.SourceCode);
      return { label: label || result?.ContractName || undefined, verified, isEoa };
    } catch (error) {
      warnings.push(`${chain}: spender verification failed for ${spender}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { label, verified: verified ?? (isEoa ? false : undefined), isEoa };
}

async function safeRead<T>(client: AnyClient, request: Parameters<AnyClient['readContract']>[0]): Promise<T | undefined> {
  try {
    return await client.readContract(request) as T;
  } catch {
    return undefined;
  }
}

async function safeBlock(client: AnyClient, blockNumber: bigint) {
  try {
    return await client.getBlock({ blockNumber });
  } catch {
    return null;
  }
}

function createClient(chain: SupportedChain, config: ChainConfig): AnyClient {
  const viemChains: Record<SupportedChain, Chain> = {
    ethereum: mainnet,
    base,
    polygon,
    arbitrum,
    optimism,
    bsc,
    avalanche,
    gnosis,
    fantom
  };
  const viemChain = viemChains[chain];
  return createPublicClient({ chain: viemChain, transport: http(config.rpcUrl, { timeout: 20_000 }) }) as AnyClient;
}

export function explorerLogToViemLog(item: unknown): Log {
  const row = item as Record<string, unknown>;
  const rawTopics = Array.isArray(row.topics) ? row.topics : [];
  const topics = rawTopics.filter((topic): topic is `0x${string}` => typeof topic === 'string' && topic.startsWith('0x'));
  return {
    address: getAddress(String(row.address)),
    topics,
    data: (typeof row.data === 'string' ? row.data : '0x') as `0x${string}`,
    blockNumber: BigInt(typeof row.blockNumber === 'string' ? row.blockNumber : '0'),
    logIndex: parseExplorerNumber(row.logIndex),
    transactionHash: typeof row.transactionHash === 'string' ? row.transactionHash as `0x${string}` : undefined
  } as Log;
}

function parseExplorerNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return Number(BigInt(value));
}

function addressTopic(address: string): `0x${string}` {
  if (!isAddress(address)) throw new Error(`Invalid address: ${address}`);
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, '0')}`;
}

function tokenAllowed(token: string, filter: Set<string>) {
  return filter.size === 0 || filter.has(getAddress(token));
}

function approvalId(chain: SupportedChain, token: string, spender: string, suffix: string) {
  return `${chain}:${getAddress(token).toLowerCase()}:${getAddress(spender).toLowerCase()}:${suffix}`;
}

function minBigint(a: bigint, b: bigint) {
  return a < b ? a : b;
}

function chooseFromBlock(args: {
  requestedFromBlock: number | undefined;
  latestBlock: bigint;
  defaultFromBlock: bigint;
  hasExplorerKey: boolean;
  warnings: string[];
  chain: SupportedChain;
}): bigint {
  const scanFloor = args.latestBlock - minBigint(defaultScanSpan, args.latestBlock);
  if (args.requestedFromBlock !== undefined) {
    const requested = BigInt(args.requestedFromBlock);
    if (requested > args.latestBlock) return scanFloor;
    return requested;
  }
  if (args.hasExplorerKey) return args.defaultFromBlock > args.latestBlock ? scanFloor : args.defaultFromBlock;

  args.warnings.push(`${args.chain}: no ETHERSCAN_API_KEY configured; public RPC scan is limited to the latest ${defaultScanSpan.toString()} blocks`);
  return scanFloor;
}
