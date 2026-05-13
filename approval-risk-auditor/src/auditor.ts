/**
 * Approval auditor - fetches ERC-20 approvals from on-chain data.
 *
 * Uses a multi-strategy approach:
 * 1. Checks known popular tokens for approvals to common spenders
 * 2. Falls back to Etherscan-compatible API for comprehensive scanning
 * 3. Verifies spender contracts for risk assessment
 */

import type { ApprovalRecord } from "./approval-types.js";
import {
  MAX_UINT256,
  KNOWN_TOKENS,
  KNOWN_SPENDERS,
  RPC_ENDPOINTS,
} from "./approval-types.js";

// ERC-20 ABI fragments
const ERC20_ABI = [
  {
    type: "function" as const,
    name: "allowance",
    stateMutability: "view" as const,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function" as const,
    name: "symbol",
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function" as const,
    name: "name",
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function" as const,
    name: "balanceOf",
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Fetch ERC-20 approvals for a wallet across specified chains.
 */
export async function auditApprovals(
  wallet: `0x${string}`,
  chains: number[]
): Promise<ApprovalRecord[]> {
  const allApprovals: ApprovalRecord[] = [];

  // Process chains in parallel (limited concurrency)
  const chainResults = await Promise.allSettled(
    chains.map((chainId) => auditChain(wallet, chainId))
  );

  for (let i = 0; i < chainResults.length; i++) {
    const result = chainResults[i];
    if (result.status === "fulfilled" && result.value.length > 0) {
      allApprovals.push(...result.value);
    } else if (result.status === "rejected") {
      console.error(
        `[auditor] Failed to audit chain ${chains[i]}: ${result.reason?.message || result.reason}`
      );
    }
  }

  return allApprovals;
}

/**
 * Audit approvals on a single chain.
 */
async function auditChain(
  wallet: `0x${string}`,
  chainId: number
): Promise<ApprovalRecord[]> {
  const approvals: ApprovalRecord[] = [];
  const rpcUrl = RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    console.warn(`[auditor] No RPC endpoint for chain ${chainId}`);
    return approvals;
  }

  const tokens = KNOWN_TOKENS[chainId] || [];
  const spenders = KNOWN_SPENDERS[chainId] || [];

  if (tokens.length === 0 || spenders.length === 0) {
    // For chains without known tokens, try Etherscan API approach
    return auditViaEtherscan(wallet, chainId);
  }

  // Get current block number
  let currentBlock: number | undefined;
  try {
    const blockRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
    });
    const blockData = await blockRes.json();
    if (blockData.result) {
      currentBlock = parseInt(blockData.result, 16);
    }
  } catch (e) {
    console.warn(`[auditor] Could not get block number for chain ${chainId}: ${e}`);
  }

  // Check all token+spender combinations
  // Use batched JSON-RPC for efficiency
  const batchSize = 20;
  const calls: Array<{
    token: string;
    spender: string;
    id: number;
  }> = [];

  for (const token of tokens) {
    for (const spender of spenders) {
      calls.push({ token, spender, id: calls.length });
    }
  }

  // Process in batches
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    const rpcBatch = batch.map((call) => ({
      jsonrpc: "2.0" as const,
      method: "eth_call" as const,
      params: [
        {
          to: call.token,
          data: encodeAllowance(wallet, call.spender),
        },
        "latest",
      ],
      id: call.id + 1,
    }));

    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBatch),
      });

      if (!res.ok) continue;

      const results: Array<{ id: number; result?: string; error?: unknown }> =
        await res.json();

      for (const result of results) {
        if (result.error || !result.result) continue;

        const call = batch[result.id - 1];
        if (!call) continue;

        const allowance = result.result as string;

        // Skip zero allowances
        if (allowance === "0x" || allowance === "0x0") continue;

        const isUnlimited = allowance.toLowerCase() === MAX_UINT256.toLowerCase();

        // Get token info in a separate batch
        const tokenInfo = await fetchTokenInfo(rpcUrl, call.token);

        // Check if spender is a contract
        const spenderIsContract = await isContract(rpcUrl, call.spender);

        approvals.push({
          tokenAddress: call.token,
          tokenSymbol: tokenInfo.symbol,
          tokenName: tokenInfo.name,
          spender: call.spender,
          chainId,
          amount: allowance,
          isUnlimited,
          currentBlock,
          spenderIsContract,
          spenderHasCode: spenderIsContract,
          spenderIsVerified: KNOWN_SPENDERS[chainId]?.includes(call.spender) ?? false,
          MAX_UINT256,
          lastUpdatedBlock: undefined, // Would need Transfer/Approval events to determine
        });
      }
    } catch (e) {
      console.warn(`[auditor] Batch RPC call failed for chain ${chainId}: ${e}`);
    }
  }

  // Also try Etherscan for more comprehensive results
  try {
    const etherscanApprovals = await auditViaEtherscan(wallet, chainId);
    // Merge, avoiding duplicates
    for (const ea of etherscanApprovals) {
      const exists = approvals.some(
        (a) =>
          a.tokenAddress.toLowerCase() === ea.tokenAddress.toLowerCase() &&
          a.spender.toLowerCase() === ea.spender.toLowerCase()
      );
      if (!exists) {
        approvals.push(ea);
      }
    }
  } catch {
    // Etherscan may not be available for all chains - continue with RPC results
  }

  return approvals;
}

/**
 * Audit approvals using Etherscan-compatible API.
 */
async function auditViaEtherscan(
  wallet: string,
  chainId: number
): Promise<ApprovalRecord[]> {
  const approvals: ApprovalRecord[] = [];

  const etherscanUrls: Record<number, string> = {
    1: "https://api.etherscan.io/api",
    56: "https://api.bscscan.com/api",
    137: "https://api.polygonscan.com/api",
    42161: "https://api.arbiscan.io/api",
    10: "https://api-optimistic.etherscan.io/api",
    8453: "https://api.basescan.org/api",
    43114: "https://api.snowtrace.io/api",
  };

  const url = etherscanUrls[chainId];
  if (!url) return approvals;

  // Note: Etherscan API requires an API key for full functionality.
  // We use a demo-friendly approach with the tokenapprovalcheck endpoint.
  try {
    const params = new URLSearchParams({
      module: "account",
      action: "tokenapprovalcheck",
      address: wallet,
      startblock: "0",
      endblock: "999999999",
      page: "1",
      offset: "100",
      sort: "desc",
    });

    const res = await fetch(`${url}?${params}`);
    const data = await res.json();

    if (data.status === "1" && Array.isArray(data.result)) {
      for (const item of data.result) {
        const allowance = item.currentAllowance;
        if (!allowance || allowance === "0" || allowance === "0x0") continue;

        const isUnlimited =
          allowance.toLowerCase() === MAX_UINT256.toLowerCase();

        approvals.push({
          tokenAddress: item.tokenAddress || item.token_address || "",
          tokenSymbol: item.tokenSymbol || item.token_symbol,
          tokenName: item.tokenName || item.token_name,
          spender: item.spender,
          chainId,
          amount: allowance,
          isUnlimited,
          MAX_UINT256,
        });
      }
    }
  } catch (e) {
    console.warn(
      `[auditor] Etherscan API failed for chain ${chainId}: ${e}`
    );
  }

  return approvals;
}

/**
 * Fetch token symbol and name from an ERC-20 contract.
 */
async function fetchTokenInfo(
  rpcUrl: string,
  tokenAddress: string
): Promise<{ symbol?: string; name?: string }> {
  try {
    const batch = [
      {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          { to: tokenAddress, data: "0x95d89b41" }, // symbol()
          "latest",
        ],
        id: 1,
      },
      {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          { to: tokenAddress, data: "0x06fdde03" }, // name()
          "latest",
        ],
        id: 2,
      },
    ];

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });

    const results = await res.json();

    const decodeString = (hex: string): string => {
      try {
        // Remove 0x and offset/length prefix, decode ABI string
        const clean = hex.replace("0x", "");
        if (clean.length < 128) return "Unknown";
        const offset = parseInt(clean.substring(0, 64), 16);
        const length = parseInt(clean.substring(64, 128), 16);
        const start = offset * 2 + 64; // offset from data start
        const strHex = clean.substring(start, start + length * 2);
        let str = "";
        for (let i = 0; i < strHex.length; i += 2) {
          const code = parseInt(strHex.substring(i, i + 2), 16);
          if (code > 0) str += String.fromCharCode(code);
        }
        return str || "Unknown";
      } catch {
        return "Unknown";
      }
    };

    return {
      symbol: results[0]?.result ? decodeString(results[0].result) : undefined,
      name: results[1]?.result ? decodeString(results[1].result) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Check if an address is a contract by checking code size.
 */
async function isContract(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getCode",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    return (
      data.result &&
      data.result !== "0x" &&
      data.result !== "0x0" &&
      data.result.length > 2
    );
  } catch {
    return false;
  }
}

/**
 * Encode ERC-20 allowance(owner, spender) call data.
 */
function encodeAllowance(
  owner: `0x${string}`,
  spender: string
): string {
  // keccak256("allowance(address,address)") = 0xdd62ed3e
  // + padded owner address + padded spender address
  const ownerPadded = owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const spenderPadded = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  return `0xdd62ed3e${ownerPadded}${spenderPadded}`;
}
