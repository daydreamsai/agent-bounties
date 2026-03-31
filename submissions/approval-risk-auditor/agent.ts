/**
 * Approval Risk Auditor
 * 
 * Flags unlimited or stale ERC-20 / NFT approvals and builds revoke calls.
 * 
 * Inputs:
 *   - wallet: Wallet address to audit
 *   - chains: Chains to scan (e.g., ["ethereum", "polygon", "arbitrum"])
 * 
 * Returns:
 *   - approvals[]: List of all approvals found
 *   - risk_flags[]: Risk indicators for each approval
 *   - revoke_tx_data[]: Transaction data to revoke approvals
 * 
 * Acceptance Criteria:
 *   ✅ Matches Etherscan approval data for top tokens
 *   ✅ Identifies unlimited and stale approvals
 *   ✅ Provides valid revocation transaction data
 *   ✅ Must be deployed on a domain and reachable via x402
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls",
});

/**
 * Chain configurations with Etherscan-compatible API endpoints
 */
const CHAIN_CONFIG: Record<string, {
  id: number;
  rpc: string;
  explorerApi: string;
  explorerUrl: string;
  explorerName: string;
}> = {
  ethereum: {
    id: 1,
    rpc: "https://eth.llamarpc.com",
    explorerApi: "https://api.etherscan.io/api",
    explorerUrl: "https://etherscan.io",
    explorerName: "Etherscan",
  },
  polygon: {
    id: 137,
    rpc: "https://polygon-rpc.com",
    explorerApi: "https://api.polygonscan.com/api",
    explorerUrl: "https://polygonscan.com",
    explorerName: "Polygonscan",
  },
  arbitrum: {
    id: 42161,
    rpc: "https://arb1.arbitrum.io/rpc",
    explorerApi: "https://api.arbiscan.io/api",
    explorerUrl: "https://arbiscan.io",
    explorerName: "Arbiscan",
  },
  optimism: {
    id: 10,
    rpc: "https://mainnet.optimism.io",
    explorerApi: "https://api-optimistic.etherscan.io/api",
    explorerUrl: "https://optimistic.etherscan.io",
    explorerName: "Optimistic Etherscan",
  },
  base: {
    id: 8453,
    rpc: "https://mainnet.base.org",
    explorerApi: "https://api.basescan.org/api",
    explorerUrl: "https://basescan.org",
    explorerName: "Basescan",
  },
  avalanche: {
    id: 43114,
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    explorerApi: "https://api.snowtrace.io/api",
    explorerUrl: "https://snowtrace.io",
    explorerName: "Snowtrace",
  },
};

/**
 * Common token addresses on various chains
 */
const COMMON_TOKENS: Record<string, Record<string, {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}>> = {
  ethereum: {
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
    DAI: { address: "0x6B175474E89094C44Da98b954EescdeCB5BE3830", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", name: "Chainlink", decimals: 18 },
    UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", name: "Uniswap", decimals: 18 },
    AAVE: { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", name: "Aave", decimals: 18 },
  },
  polygon: {
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", name: "Tether USD", decimals: 6 },
    USDC: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", name: "USD Coin", decimals: 6 },
    DAI: { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
    WMATIC: { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC", name: "Wrapped Matic", decimals: 18 },
  },
  arbitrum: {
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", name: "Tether USD", decimals: 6 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 },
    ARB: { address: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", symbol: "ARB", name: "Arbitrum", decimals: 18 },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  },
  optimism: {
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58a58", symbol: "USDT", name: "Tether USD", decimals: 6 },
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", name: "USD Coin", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  },
  base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  },
  avalanche: {
    USDT: { address: "0x9702230A8Ea53601f5cD2b9bD3958bd4E6574F89", symbol: "USDT", name: "Tether USD", decimals: 6 },
    USDC: { address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", symbol: "USDC", name: "USD Coin", decimals: 6 },
    WAVAX: { address: "0xB31f66AA3C1e785363F0875A1B74D27e9627f3F8", symbol: "WAVAX", name: "Wrapped AVAX", decimals: 18 },
  },
};

// ERC-20 Approval event signature
const APPROVAL_EVENT_SIGNATURE = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const UNLIMITED_APPROVAL = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/**
 * Approval information
 */
interface Approval {
  token_address: string;
  token_symbol: string;
  token_name: string;
  token_decimals: number;
  chain: string;
  owner: string;
  spender: string;
  spender_name?: string;
  value: string;
  value_formatted: string;
  is_unlimited: boolean;
  block_number: number;
  tx_hash: string;
  timestamp: string;
  age_seconds: number;
  age_human: string;
}

/**
 * Risk flag information
 */
interface RiskFlag {
  approval: Approval;
  flags: string[];
  risk_score: number; // 0-100
  risk_level: "low" | "medium" | "high" | "critical";
  description: string;
}

/**
 * Revoke transaction data
 */
interface RevokeTxData {
  chain: string;
  token_address: string;
  token_symbol: string;
  spender: string;
  spender_name?: string;
  to: string; // contract address
  data: string; // calldata
  value: string; // 0 for ERC-20 revokes
  gas_estimate: string;
  revoke_type: "approve_0" | "increaseAllowance" | "safeDecreaseAllowance";
}

/**
 * Audit result
 */
interface AuditResult {
  wallet: string;
  chains: string[];
  scanned_at: string;
  approvals: Approval[];
  risk_flags: RiskFlag[];
  revoke_tx_data: RevokeTxData[];
  summary: {
    total_approvals: number;
    unlimited_approvals: number;
    stale_approvals: number;
    critical_risk: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
}

/**
 * Calculate risk score for an approval
 */
function calculateRiskScore(approval: Approval): { score: number; level: "low" | "medium" | "high" | "critical"; flags: string[]; description: string } {
  const flags: string[] = [];
  let score = 0;

  // Unlimited approval = critical
  if (approval.is_unlimited) {
    flags.push("UNLIMITED_APPROVAL");
    score += 50;
  }

  // Very old approval (>1 year)
  if (approval.age_seconds > 365 * 24 * 60 * 60) {
    flags.push("STALE_APPROVAL_YEAR");
    score += 25;
  } else if (approval.age_seconds > 180 * 24 * 60 * 60) {
    flags.push("STALE_APPROVAL_6MONTHS");
    score += 15;
  } else if (approval.age_seconds > 30 * 24 * 60 * 60) {
    flags.push("STALE_APPROVAL_MONTH");
    score += 5;
  }

  // High-value tokens
  const highValueTokens = ["USDT", "USDC", "DAI", "WETH"];
  if (highValueTokens.includes(approval.token_symbol)) {
    score += 10;
    flags.push("HIGH_VALUE_TOKEN");
  }

  // Known risky spender patterns
  const riskyPatterns = [
    { pattern: "0xdef1", name: "Unknown/Advanced Contract" },
    { pattern: "0x7a250", name: "Uniswap Router" },
    { pattern: "0xb4e1", name: "OpenSea" },
    { pattern: "0x5972", name: "Blur" },
    { pattern: "0x3d11", name: "LooksRare" },
  ];

  for (const risky of riskyPatterns) {
    if (approval.spender.toLowerCase().startsWith(risky.pattern.toLowerCase())) {
      flags.push(`RISKY_SPENDER_${risky.name.replace(/[^A-Z]/g, "_")}`);
      score += 5;
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine level
  let level: "low" | "medium" | "high" | "critical";
  if (score >= 80) level = "critical";
  else if (score >= 50) level = "high";
  else if (score >= 25) level = "medium";
  else level = "low";

  let description = `Approval for ${approval.token_symbol} to ${approval.spender_name || approval.spender.slice(0, 10) + "..."}`;
  if (flags.includes("UNLIMITED_APPROVAL")) {
    description = `CRITICAL: Unlimited ${approval.token_symbol} approval to ${approval.spender_name || approval.spender}. This allows the spender to transfer ALL your ${approval.token_symbol} at any time.`;
  } else if (flags.includes("STALE_APPROVAL_YEAR")) {
    description += ` (unused for over a year)`;
  }

  return { score, level, flags, description };
}

/**
 * Format timestamp to human readable
 */
function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 30 * 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 365 * 86400) return `${Math.floor(seconds / (30 * 86400))}mo`;
  return `${Math.floor(seconds / (365 * 86400))}y`;
}

/**
 * Get approvals from a specific chain using Etherscan-compatible API
 */
async function getApprovalsFromChain(
  wallet: string,
  chain: string,
  apiKey?: string
): Promise<Approval[]> {
  const approvals: Approval[] = [];
  
  const config = CHAIN_CONFIG[chain];
  if (!config) {
    console.warn(`Unknown chain: ${chain}`);
    return approvals;
  }

  const tokens = COMMON_TOKENS[chain] || {};
  const now = Math.floor(Date.now() / 1000);

  // For each known token, check approval
  for (const [symbol, token] of Object.entries(tokens)) {
    try {
      // Get approval events using the token contract
      // Using etherscan API to get logs
      const params = new URLSearchParams({
        module: "logs",
        action: "getLogs",
        fromBlock: "0",
        toBlock: "latest",
        address: token.address,
        topic0: APPROVAL_EVENT_SIGNATURE,
        topic1: `0x${wallet.slice(2).padStart(64, '0')}`,
        apikey: apiKey || "",
      });

      const response = await fetch(`${config.explorerApi}?${params}`);
      const data = await response.json();

      if (data.status === "1" && data.result) {
        for (const log of data.result) {
          // Parse approval event
          // topic1 = owner (wallet), topic2 = spender
          const spender = "0x" + log.topics[2].slice(26);
          const valueHex = log.data;
          
          // Parse the value - handle indexed vs non-indexed
          // For Approval(owner, spender, value) - value is not indexed
          const value = BigInt(valueHex);

          const isUnlimited = valueHex.toLowerCase() === "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
          
          const blockNumber = parseInt(log.blockNumber, 16);
          const txHash = log.transactionHash;
          
          // Get timestamp from block
          let timestamp = "";
          let ageSeconds = 0;
          try {
            const blockParams = new URLSearchParams({
              module: "block",
              action: "getblockreward",
              blockno: blockNumber.toString(),
              apikey: apiKey || "",
            });
            const blockResponse = await fetch(`${config.explorerApi}?${blockParams}`);
            const blockData = await blockResponse.json();
            if (blockData.result && blockData.result.timeStamp) {
              const blockTime = parseInt(blockData.result.timeStamp);
              timestamp = new Date(blockTime * 1000).toISOString();
              ageSeconds = now - blockTime;
            }
          } catch {
            ageSeconds = 0;
            timestamp = new Date().toISOString();
          }

          const valueFormatted = formatTokenValue(value, token.decimals);

          approvals.push({
            token_address: token.address,
            token_symbol: symbol,
            token_name: token.name,
            token_decimals: token.decimals,
            chain,
            owner: wallet,
            spender,
            spender_name: getSpenderName(spender),
            value: value.toString(),
            value_formatted: valueFormatted,
            is_unlimited: isUnlimited,
            block_number: blockNumber,
            tx_hash: txHash,
            timestamp,
            age_seconds: ageSeconds,
            age_human: formatAge(ageSeconds),
          });
        }
      }
    } catch (error) {
      console.warn(`Error checking ${symbol} on ${chain}:`, error);
    }
  }

  return approvals;
}

/**
 * Get spender name from known addresses
 */
function getSpenderName(spender: string): string | undefined {
  const knownSpenders: Record<string, string> = {
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
    "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc": "USDC-WETH Uniswap V2",
    "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852": "USDT-WETH Uniswap V2",
    "0x5c69bee701ef814a2b6a3edd4f165742ab973532": "Uniswap V2 Factory",
    "0xc36442b4a4522e871399cd717abdd847ab11fe88": "Uniswap V3 Positions NFT",
    "0xb4e1d4a50ce4052a56dac7e2b53e02d1505ad8d9": "Aave V2 Pool",
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "Aave V2 Pool",
    "0x87870bca3f3fd6335c3f4ce8392d5f3e4d4869cb": "Aave V3 Pool",
    "0x000000000022d473030f116dde9f6fca550c1293": "OpenSea Seaport",
    "0x495f947276749ce646f68ac8c248420045cb7b5e": "OpenSea Shared Storefront",
    "0x59728544b08ab483533076417fbbb2fd0b17ce3a": "LooksRare",
    "0x0000000000a39bb272e79075c8c55304d0000cc3c": "Blur",
    "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": "paraswap",
    "0x86c32787e1b6f7134d6f6e4d81ce41b84f69a089": "Metamask",
  };
  
  return knownSpenders[spender.toLowerCase()];
}

/**
 * Format token value based on decimals
 */
function formatTokenValue(value: bigint, decimals: number): string {
  if (value === BigInt(0)) return "0";
  
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  if (integerPart === BigInt(0)) {
    return `0.${fractionalPart.toString().padStart(decimals, '0').slice(0, 4)}`;
  }
  
  if (integerPart > BigInt(0)) {
    const fractional = fractionalPart.toString().padStart(decimals, '0').slice(0, 4);
    if (fractional === "0000") return integerPart.toString();
    return `${integerPart}.${fractional.replace(/0+$/, '')}`;
  }
  
  return value.toString();
}

/**
 * Generate revoke transaction data
 */
function generateRevokeTx(approval: Approval): RevokeTxData {
  // Standard revoke: approve(spender, 0)
  // Hex for approve(spender, 0) = 0x095ea7b3 + spender address (32 bytes) + 0 value (32 bytes)
  const spenderHex = approval.spender.slice(2).padStart(64, '0');
  const zeroHex = "0".repeat(64);
  
  // approve(address spender, uint256 value) = 0x095ea7b3
  const approveData = "0x095ea7b3" + spenderHex + zeroHex;

  return {
    chain: approval.chain,
    token_address: approval.token_address,
    token_symbol: approval.token_symbol,
    spender: approval.spender,
    spender_name: approval.spender_name,
    to: approval.token_address,
    data: approveData,
    value: "0",
    gas_estimate: "65000", // typical gas for approve
    revoke_type: "approve_0",
  };
}

/**
 * Main entrypoint for the Approval Risk Auditor
 */
addEntrypoint({
  key: "audit",
  description: "Audit a wallet for risky ERC-20 approvals",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit"),
    chains: z.array(z.string()).optional().describe("Chains to scan (default: ethereum, polygon, arbitrum)"),
    api_keys: z.record(z.string()).optional().describe("API keys for explorers (chain name -> key)"),
  }),
  async handler({ input }) {
    const { wallet, chains = ["ethereum", "polygon", "arbitrum"], api_keys } = input;

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return {
        output: {
          error: "Invalid wallet address format. Expected a valid Ethereum address.",
        },
        usage: { total_tokens: 0 },
      };
    }

    const now = new Date().toISOString();
    const allApprovals: Approval[] = [];
    const allRiskFlags: RiskFlag[] = [];
    const allRevokeTxs: RevokeTxData[] = [];

    // Scan each chain
    for (const chain of chains) {
      const approvals = await getApprovalsFromChain(wallet, chain, api_keys?.[chain]);
      allApprovals.push(...approvals);
    }

    // Calculate risk scores and generate revoke data
    for (const approval of allApprovals) {
      const risk = calculateRiskScore(approval);
      
      allRiskFlags.push({
        approval,
        flags: risk.flags,
        risk_score: risk.score,
        risk_level: risk.level,
        description: risk.description,
      });

      // Generate revoke tx for all approvals (users may want to revoke even low-risk ones)
      allRevokeTxs.push(generateRevokeTx(approval));
    }

    // Sort risk flags by score (highest first)
    allRiskFlags.sort((a, b) => b.risk_score - a.risk_score);

    // Calculate summary
    const summary = {
      total_approvals: allApprovals.length,
      unlimited_approvals: allApprovals.filter(a => a.is_unlimited).length,
      stale_approvals: allApprovals.filter(a => a.age_seconds > 180 * 24 * 60 * 60).length,
      critical_risk: allRiskFlags.filter(r => r.risk_level === "critical").length,
      high_risk: allRiskFlags.filter(r => r.risk_level === "high").length,
      medium_risk: allRiskFlags.filter(r => r.risk_level === "medium").length,
      low_risk: allRiskFlags.filter(r => r.risk_level === "low").length,
    };

    const result: AuditResult = {
      wallet,
      chains,
      scanned_at: now,
      approvals: allApprovals,
      risk_flags: allRiskFlags,
      revoke_tx_data: allRevokeTxs,
      summary,
    };

    return {
      output: result,
      usage: {
        total_tokens: JSON.stringify(result).length,
        chains_scanned: chains.length.toString(),
        approvals_found: allApprovals.length.toString(),
      },
    };
  },
});

export default app;
