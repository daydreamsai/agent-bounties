import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbiItem,
  type PublicClient,
  type Address,
  type Log,
} from "viem";

/* ================================================================== */
/*  ABI Definitions                                                   */
/* ================================================================== */

const erc20Abi = [
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

const isApprovedForAllAbi = [
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/* ================================================================== */
/*  Chain Configuration                                               */
/* ================================================================== */

interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockRange: number;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockRange: 100_000,
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://1rpc.io/eth",
    blockRange: 50_000,
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockRange: 100_000,
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    blockRange: 100_000,
  },
};

/* ================================================================== */
/*  Well-Known Tokens Per Chain                                       */
/* ================================================================== */

interface TokenInfo {
  address: Address;
  symbol: string;
}

const KNOWN_TOKENS: Record<string, TokenInfo[]> = {
  base: [
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH" },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC" },
    { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC" },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI" },
    { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC" },
    { address: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A", symbol: "weETH" },
    { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH" },
  ],
  ethereum: [
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH" },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT" },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI" },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI" },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK" },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC" },
  ],
  arbitrum: [
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH" },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC" },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT" },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI" },
    { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB" },
  ],
  optimism: [
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH" },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC" },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT" },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI" },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP" },
  ],
};

/* ================================================================== */
/*  Trusted / Known Spenders                                          */
/* ================================================================== */

interface SpenderInfo {
  address: Address;
  label: string;
  chains: string[];
}

const KNOWN_SPENDERS: SpenderInfo[] = [
  // Base
  {
    address: "0x2626664c2603336E57B271c5C0b26F421741e481",
    label: "Uniswap V3 Router (Base)",
    chains: ["base"],
  },
  {
    address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    label: "Aerodrome Router (Base)",
    chains: ["base"],
  },
  {
    address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    label: "Aave V3 Pool (Base)",
    chains: ["base"],
  },
  {
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    label: "Uniswap Universal Router",
    chains: ["base", "ethereum", "arbitrum", "optimism"],
  },
  // Ethereum
  {
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    label: "Uniswap V3 Router (Ethereum)",
    chains: ["ethereum"],
  },
  {
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    label: "Uniswap V2 Router",
    chains: ["ethereum"],
  },
  {
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    label: "Aave V3 Pool (Ethereum)",
    chains: ["ethereum"],
  },
  // Arbitrum
  {
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    label: "Uniswap V3 Router (Arbitrum)",
    chains: ["arbitrum"],
  },
  {
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    label: "Aave V3 Pool (Arbitrum)",
    chains: ["arbitrum"],
  },
  // Optimism
  {
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    label: "Uniswap V3 Router (Optimism)",
    chains: ["optimism"],
  },
  {
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    label: "Aave V3 Pool (Optimism)",
    chains: ["optimism"],
  },
];

/* ================================================================== */
/*  Constants                                                         */
/* ================================================================== */

/** Threshold above which an allowance is considered "unlimited". */
const UNLIMITED_THRESHOLD = 2n ** 255n;

/** Threshold above which a non-unlimited allowance is still "very large". */
const VERY_LARGE_THRESHOLD = 10n ** 30n;

/** Maximum number of blocks to scan per getLogs batch to avoid RPC limits. */
const LOG_BATCH_SIZE = 10_000;

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

type RiskLevel = "low" | "medium" | "high" | "critical";

interface ApprovalRecord {
  token: string;
  token_symbol: string;
  spender: string;
  spender_label: string;
  allowance: string;
  is_unlimited: boolean;
  risk_level: RiskLevel;
  chain: string;
}

interface RevokeTx {
  token: string;
  spender: string;
  chain: string;
  to: string;
  data: string;
  description: string;
}

interface AuditResult {
  wallet: string;
  total_approvals: number;
  critical_count: number;
  high_count: number;
  approvals: ApprovalRecord[];
  revoke_tx_data: RevokeTx[];
}

interface AuditInput {
  wallet: string;
  chains: string[];
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */

function normalizeAddress(addr: string): Address {
  return addr.toLowerCase() as Address;
}

function lookupSpender(spenderAddr: string, chain: string): string {
  const lower = spenderAddr.toLowerCase();
  for (const s of KNOWN_SPENDERS) {
    if (
      s.address.toLowerCase() === lower &&
      s.chains.includes(chain)
    ) {
      return s.label;
    }
  }
  return "Unknown";
}

function isKnownSpender(spenderAddr: string, chain: string): boolean {
  return lookupSpender(spenderAddr, chain) !== "Unknown";
}

function classifyRisk(
  allowance: bigint,
  spenderAddr: string,
  chain: string
): RiskLevel {
  const unlimited = allowance >= UNLIMITED_THRESHOLD;
  const veryLarge = allowance >= VERY_LARGE_THRESHOLD;
  const known = isKnownSpender(spenderAddr, chain);

  if (unlimited && !known) return "critical";
  if (veryLarge && !known) return "high";
  if (unlimited && known) return "medium";
  return "low";
}

function formatAllowance(value: bigint): string {
  if (value >= UNLIMITED_THRESHOLD) return "UNLIMITED";
  return value.toString();
}

/**
 * Build a revoke transaction (approve spender for 0).
 */
function buildRevokeTx(
  tokenAddr: Address,
  spender: Address,
  tokenSymbol: string,
  spenderLabel: string,
  chain: string
): RevokeTx {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, 0n],
  });

  return {
    token: tokenAddr,
    spender,
    chain,
    to: tokenAddr,
    data,
    description: `Revoke ${tokenSymbol} approval for ${spenderLabel} (${spender})`,
  };
}

/**
 * Build a revoke-all transaction for ERC-721 (setApprovalForAll to false).
 */
function buildRevokeAllTx(
  nftContract: Address,
  operator: Address,
  operatorLabel: string,
  chain: string
): RevokeTx {
  const data = encodeFunctionData({
    abi: isApprovedForAllAbi,
    functionName: "setApprovalForAll",
    args: [operator, false],
  });

  return {
    token: nftContract,
    spender: operator,
    chain,
    to: nftContract,
    data,
    description: `Revoke NFT ApprovalForAll for ${operatorLabel} (${operator})`,
  };
}

/**
 * Fetch the on-chain symbol for a token. Returns "UNKNOWN" on failure.
 */
async function fetchSymbol(
  client: PublicClient,
  token: Address
): Promise<string> {
  try {
    const sym = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    });
    return sym as string;
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Read the current allowance on-chain. Returns 0n on failure.
 */
async function readAllowance(
  client: PublicClient,
  token: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  try {
    const result = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });
    return result as bigint;
  } catch {
    return 0n;
  }
}

/**
 * Read isApprovedForAll for an NFT contract. Returns false on failure.
 */
async function readIsApprovedForAll(
  client: PublicClient,
  nftContract: Address,
  owner: Address,
  operator: Address
): Promise<boolean> {
  try {
    const result = await client.readContract({
      address: nftContract,
      abi: isApprovedForAllAbi,
      functionName: "isApprovedForAll",
      args: [owner, operator],
    });
    return result as boolean;
  } catch {
    return false;
  }
}

/* ================================================================== */
/*  Log Scanning with Batched Ranges                                  */
/* ================================================================== */

const approvalEvent = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
);

const approvalForAllEvent = parseAbiItem(
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)"
);

/**
 * Generic batched log fetcher. Splits the block range into chunks of
 * LOG_BATCH_SIZE and retries by halving on RPC errors.
 */
async function fetchLogsBatched(
  client: PublicClient,
  params: {
    address?: Address;
    event: any;
    args: any;
  },
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  const allLogs: Log[] = [];

  for (
    let start = fromBlock;
    start <= toBlock;
    start += BigInt(LOG_BATCH_SIZE)
  ) {
    const end =
      start + BigInt(LOG_BATCH_SIZE) - 1n > toBlock
        ? toBlock
        : start + BigInt(LOG_BATCH_SIZE) - 1n;

    try {
      const logs = await client.getLogs({
        ...params,
        fromBlock: start,
        toBlock: end,
      } as any);
      allLogs.push(...(logs as Log[]));
    } catch (err: any) {
      // Some RPCs reject large ranges; halve and retry once
      const mid = (start + end) / 2n;
      if (mid > start) {
        try {
          const logsA = await client.getLogs({
            ...params,
            fromBlock: start,
            toBlock: mid,
          } as any);
          const logsB = await client.getLogs({
            ...params,
            fromBlock: mid + 1n,
            toBlock: end,
          } as any);
          allLogs.push(...(logsA as Log[]), ...(logsB as Log[]));
        } catch {
          console.warn(
            `[approval-auditor] Skipped block range ${start}-${end}: ${String(err).slice(0, 120)}`
          );
        }
      }
    }
  }
  return allLogs;
}

/**
 * Fetch ERC-20 Approval logs in batches, filtered by owner.
 */
async function getApprovalLogs(
  client: PublicClient,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  return fetchLogsBatched(
    client,
    {
      event: approvalEvent,
      args: { owner },
    },
    fromBlock,
    toBlock
  );
}

/**
 * Fetch ERC-721 ApprovalForAll logs in batches, filtered by owner.
 */
async function getApprovalForAllLogs(
  client: PublicClient,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  return fetchLogsBatched(
    client,
    {
      event: approvalForAllEvent,
      args: { owner },
    },
    fromBlock,
    toBlock
  );
}

/* ================================================================== */
/*  Per-Chain Scan                                                    */
/* ================================================================== */

interface ChainScanResult {
  approvals: ApprovalRecord[];
  revokeTxs: RevokeTx[];
}

async function scanChain(
  chainKey: string,
  wallet: Address,
  config: ChainConfig
): Promise<ChainScanResult> {
  const approvals: ApprovalRecord[] = [];
  const revokeTxs: RevokeTx[] = [];

  const client = createPublicClient({
    transport: http(config.rpcUrl, { timeout: 30_000, retryCount: 2 }),
  });

  // Determine block range to scan
  let toBlock: bigint;
  try {
    toBlock = await client.getBlockNumber();
  } catch (err) {
    console.error(
      `[approval-auditor] Cannot reach ${config.name} RPC: ${String(err).slice(0, 120)}`
    );
    return { approvals, revokeTxs };
  }

  const fromBlock =
    toBlock > BigInt(config.blockRange)
      ? toBlock - BigInt(config.blockRange)
      : 0n;

  // ---- ERC-20 Approval scanning ----

  // Build a symbol cache from known tokens
  const tokens = KNOWN_TOKENS[chainKey] ?? [];
  const symbolCache = new Map<string, string>();
  for (const t of tokens) {
    symbolCache.set(t.address.toLowerCase(), t.symbol);
  }

  // Fetch Approval logs (all tokens, filtered by owner)
  const logs = await getApprovalLogs(
    client,
    wallet,
    fromBlock,
    toBlock
  );

  // Deduplicate to unique (token, spender) pairs
  const pairsSeen = new Set<string>();
  const pairs: Array<{ token: Address; spender: Address }> = [];

  for (const log of logs) {
    const tokenAddr = (log.address as string).toLowerCase() as Address;
    const spenderTopic = log.topics?.[2];
    if (!spenderTopic) continue;

    const spenderAddr = ("0x" + spenderTopic.slice(26)) as Address;
    const key = `${tokenAddr}:${spenderAddr}`;
    if (pairsSeen.has(key)) continue;
    pairsSeen.add(key);
    pairs.push({ token: tokenAddr, spender: spenderAddr });
  }

  // Read current allowance for each pair and build records
  const CONCURRENCY = 8;
  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const batch = pairs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ token, spender }) => {
        const allowance = await readAllowance(client, token, wallet, spender);
        if (allowance === 0n) return null;

        // Resolve symbol
        let symbol = symbolCache.get(token.toLowerCase());
        if (!symbol) {
          symbol = await fetchSymbol(client, token);
          symbolCache.set(token.toLowerCase(), symbol);
        }

        const spenderLabel = lookupSpender(spender, chainKey);
        const risk = classifyRisk(allowance, spender, chainKey);

        const record: ApprovalRecord = {
          token,
          token_symbol: symbol,
          spender,
          spender_label: spenderLabel,
          allowance: formatAllowance(allowance),
          is_unlimited: allowance >= UNLIMITED_THRESHOLD,
          risk_level: risk,
          chain: chainKey,
        };

        return { record, allowance, token, spender, symbol, spenderLabel };
      })
    );

    for (const r of results) {
      if (r.status !== "fulfilled" || r.value === null) continue;
      const { record, token, spender, symbol, spenderLabel } = r.value;
      approvals.push(record);

      // Generate revoke tx for high/critical
      if (record.risk_level === "high" || record.risk_level === "critical") {
        revokeTxs.push(
          buildRevokeTx(token, spender, symbol, spenderLabel, chainKey)
        );
      }
    }
  }

  // ---- ERC-721 ApprovalForAll scanning (bonus) ----
  try {
    const nftLogs = await getApprovalForAllLogs(
      client,
      wallet,
      fromBlock,
      toBlock
    );

    // Deduplicate (contract, operator) pairs
    const nftPairsSeen = new Set<string>();
    const nftPairs: Array<{ contract: Address; operator: Address }> = [];

    for (const log of nftLogs) {
      const contractAddr = (log.address as string).toLowerCase() as Address;
      const operatorTopic = log.topics?.[2];
      if (!operatorTopic) continue;
      const operatorAddr = ("0x" + operatorTopic.slice(26)) as Address;
      const key = `${contractAddr}:${operatorAddr}`;
      if (nftPairsSeen.has(key)) continue;
      nftPairsSeen.add(key);
      nftPairs.push({ contract: contractAddr, operator: operatorAddr });
    }

    for (let i = 0; i < nftPairs.length; i += CONCURRENCY) {
      const batch = nftPairs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async ({ contract: nftContract, operator }) => {
          const approved = await readIsApprovedForAll(
            client,
            nftContract,
            wallet,
            operator
          );
          if (!approved) return null;

          const operatorLabel = lookupSpender(operator, chainKey);
          const risk: RiskLevel = isKnownSpender(operator, chainKey)
            ? "medium"
            : "critical";

          let symbol: string;
          try {
            symbol = await fetchSymbol(client, nftContract);
          } catch {
            symbol = "NFT";
          }

          const record: ApprovalRecord = {
            token: nftContract,
            token_symbol: `${symbol} (NFT)`,
            spender: operator,
            spender_label: operatorLabel,
            allowance: "APPROVAL_FOR_ALL",
            is_unlimited: true,
            risk_level: risk,
            chain: chainKey,
          };

          return { record, nftContract, operator, operatorLabel };
        })
      );

      for (const r of results) {
        if (r.status !== "fulfilled" || r.value === null) continue;
        const { record, nftContract, operator, operatorLabel } = r.value;
        approvals.push(record);

        if (record.risk_level === "high" || record.risk_level === "critical") {
          revokeTxs.push(
            buildRevokeAllTx(nftContract, operator, operatorLabel, chainKey)
          );
        }
      }
    }
  } catch {
    // NFT scan is best-effort
  }

  return { approvals, revokeTxs };
}

/* ================================================================== */
/*  Public Entry Point                                                */
/* ================================================================== */

export async function auditApprovals(input: AuditInput): Promise<AuditResult> {
  const wallet = normalizeAddress(input.wallet);
  const chains = input.chains.map((c) => c.toLowerCase().trim());

  const allApprovals: ApprovalRecord[] = [];
  const allRevokeTxs: RevokeTx[] = [];

  // Scan each requested chain concurrently
  const scanPromises = chains.map(async (chainKey) => {
    const config = CHAIN_CONFIGS[chainKey];
    if (!config) {
      console.warn(
        `[approval-auditor] Unknown chain "${chainKey}". Supported: ${Object.keys(CHAIN_CONFIGS).join(", ")}`
      );
      return null;
    }
    return scanChain(chainKey, wallet, config);
  });

  const results = await Promise.allSettled(scanPromises);

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      allApprovals.push(...r.value.approvals);
      allRevokeTxs.push(...r.value.revokeTxs);
    }
  }

  // Sort: critical first, then high, medium, low
  const riskOrder: Record<RiskLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  allApprovals.sort(
    (a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level]
  );

  return {
    wallet,
    total_approvals: allApprovals.length,
    critical_count: allApprovals.filter((a) => a.risk_level === "critical")
      .length,
    high_count: allApprovals.filter((a) => a.risk_level === "high").length,
    approvals: allApprovals,
    revoke_tx_data: allRevokeTxs,
  };
}
