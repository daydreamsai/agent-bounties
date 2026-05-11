/**
 * Approval scanner — fetches token transfers and approval events from
 * Etherscan-compatible APIs, then reconstructs current approval state.
 *
 * v0.2.1 — Fixed: Topic1/2 swap, added rate limiting, pagination, timeouts.
 */

import { ChainConfig, getChain, getApiKey, CHAINS } from "./chains.js";
import { Approval, EtherscanTx, TOP_TOKENS } from "./types.js";

const ERC20_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const MAX_TOKENS_PER_CHAIN = 30;
const TOKEN_TX_PAGE_SIZE = 500;
const LOGS_PAGE_SIZE = 100;

// Rate limiter: max N calls per second per API key
class RateLimiter {
  private lastCall = 0;
  private minInterval: number;
  constructor(callsPerSec: number) { this.minInterval = 1000 / callsPerSec; }
  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.lastCall + this.minInterval - now);
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    this.lastCall = Date.now();
  }
}

const rl = new RateLimiter(4); // 4 calls/sec (Etherscan free tier = 5/sec)

async function rateLimitedFetch(url: string, timeoutMs = 8000): Promise<Response> {
  await rl.wait();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch ERC-20 token transfers with pagination.
 * Etherscan returns max 10,000 results per page; we page through up to 3 pages.
 */
async function fetchTokenTxs(
  chain: ChainConfig,
  wallet: string
): Promise<EtherscanTx[]> {
  const apiKey = getApiKey(chain);
  if (!apiKey) return [];

  const allTxs: EtherscanTx[] = [];
  let page = 1;
  const MAX_PAGES = 3; // up to 1,500 txs

  while (page <= MAX_PAGES) {
    const url = `${chain.apiUrl}?module=account&action=tokentx`
      + `&address=${wallet}&page=${page}&offset=${TOKEN_TX_PAGE_SIZE}`
      + `&sort=desc&apikey=${apiKey}`;

    try {
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      if (data.status !== "1" || !Array.isArray(data.result)) break;
      const pageTxs = data.result as EtherscanTx[];
      allTxs.push(...pageTxs);
      if (pageTxs.length < TOKEN_TX_PAGE_SIZE) break; // last page
      page++;
    } catch {
      break;
    }
  }
  return allTxs;
}

/**
 * Fetch Approval event logs for a wallet as OWNER from a token contract.
 *
 * ERC-20 Approval(address indexed owner, address indexed spender, uint256 value)
 * topic0 = Approval event signature
 * topic1 = owner (the wallet being audited)
 * topic2 = spender
 */
async function fetchApprovalLogs(
  chain: ChainConfig,
  tokenAddress: string,
  wallet: string
): Promise<any[]> {
  const apiKey = getApiKey(chain);
  if (!apiKey) return [];

  // Encode wallet as topic1 (owner position)
  const topic1Owner = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");

  const url =
    `${chain.apiUrl}?module=logs&action=getLogs` +
    `&address=${tokenAddress}` +
    `&topic0=${ERC20_APPROVAL_TOPIC}` +
    `&topic1=${topic1Owner}` +
    `&topic0_1_opr=and` +
    `&offset=${LOGS_PAGE_SIZE}&apikey=${apiKey}`;

  try {
    const res = await rateLimitedFetch(url);
    const data = await res.json();
    return Array.isArray(data.result) ? data.result : [];
  } catch {
    return [];
  }
}

/**
 * Check if an approval amount represents "unlimited" (type(uint256).max)
 */
export function isUnlimitedApproval(amount: string): boolean {
  if (!amount) return false;
  const b = BigInt(amount);
  return b > BigInt(10) ** BigInt(40);
}

/**
 * Scan a wallet's approvals on a specific chain
 */
export async function scanChain(
  chain: ChainConfig,
  wallet: string
): Promise<Approval[]> {
  const approvals: Approval[] = [];
  const chainKey = Object.entries(CHAINS).find(
    ([, c]) => c.name === chain.name
  )?.[0] || chain.name;

  // 1. Get token transfers to discover tokens held/traded
  const txs = await fetchTokenTxs(chain, wallet);

  // 2. Extract unique token addresses
  const tokenAddresses = new Set<string>();
  for (const tx of txs) {
    if (tx.contractAddress && tx.contractAddress !== "0x") {
      tokenAddresses.add(tx.contractAddress.toLowerCase());
    }
  }

  // 3. Also add top tokens for this chain (always check critical ones)
  const topForChain = TOP_TOKENS[chain.chainId] || [];
  for (const addr of topForChain) {
    tokenAddresses.add(addr.toLowerCase());
  }

  const tokensToCheck = Array.from(tokenAddresses).slice(0, MAX_TOKENS_PER_CHAIN);

  // 4. Build token metadata map from transfer history
  const tokenMeta = new Map<string, { name: string; symbol: string; decimals: number }>();
  for (const tx of txs) {
    const addr = tx.contractAddress?.toLowerCase();
    if (addr && tokenAddresses.has(addr)) {
      tokenMeta.set(addr, {
        name: tx.tokenName || "Unknown",
        symbol: tx.tokenSymbol || "???",
        decimals: parseInt(tx.tokenDecimal || "18"),
      });
    }
  }

  // 5. Fetch approval logs per token, extract spenders per owner
  for (const tokenAddr of tokensToCheck) {
    const logs = await fetchApprovalLogs(chain, tokenAddr, wallet);

    // Group by spender, keep latest event per spender
    const spenderMap = new Map<string, any>();
    for (const log of logs) {
      const topics = log.topics as string[];
      // topic1 = owner, topic2 = spender
      const spender = "0x" + topics[2].slice(26).toLowerCase();
      const amountHex = log.data || "0x0";
      const amount = BigInt(amountHex).toString();
      const spenderLower = spender.toLowerCase();

      if (!spenderMap.has(spenderLower) ||
          BigInt(log.blockNumber || "0") > BigInt(spenderMap.get(spenderLower).blockNumber || "0")) {
        spenderMap.set(spenderLower, {
          spender: spenderLower,
          amount,
          blockNumber: log.blockNumber || "0",
          timestamp: log.timeStamp || "0",
          txHash: log.transactionHash || "",
        });
      }
    }

    const meta = tokenMeta.get(tokenAddr) || {
      name: "Unknown Token",
      symbol: "???",
      decimals: 18,
    };

    // Convert spender map to approvals
    for (const [, entry] of spenderMap) {
      // Skip zero-value approvals (these are revocations)
      if (entry.amount === "0" || BigInt(entry.amount) === BigInt(0)) continue;

      approvals.push({
        tokenAddress: tokenAddr,
        tokenName: meta.name,
        tokenSymbol: meta.symbol,
        tokenDecimals: meta.decimals,
        tokenType: "ERC20",
        spender: entry.spender,
        amount: entry.amount,
        isUnlimited: isUnlimitedApproval(entry.amount),
        blockNumber: parseInt(entry.blockNumber),
        timestamp: parseInt(entry.timestamp),
        txHash: entry.txHash,
        chain: chainKey,
        chainId: chain.chainId,
      });
    }
  }

  return approvals;
}
