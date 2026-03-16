/**
 * Approval Risk Auditor Agent
 *
 * Flags unlimited or stale ERC-20/NFT approvals and builds revoke calls.
 * Uses Etherscan event logs API (free, no key needed for basic queries).
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/5
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_UINT256_BIG = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
const UNLIMITED_THRESHOLD = MAX_UINT256_BIG / BigInt(1000);

// Known safe spender names
const KNOWN_SPENDERS: Record<string, string> = {
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch v5 Router",
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch v4 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap v3 Router2",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap v3 Router",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap v2 Router",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Universal Router",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0x1e0049783f008a0085193e00003d00cd54003c71": "OpenSea Conduit",
  "0x00000000006c3852cbef3e08e8df289169ede581": "OpenSea Seaport v1.1",
  "0x00000000000001ad428e4906ae43d8f9852d0dd6": "OpenSea Seaport v1.6",
  "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer v2 Vault",
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
};

// Known risky/deprecated spenders
const RISKY_SPENDERS: Record<string, string> = {
  "0x7f268357a8c2552623316e2562d90e642bb538e5": "OpenSea Wyvern v2 (deprecated)",
  "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": "OpenSea Wyvern v1 (very old)",
};

const EXPLORER_APIS: Record<string, string> = {
  ethereum: "https://api.etherscan.io/api",
  polygon: "https://api.polygonscan.com/api",
  bsc: "https://api.bscscan.com/api",
  arbitrum: "https://api.arbiscan.io/api",
  optimism: "https://api-optimistic.etherscan.io/api",
  base: "https://api.basescan.org/api",
  avalanche: "https://api.snowscan.xyz/api",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalEntry {
  token_address: string;
  token_type: "ERC20" | "ERC721";
  spender: string;
  spender_name: string;
  allowance: string;
  risk_flags: string[];
  risk_level: "safe" | "low" | "medium" | "high" | "critical";
  last_updated_date: string;
  is_unlimited: boolean;
  chain: string;
  revoke_tx_data: {
    to: string;
    data: string;
    description: string;
  };
}

// ─── ABI Encoding ─────────────────────────────────────────────────────────────

function encodeRevokeERC20(spender: string): string {
  // approve(address,uint256) with amount=0
  const selector = "095ea7b3";
  const paddedSpender = spender.slice(2).toLowerCase().padStart(64, "0");
  const paddedAmount = "0".padStart(64, "0");
  return `0x${selector}${paddedSpender}${paddedAmount}`;
}

function encodeRevokeERC721(operator: string): string {
  // setApprovalForAll(address,bool) with approved=false
  const selector = "a22cb465";
  const paddedOperator = operator.slice(2).toLowerCase().padStart(64, "0");
  const paddedFalse = "0".padStart(64, "0");
  return `0x${selector}${paddedOperator}${paddedFalse}`;
}

// ─── Approval Fetching ────────────────────────────────────────────────────────

async function fetchApprovals(wallet: string, chain: string): Promise<ApprovalEntry[]> {
  const baseUrl = EXPLORER_APIS[chain.toLowerCase()];
  if (!baseUrl) throw new Error(`Unsupported chain: ${chain}`);

  const walletPadded = `0x${wallet.slice(2).toLowerCase().padStart(64, "0")}`;

  // Approval(owner, spender, amount)
  const approvalTopic = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
  // ApprovalForAll(owner, operator, approved)
  const approvalForAllTopic = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31";

  const [erc20Res, nftRes] = await Promise.allSettled([
    fetch(
      `${baseUrl}?module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
      `&topic0=${approvalTopic}&topic1=${walletPadded}&topic0_1_opr=and&page=1&offset=100`,
      { signal: AbortSignal.timeout(10000) }
    ),
    fetch(
      `${baseUrl}?module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
      `&topic0=${approvalForAllTopic}&topic1=${walletPadded}&topic0_1_opr=and&page=1&offset=100`,
      { signal: AbortSignal.timeout(10000) }
    ),
  ]);

  const approvals: Map<string, ApprovalEntry> = new Map();
  const now = Date.now() / 1000;

  // Process ERC20 approvals
  if (erc20Res.status === "fulfilled" && erc20Res.value.ok) {
    const data = await erc20Res.value.json() as {
      result?: Array<{
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        timeStamp: string;
      }>;
    };
    for (const log of (data.result || [])) {
      try {
        const tokenAddr = log.address.toLowerCase();
        if (!log.topics[2]) continue;
        const spender = `0x${log.topics[2].slice(26).toLowerCase()}`;
        const allowanceBig = BigInt(log.data || "0x0");
        const key = `${tokenAddr}_${spender}`;

        // If allowance is 0, approval was revoked
        if (allowanceBig === BigInt(0)) {
          approvals.delete(key);
          continue;
        }

        const isUnlimited = allowanceBig >= UNLIMITED_THRESHOLD;
        const timestamp = parseInt(log.timeStamp, 16);
        const ageDays = (now - timestamp) / 86400;
        const spenderName = KNOWN_SPENDERS[spender] || RISKY_SPENDERS[spender] || "Unknown";

        const riskFlags: string[] = [];
        if (isUnlimited) riskFlags.push("UNLIMITED_ALLOWANCE");
        if (RISKY_SPENDERS[spender]) riskFlags.push(`RISKY_SPENDER: ${RISKY_SPENDERS[spender]}`);
        if (ageDays > 365) riskFlags.push("STALE_>1_YEAR");
        else if (ageDays > 90) riskFlags.push("STALE_>90_DAYS");

        let riskLevel: ApprovalEntry["risk_level"] = "safe";
        if (RISKY_SPENDERS[spender]) riskLevel = "critical";
        else if (isUnlimited && ageDays > 365) riskLevel = "high";
        else if (isUnlimited) riskLevel = "medium";
        else if (ageDays > 90) riskLevel = "low";

        approvals.set(key, {
          token_address: tokenAddr,
          token_type: "ERC20",
          spender,
          spender_name: spenderName,
          allowance: isUnlimited ? "UNLIMITED" : allowanceBig.toString(),
          risk_flags: riskFlags,
          risk_level: riskLevel,
          last_updated_date: new Date(timestamp * 1000).toISOString().split("T")[0],
          is_unlimited: isUnlimited,
          chain,
          revoke_tx_data: {
            to: tokenAddr,
            data: encodeRevokeERC20(spender),
            description: `Revoke ${spenderName} approval for ${tokenAddr}`,
          },
        });
      } catch {
        // Skip malformed log
      }
    }
  }

  // Process ERC721 ApprovalForAll events
  if (nftRes.status === "fulfilled" && nftRes.value.ok) {
    const data = await nftRes.value.json() as {
      result?: Array<{
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        timeStamp: string;
      }>;
    };
    for (const log of (data.result || [])) {
      try {
        const tokenAddr = log.address.toLowerCase();
        if (!log.topics[2]) continue;
        const operator = `0x${log.topics[2].slice(26).toLowerCase()}`;
        const approved = log.data !== "0x" + "0".padStart(64, "0");
        const key = `${tokenAddr}_${operator}_nft`;

        if (!approved) {
          approvals.delete(key);
          continue;
        }

        const timestamp = parseInt(log.timeStamp, 16);
        const ageDays = (now - timestamp) / 86400;
        const operatorName = KNOWN_SPENDERS[operator] || RISKY_SPENDERS[operator] || "Unknown";

        const riskFlags: string[] = ["NFT_APPROVAL_FOR_ALL"];
        if (RISKY_SPENDERS[operator]) riskFlags.push(`RISKY_OPERATOR: ${RISKY_SPENDERS[operator]}`);
        if (ageDays > 365) riskFlags.push("STALE_>1_YEAR");

        let riskLevel: ApprovalEntry["risk_level"] = "medium";
        if (RISKY_SPENDERS[operator]) riskLevel = "critical";
        else if (ageDays > 365) riskLevel = "high";

        approvals.set(key, {
          token_address: tokenAddr,
          token_type: "ERC721",
          spender: operator,
          spender_name: operatorName,
          allowance: "APPROVAL_FOR_ALL",
          risk_flags: riskFlags,
          risk_level: riskLevel,
          last_updated_date: new Date(timestamp * 1000).toISOString().split("T")[0],
          is_unlimited: true,
          chain,
          revoke_tx_data: {
            to: tokenAddr,
            data: encodeRevokeERC721(operator),
            description: `Revoke ApprovalForAll for ${operatorName} on ${tokenAddr}`,
          },
        });
      } catch {
        // Skip
      }
    }
  }

  return Array.from(approvals.values());
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "1.0.0",
  description: "Flags unlimited or stale ERC-20/NFT approvals and builds revocation transaction data. Supports 7 EVM chains.",
});

addEntrypoint({
  key: "audit_approvals",
  description: "Scan a wallet for risky ERC-20/NFT approvals. Returns risk flags, risk level, and ready-to-sign revoke transactions.",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit (0x...)"),
    chains: z
      .array(z.string())
      .default(["ethereum"])
      .describe("Chains to scan: ethereum, polygon, bsc, arbitrum, optimism, base, avalanche"),
    min_risk_level: z
      .enum(["safe", "low", "medium", "high", "critical"])
      .default("low")
      .describe("Minimum risk level to include in results"),
  }),
  async handler({ input }) {
    const { wallet, chains, min_risk_level } = input;
    const riskOrder: Record<string, number> = { safe: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const minRiskNum = riskOrder[min_risk_level] ?? 1;

    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      throw new Error("Invalid wallet address format (must be 0x + 40 hex chars)");
    }

    const allApprovals: ApprovalEntry[] = [];
    const errors: string[] = [];

    for (const chain of chains) {
      try {
        const chainApprovals = await fetchApprovals(wallet, chain);
        allApprovals.push(...chainApprovals);
      } catch (err) {
        errors.push(`${chain}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const filtered = allApprovals
      .filter((a) => (riskOrder[a.risk_level] ?? 0) >= minRiskNum)
      .sort((a, b) => (riskOrder[b.risk_level] ?? 0) - (riskOrder[a.risk_level] ?? 0));

    const summary = {
      total_found: allApprovals.length,
      flagged: filtered.length,
      critical: filtered.filter((a) => a.risk_level === "critical").length,
      high: filtered.filter((a) => a.risk_level === "high").length,
      medium: filtered.filter((a) => a.risk_level === "medium").length,
      low: filtered.filter((a) => a.risk_level === "low").length,
      unlimited_count: filtered.filter((a) => a.is_unlimited).length,
      nft_approvalforall: filtered.filter((a) => a.token_type === "ERC721").length,
    };

    return {
      output: {
        wallet,
        chains_scanned: chains,
        summary,
        approvals: filtered,
        revoke_tx_data: filtered.map((a) => a.revoke_tx_data),
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: String(filtered.length) },
    };
  },
});

addEntrypoint({
  key: "check_approval",
  description: "Check a specific token approval allowance between wallet and spender on-chain",
  input: z.object({
    wallet: z.string().describe("Wallet (owner) address"),
    token: z.string().describe("Token contract address"),
    spender: z.string().describe("Spender address to check"),
    chain: z.string().default("ethereum").describe("Chain: ethereum, polygon, bsc, etc."),
  }),
  async handler({ input }) {
    const { wallet, token, spender, chain } = input;
    const baseUrl = EXPLORER_APIS[chain.toLowerCase()];
    if (!baseUrl) throw new Error(`Unsupported chain: ${chain}`);

    const selector = "dd62ed3e"; // allowance(address,address)
    const paddedOwner = wallet.slice(2).toLowerCase().padStart(64, "0");
    const paddedSpender = spender.slice(2).toLowerCase().padStart(64, "0");
    const callData = `0x${selector}${paddedOwner}${paddedSpender}`;

    const res = await fetch(
      `${baseUrl}?module=proxy&action=eth_call&to=${token}&data=${callData}&tag=latest`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json() as { result?: string };
    const allowanceBig = BigInt(data.result || "0x0");
    const isUnlimited = allowanceBig >= UNLIMITED_THRESHOLD;
    const spenderName = KNOWN_SPENDERS[spender.toLowerCase()] || RISKY_SPENDERS[spender.toLowerCase()] || "Unknown";

    const riskFlags: string[] = [];
    if (isUnlimited) riskFlags.push("UNLIMITED_ALLOWANCE");
    if (RISKY_SPENDERS[spender.toLowerCase()]) riskFlags.push("RISKY_SPENDER");

    return {
      output: {
        wallet,
        token,
        spender,
        spender_name: spenderName,
        allowance: isUnlimited ? "UNLIMITED" : allowanceBig.toString(),
        is_unlimited: isUnlimited,
        risk_flags: riskFlags,
        revoke_tx_data: {
          to: token,
          data: encodeRevokeERC20(spender),
          description: `Revoke ${spenderName} approval`,
        },
        chain,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: "1" },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "approval-risk-auditor online") },
      usage: { total_tokens: "1" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8092");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Approval Risk Auditor running on http://0.0.0.0:${info.port}`);
});

export default app;
