/**
 * Approval scanner — fetches token transfers and approval events from
 * Etherscan-compatible APIs, then reconstructs current approval state.
 */

import { ChainConfig, getChain, getApiKey, CHAINS } from "./chains.js";
import { Approval, EtherscanTx, TOP_TOKENS } from "./types.js";

const ERC20_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const ERC721_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"; // Same topic
const ERC721_APPROVAL_FOR_ALL_TOPIC = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31";

/**
 * Fetch all token transfer transactions for a wallet on a chain
 */
async function fetchTokenTxs(
  chain: ChainConfig,
  wallet: string,
  action: "tokentx" | "tokennfttx" = "tokentx"
): Promise<EtherscanTx[]> {
  const apiKey = getApiKey(chain);
  if (!apiKey) return [];

  const url = `${chain.apiUrl}?module=account&action=${action}&address=${wallet}&sort=desc&offset=100&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "1" || !Array.isArray(data.result)) {
      return [];
    }
    return data.result as EtherscanTx[];
  } catch {
    return [];
  }
}

/**
 * Fetch approval event logs for a wallet from a token contract
 */
async function fetchApprovalLogs(
  chain: ChainConfig,
  tokenAddress: string,
  wallet: string
): Promise<any[]> {
  const apiKey = getApiKey(chain);
  if (!apiKey) return [];

  // Encode wallet address as padded topic
  const topic2 = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");

  const url =
    `${chain.apiUrl}?module=logs&action=getLogs` +
    `&address=${tokenAddress}` +
    `&topic0=${ERC20_APPROVAL_TOPIC}` +
    `&topic2=${topic2}` +
    `&topic0_2_opr=and` +
    `&sort=desc&offset=100&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data.result) ? data.result : [];
  } catch {
    return [];
  }
}

/**
 * Get the ERC-20 allowance on-chain for a wallet + token + spender
 * Uses a lightweight static call via public RPC
 */
async function fetchAllowance(
  chain: ChainConfig,
  tokenAddress: string,
  wallet: string,
  spender: string
): Promise<string> {
  // ERC-20 allowance function selector: 0xdd62ed3e
  // allowance(address owner, address spender)
  const data =
    "0xdd62ed3e" +
    "000000000000000000000000" + wallet.slice(2) +
    "000000000000000000000000" + spender.slice(2);

  const rpcUrl = chain.rpcUrl || "https://eth.merkle.io";
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      { to: tokenAddress, data },
      "latest",
    ],
  });

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const result = await res.json();
    if (result.result) {
      return BigInt(result.result).toString();
    }
  } catch {}
  return "0";
}

/**
 * Check if an approval amount represents "unlimited" (type(uint256).max)
 */
export function isUnlimitedApproval(amount: string): boolean {
  if (!amount) return false;
  const b = BigInt(amount);
  // Max uint256 is ~1.15e77, anything > 1e40 is effectively unlimited
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

  // Get token transfers to discover tokens held or traded
  const txs = await fetchTokenTxs(chain, wallet);

  // Extract unique token addresses
  const tokenAddresses = new Set<string>();
  for (const tx of txs) {
    if (tx.contractAddress && tx.contractAddress !== "0x") {
      tokenAddresses.add(tx.contractAddress.toLowerCase());
    }
  }

  // Also add top tokens for this chain
  const topForChain = TOP_TOKENS[chain.chainId] || [];
  for (const addr of topForChain) {
    tokenAddresses.add(addr.toLowerCase());
  }

  // Limit to top 30 tokens per chain (rate limit protection)
  const tokensToCheck = Array.from(tokenAddresses).slice(0, 30);

  // Build token metadata map
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

  // Fetch approval events and extract spender addresses per token
  for (const tokenAddr of tokensToCheck) {
    const logs = await fetchApprovalLogs(chain, tokenAddr, wallet);

    // Group by spender, take the latest event per spender
    const spenderMap = new Map<string, any>();
    for (const log of logs) {
      // topic1 = owner (wallet), topic2 = spender
      const topics = log.topics as string[];
      const spender = "0x" + topics[2].slice(26).toLowerCase();
      const amountHex = log.data;
      // Parse the amount
      const amount = BigInt(amountHex).toString();
      const spenderLower = spender.toLowerCase();

      // Only keep the latest event per spender
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

    // Also try NFT tokens
    const nftTxs = await fetchTokenTxs(chain, wallet, "tokennfttx");
    for (const tx of nftTxs) {
      const addr = tx.contractAddress?.toLowerCase();
      if (addr && !tokensToCheck.includes(addr) && tokenAddresses.size < 40) {
        // Check NFT approvals via isApprovedForAll for known marketplaces
        // For simplicity, we'll note it
      }
    }

    // Convert spender map to approvals
    for (const [, entry] of spenderMap) {
      const meta = tokenMeta.get(tokenAddr) || {
        name: "Unknown",
        symbol: "???",
        decimals: 18,
      };

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
