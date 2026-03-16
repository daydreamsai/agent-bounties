/**
 * Smart Contract Risk Scorer Agent
 *
 * Analyze smart contracts for security vulnerabilities, rug pull indicators,
 * and malicious patterns across Ethereum and EVM-compatible chains.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/61
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical";
type SeverityLevel = "info" | "low" | "medium" | "high" | "critical";

interface Vulnerability {
  name: string;
  severity: SeverityLevel;
  description: string;
  evidence?: string;
}

interface SecurityChecks {
  is_honeypot: boolean;
  ownership_renounced: boolean;
  has_proxy: boolean;
  has_mint_function: boolean;
  has_blacklist: boolean;
  has_pausable: boolean;
  verified_source: boolean;
  has_timelock: boolean;
  has_multisig: boolean;
  transfer_cooldown: boolean;
  hidden_owner: boolean;
  can_take_back_ownership: boolean;
  trading_cooldown: boolean;
  is_anti_whale: boolean;
  sell_tax: number | null;
  buy_tax: number | null;
}

interface ExternalChecks {
  goplus_risk_score: number | null;
  goplus_honeypot: boolean | null;
  goplus_open_source: boolean | null;
  tokensniffer_score: number | null;
  etherscan_verified: boolean | null;
  etherscan_creator: string | null;
  goplus_raw: Record<string, unknown> | null;
}

interface ContractInfo {
  name: string | null;
  symbol: string | null;
  total_supply: string | null;
  decimals: number | null;
  creator_address: string | null;
  creation_block: number | null;
  contract_age_days: number | null;
  holder_count: number | null;
  top_holder_pct: number | null;
  is_token: boolean;
}

interface RiskScoreResult {
  contract_address: string;
  chain: string;
  risk_score: number;
  risk_level: RiskLevel;
  vulnerabilities: Vulnerability[];
  security_checks: SecurityChecks;
  external_checks: ExternalChecks;
  contract_info: ContractInfo;
  recommendations: string[];
  confidence: number;
  scan_depth: string;
  analyzed_at: string;
}

// ─── Chain Config ─────────────────────────────────────────────────────────────

const CHAIN_CONFIG: Record<string, { chainId: number; name: string; nativeToken: string }> = {
  ethereum: { chainId: 1, name: "Ethereum", nativeToken: "ETH" },
  polygon: { chainId: 137, name: "Polygon", nativeToken: "MATIC" },
  arbitrum: { chainId: 42161, name: "Arbitrum", nativeToken: "ETH" },
  optimism: { chainId: 10, name: "Optimism", nativeToken: "ETH" },
  base: { chainId: 8453, name: "Base", nativeToken: "ETH" },
  bsc: { chainId: 56, name: "BNB Smart Chain", nativeToken: "BNB" },
};

// Etherscan-compatible base URLs per chain
const ETHERSCAN_URLS: Record<string, string> = {
  ethereum: "https://api.etherscan.io",
  polygon: "https://api.polygonscan.com",
  arbitrum: "https://api.arbiscan.io",
  optimism: "https://api-optimistic.etherscan.io",
  base: "https://api.basescan.org",
  bsc: "https://api.bscscan.com",
};

// GoPlus chain IDs
const GOPLUS_CHAIN_IDS: Record<string, string> = {
  ethereum: "1",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  bsc: "56",
};

// ─── Malicious Bytecode Patterns ──────────────────────────────────────────────

const MALICIOUS_SOURCE_PATTERNS: Array<{ pattern: RegExp; name: string; severity: SeverityLevel; desc: string }> = [
  { pattern: /selfdestruct\s*\(/i, name: "Self-Destruct", severity: "critical", desc: "Contract can destroy itself, draining all funds" },
  { pattern: /delegatecall\s*\(/i, name: "Delegatecall", severity: "high", desc: "Proxy pattern that may execute arbitrary external code" },
  { pattern: /tx\.origin\s*==/i, name: "Tx.origin Auth", severity: "high", desc: "Uses tx.origin for authentication — phishing attack vector" },
  { pattern: /function\s+mint\s*\(/i, name: "Mint Function", severity: "medium", desc: "Owner can create new tokens, potentially inflating supply" },
  { pattern: /function\s+pause\s*\(/i, name: "Pausable", severity: "medium", desc: "Owner can pause all transfers" },
  { pattern: /blacklist|blocklist/i, name: "Blacklist", severity: "medium", desc: "Owner can block specific addresses from trading" },
  { pattern: /setFee\s*\(|setTax\s*\(/i, name: "Modifiable Fees", severity: "medium", desc: "Owner can change fees after deployment" },
  { pattern: /onlyOwner|Ownable/i, name: "Centralized Ownership", severity: "low", desc: "Functions restricted to owner — consider if owner is trustworthy" },
  { pattern: /revert\s*\(\s*\)/i, name: "Blanket Revert", severity: "low", desc: "Unconditional revert may prevent sells (honeypot indicator)" },
  { pattern: /transferFrom.*require.*false/i, name: "Transfer Block", severity: "critical", desc: "Transfer function may unconditionally fail (honeypot)" },
];

// ─── GoPlus Security API ──────────────────────────────────────────────────────

async function fetchGoPlus(address: string, chain: string): Promise<ExternalChecks> {
  const chainId = GOPLUS_CHAIN_IDS[chain] || "1";
  const result: ExternalChecks = {
    goplus_risk_score: null,
    goplus_honeypot: null,
    goplus_open_source: null,
    tokensniffer_score: null,
    etherscan_verified: null,
    etherscan_creator: null,
    goplus_raw: null,
  };

  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return result;

    const data = await res.json();
    const tokenData = data?.result?.[address.toLowerCase()];
    if (!tokenData) return result;

    result.goplus_raw = tokenData;
    result.goplus_honeypot = tokenData.is_honeypot === "1";
    result.goplus_open_source = tokenData.is_open_source === "1";

    // Build risk score from GoPlus flags
    let goplusScore = 0;
    const riskFlags = [
      "is_honeypot", "is_blacklisted", "cannot_sell_all", "transfer_pausable",
      "is_whitelisted", "hidden_owner", "can_take_back_ownership", "self_destruct",
      "external_call",
    ];
    for (const flag of riskFlags) {
      if (tokenData[flag] === "1") goplusScore += 15;
    }
    result.goplus_risk_score = Math.min(100, goplusScore);

    // Additional fields
    result.etherscan_creator = tokenData.creator_address || null;
  } catch {
    // API unavailable — proceed with heuristics only
  }

  return result;
}

// ─── Etherscan API ────────────────────────────────────────────────────────────

async function fetchEtherscanData(
  address: string,
  chain: string,
  apiKey?: string
): Promise<{ verified: boolean; sourceCode: string | null; abi: string | null; creator: string | null; creationBlock: number | null }> {
  const baseUrl = ETHERSCAN_URLS[chain] || ETHERSCAN_URLS.ethereum;
  const key = apiKey || "YourApiKeyToken"; // Free tier works with limited rate
  const result = { verified: false, sourceCode: null as string | null, abi: null as string | null, creator: null as string | null, creationBlock: null as number | null };

  try {
    // Fetch source code + verification status
    const srcRes = await fetch(
      `${baseUrl}/api?module=contract&action=getsourcecode&address=${address}&apikey=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (srcRes.ok) {
      const srcData = await srcRes.json();
      const info = srcData?.result?.[0];
      if (info && info.SourceCode !== "") {
        result.verified = true;
        result.sourceCode = info.SourceCode;
        result.abi = info.ABI;
      }
    }

    // Fetch creator address
    const txRes = await fetch(
      `${baseUrl}/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (txRes.ok) {
      const txData = await txRes.json();
      const creationInfo = txData?.result?.[0];
      if (creationInfo) {
        result.creator = creationInfo.contractCreator || null;
      }
    }
  } catch {
    // Etherscan unavailable
  }

  return result;
}

// ─── Ownership Analysis ───────────────────────────────────────────────────────

function analyzeOwnership(sourceCode: string | null, goplusData: Record<string, unknown> | null): {
  renounced: boolean;
  hasTimelock: boolean;
  hasMultisig: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
} {
  const result = {
    renounced: false,
    hasTimelock: false,
    hasMultisig: false,
    hiddenOwner: false,
    canTakeBackOwnership: false,
  };

  // Use GoPlus data if available
  if (goplusData) {
    result.hiddenOwner = goplusData.hidden_owner === "1";
    result.canTakeBackOwnership = goplusData.can_take_back_ownership === "1";
    if (goplusData.owner_address === "0x0000000000000000000000000000000000000000") {
      result.renounced = true;
    }
  }

  if (!sourceCode) return result;

  // Check for timelock patterns
  result.hasTimelock = /TimelockController|timelock|delay\s*>=\s*MIN_DELAY/i.test(sourceCode);

  // Check for multisig patterns
  result.hasMultisig = /Gnosis|MultiSig|multisig|threshold\s*>=\s*\d/i.test(sourceCode);

  // Check if ownership is renounced via renounceOwnership
  result.renounced = /renounceOwnership/i.test(sourceCode) || result.renounced;

  return result;
}

// ─── Source Code Analysis ─────────────────────────────────────────────────────

function analyzeSourceCode(sourceCode: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  for (const { pattern, name, severity, desc } of MALICIOUS_SOURCE_PATTERNS) {
    if (pattern.test(sourceCode)) {
      vulnerabilities.push({
        name,
        severity,
        description: desc,
        evidence: `Pattern matched in contract source`,
      });
    }
  }

  // Check for reentrancy vulnerability
  if (/\.call\s*\{.*value.*\}|\.transfer\s*\(|\.send\s*\(/i.test(sourceCode)) {
    if (!/(ReentrancyGuard|nonReentrant|mutex)/i.test(sourceCode)) {
      vulnerabilities.push({
        name: "Potential Reentrancy",
        severity: "high",
        description: "Contract sends ETH without reentrancy guard — may be vulnerable to reentrancy attacks",
      });
    }
  }

  // Check for integer overflow (pre-Solidity 0.8 without SafeMath)
  const solidityVersion = sourceCode.match(/pragma solidity\s+[\^~]?(\d+\.\d+)/)?.[1];
  if (solidityVersion) {
    const minor = parseFloat(solidityVersion);
    if (minor < 0.8 && !/(SafeMath|using SafeMath)/i.test(sourceCode)) {
      vulnerabilities.push({
        name: "Integer Overflow Risk",
        severity: "medium",
        description: `Solidity ${solidityVersion} without SafeMath library — may be vulnerable to integer overflow`,
      });
    }
  }

  // Check for unchecked return values
  if (/\.call\(/i.test(sourceCode) && !/require\s*\(.*\.call\(/i.test(sourceCode)) {
    vulnerabilities.push({
      name: "Unchecked Call Return",
      severity: "medium",
      description: "Low-level call() return value may not be checked — failed calls could be silently ignored",
    });
  }

  return vulnerabilities;
}

// ─── Security Checks Builder ──────────────────────────────────────────────────

function buildSecurityChecks(
  sourceCode: string | null,
  goplusRaw: Record<string, unknown> | null,
  ownershipAnalysis: ReturnType<typeof analyzeOwnership>
): SecurityChecks {
  const src = sourceCode || "";

  // Helper to extract GoPlus bool flag
  const gp = (key: string): boolean => goplusRaw?.[key] === "1";
  const gpNum = (key: string): number | null => {
    const v = goplusRaw?.[key];
    if (v === undefined || v === null) return null;
    return parseFloat(String(v));
  };

  return {
    is_honeypot: gp("is_honeypot"),
    ownership_renounced: ownershipAnalysis.renounced || gp("owner_address") === false,
    has_proxy: /Proxy|proxy|upgradeable|Upgradeable/i.test(src) || gp("is_proxy"),
    has_mint_function: /function\s+mint\s*\(/i.test(src) || gp("can_be_minted"),
    has_blacklist: /blacklist|blocklist/i.test(src) || gp("is_blacklisted"),
    has_pausable: /function\s+pause\s*\(/i.test(src) || gp("transfer_pausable"),
    verified_source: Boolean(sourceCode),
    has_timelock: ownershipAnalysis.hasTimelock,
    has_multisig: ownershipAnalysis.hasMultisig,
    transfer_cooldown: gp("trading_cooldown"),
    hidden_owner: ownershipAnalysis.hiddenOwner,
    can_take_back_ownership: ownershipAnalysis.canTakeBackOwnership,
    trading_cooldown: gp("trading_cooldown"),
    is_anti_whale: gp("is_anti_whale_modifiable"),
    sell_tax: gpNum("sell_tax"),
    buy_tax: gpNum("buy_tax"),
  };
}

// ─── Risk Score Calculator ────────────────────────────────────────────────────

function calculateRiskScore(
  vulnerabilities: Vulnerability[],
  securityChecks: SecurityChecks,
  externalChecks: ExternalChecks,
  contractInfo: ContractInfo
): { score: number; confidence: number } {
  let score = 0;
  let dataPoints = 0;

  // Vulnerability-based scoring
  for (const vuln of vulnerabilities) {
    switch (vuln.severity) {
      case "critical": score += 30; break;
      case "high": score += 20; break;
      case "medium": score += 10; break;
      case "low": score += 5; break;
    }
  }

  // Security check scoring
  if (securityChecks.is_honeypot) { score += 60; dataPoints++; }
  if (securityChecks.hidden_owner) { score += 30; dataPoints++; }
  if (securityChecks.can_take_back_ownership) { score += 25; dataPoints++; }
  if (securityChecks.has_mint_function && !securityChecks.ownership_renounced) { score += 15; dataPoints++; }
  if (securityChecks.has_blacklist) { score += 15; dataPoints++; }
  if (securityChecks.has_pausable) { score += 10; dataPoints++; }
  if (!securityChecks.verified_source) { score += 20; dataPoints++; }
  if (securityChecks.ownership_renounced) { score -= 10; dataPoints++; }
  if (securityChecks.has_timelock) { score -= 5; dataPoints++; }
  if (securityChecks.has_multisig) { score -= 5; dataPoints++; }
  if (securityChecks.sell_tax !== null && securityChecks.sell_tax > 10) { score += 20; dataPoints++; }
  if (securityChecks.buy_tax !== null && securityChecks.buy_tax > 10) { score += 10; dataPoints++; }

  // GoPlus risk score integration
  if (externalChecks.goplus_risk_score !== null) {
    score += externalChecks.goplus_risk_score * 0.3;
    dataPoints += 3;
  }
  if (externalChecks.goplus_honeypot === true) { score += 40; dataPoints++; }

  // Contract age — newer contracts are riskier
  if (contractInfo.contract_age_days !== null) {
    if (contractInfo.contract_age_days < 7) score += 20;
    else if (contractInfo.contract_age_days < 30) score += 10;
    dataPoints++;
  }

  // Concentration risk
  if (contractInfo.top_holder_pct !== null && contractInfo.top_holder_pct > 50) {
    score += 20;
    dataPoints++;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Confidence based on how many data sources we have
  const maxPoints = 15;
  const confidence = Math.min(0.95, 0.3 + (dataPoints / maxPoints) * 0.65);

  return { score: finalScore, confidence: Math.round(confidence * 100) / 100 };
}

// ─── Recommendations Generator ────────────────────────────────────────────────

function generateRecommendations(
  riskScore: number,
  vulnerabilities: Vulnerability[],
  securityChecks: SecurityChecks,
  externalChecks: ExternalChecks
): string[] {
  const recs: string[] = [];

  if (securityChecks.is_honeypot || (externalChecks.goplus_honeypot === true)) {
    recs.push("CRITICAL: This token appears to be a honeypot — DO NOT purchase. You will not be able to sell.");
  }

  if (securityChecks.hidden_owner) {
    recs.push("WARNING: Contract has a hidden owner — avoid, as the real owner can manipulate the contract.");
  }

  if (securityChecks.can_take_back_ownership) {
    recs.push("WARNING: Ownership can be reclaimed — even if renounced, control may be restored.");
  }

  if (!securityChecks.verified_source) {
    recs.push("Contract source code is NOT verified on the block explorer — you cannot audit the logic.");
  }

  if (securityChecks.has_mint_function && !securityChecks.ownership_renounced) {
    recs.push("Owner can mint unlimited tokens — watch for supply inflation that devalues your holdings.");
  }

  if (securityChecks.has_blacklist) {
    recs.push("Owner can blacklist wallet addresses — your address could be blocked from selling.");
  }

  if (securityChecks.sell_tax !== null && securityChecks.sell_tax > 10) {
    recs.push(`High sell tax (${securityChecks.sell_tax}%) detected — factor this into your exit strategy.`);
  }

  if (vulnerabilities.some((v) => v.name === "Potential Reentrancy")) {
    recs.push("Reentrancy vulnerability detected — interact with caution, especially for ETH-sending functions.");
  }

  if (riskScore >= 70) {
    recs.push("AVOID: Risk score is critically high. This contract shows multiple red flags associated with scams.");
  } else if (riskScore >= 50) {
    recs.push("HIGH RISK: Interact only after thorough manual review by a qualified smart contract auditor.");
  } else if (riskScore >= 30) {
    recs.push("MEDIUM RISK: Review the specific vulnerabilities before investing significant capital.");
  } else {
    recs.push("Lower risk detected — standard precautions apply. Always verify contract behavior independently.");
  }

  recs.push("Use tools like Tenderly, DeFi Safety, or a manual audit before investing significant funds.");

  return recs;
}

// ─── Main Analysis Orchestrator ───────────────────────────────────────────────

async function analyzeContract(
  contractAddress: string,
  chain: string,
  scanDepth: "quick" | "deep"
): Promise<RiskScoreResult> {
  const address = contractAddress.toLowerCase();
  const now = new Date().toISOString();

  // Run parallel data fetches
  const [goplusData, etherscanData] = await Promise.all([
    fetchGoPlus(address, chain),
    fetchEtherscanData(address, chain),
  ]);

  // Merge creator from both sources
  const creator = goplusData.etherscan_creator || etherscanData.creator;
  if (etherscanData.verified !== undefined) {
    goplusData.etherscan_verified = etherscanData.verified;
    goplusData.etherscan_creator = creator;
  }

  // Analyze source code if available and deep scan
  let vulnerabilities: Vulnerability[] = [];
  if (etherscanData.sourceCode && (scanDepth === "deep" || etherscanData.sourceCode.length < 50000)) {
    vulnerabilities = analyzeSourceCode(etherscanData.sourceCode);
  }

  // Ownership analysis
  const ownershipAnalysis = analyzeOwnership(etherscanData.sourceCode, goplusData.goplus_raw);

  // Build security checks
  const securityChecks = buildSecurityChecks(
    etherscanData.sourceCode,
    goplusData.goplus_raw,
    ownershipAnalysis
  );

  // Contract info from GoPlus
  const goplusRaw = goplusData.goplus_raw || {};
  const contractInfo: ContractInfo = {
    name: String(goplusRaw.token_name || "Unknown"),
    symbol: String(goplusRaw.token_symbol || "?"),
    total_supply: String(goplusRaw.total_supply || "Unknown"),
    decimals: goplusRaw.decimals !== undefined ? parseInt(String(goplusRaw.decimals)) : null,
    creator_address: creator,
    creation_block: null,
    contract_age_days: null,
    holder_count: goplusRaw.holder_count !== undefined ? parseInt(String(goplusRaw.holder_count)) : null,
    top_holder_pct: goplusRaw.holders
      ? (() => {
          const holders = goplusRaw.holders as Array<{ percent: string }>;
          if (Array.isArray(holders) && holders.length > 0) {
            return parseFloat(holders[0]?.percent || "0") * 100;
          }
          return null;
        })()
      : null,
    is_token: Boolean(goplusRaw.token_name),
  };

  // Calculate risk score
  const { score, confidence } = calculateRiskScore(
    vulnerabilities,
    securityChecks,
    goplusData,
    contractInfo
  );

  // Determine risk level
  let riskLevel: RiskLevel = "low";
  if (score >= 70) riskLevel = "critical";
  else if (score >= 50) riskLevel = "high";
  else if (score >= 30) riskLevel = "medium";

  // Generate recommendations
  const recommendations = generateRecommendations(score, vulnerabilities, securityChecks, goplusData);

  return {
    contract_address: contractAddress,
    chain,
    risk_score: score,
    risk_level: riskLevel,
    vulnerabilities,
    security_checks: securityChecks,
    external_checks: goplusData,
    contract_info: contractInfo,
    recommendations,
    confidence,
    scan_depth: scanDepth,
    analyzed_at: now,
  };
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "smart-contract-risk-scorer",
  version: "1.0.0",
  description:
    "Analyze smart contracts for security vulnerabilities, rug pull indicators, and malicious patterns. Multi-source verification via GoPlus and Etherscan APIs.",
});

addEntrypoint({
  key: "analyze_contract",
  description:
    "Perform a comprehensive security analysis of a smart contract. Returns risk score (0-100), vulnerability list, honeypot detection, ownership analysis, and actionable recommendations.",
  input: z.object({
    contract_address: z
      .string()
      .describe("Smart contract address to analyze (0x...)"),
    chain: z
      .enum(["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"])
      .default("ethereum")
      .describe("Blockchain network"),
    scan_depth: z
      .enum(["quick", "deep"])
      .default("quick")
      .describe("quick = fast scan (GoPlus + basic checks); deep = full source code analysis"),
  }),
  async handler({ input }) {
    const { contract_address, chain, scan_depth } = input;

    if (!contract_address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        output: {
          error: "Invalid contract address. Must be a 42-character hex address starting with 0x.",
          contract_address,
        },
        usage: { total_tokens: "0" },
      };
    }

    const result = await analyzeContract(contract_address, chain || "ethereum", scan_depth || "quick");

    return {
      output: result,
      usage: { total_tokens: String(result.vulnerabilities.length + result.recommendations.length) },
    };
  },
});

addEntrypoint({
  key: "batch_analyze",
  description: "Analyze multiple smart contracts at once. Returns risk scores for all provided addresses.",
  input: z.object({
    contracts: z
      .array(
        z.object({
          contract_address: z.string(),
          chain: z.enum(["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"]).default("ethereum"),
        })
      )
      .max(10)
      .describe("List of contracts to analyze (max 10)"),
    scan_depth: z
      .enum(["quick", "deep"])
      .default("quick")
      .describe("Scan depth for all contracts"),
  }),
  async handler({ input }) {
    const { contracts, scan_depth } = input;

    const results = await Promise.allSettled(
      contracts.map((c) =>
        analyzeContract(c.contract_address, c.chain || "ethereum", scan_depth || "quick")
      )
    );

    const output = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        contract_address: contracts[i].contract_address,
        chain: contracts[i].chain,
        error: String(r.reason),
        risk_score: null,
      };
    });

    // Sort by risk score descending
    output.sort((a, b) => {
      const scoreA = "risk_score" in a ? (a.risk_score ?? 0) : 0;
      const scoreB = "risk_score" in b ? (b.risk_score ?? 0) : 0;
      return scoreB - scoreA;
    });

    return {
      output: {
        contracts_analyzed: contracts.length,
        results: output,
        highest_risk: output[0]?.contract_address || null,
      },
      usage: { total_tokens: String(contracts.length) },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "smart-contract-risk-scorer online") },
      usage: { total_tokens: "1" },
    };
  },
});

// ─── Server ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8087");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Smart Contract Risk Scorer running on http://0.0.0.0:${info.port}`);
});

export default app;
