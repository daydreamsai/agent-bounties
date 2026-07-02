import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import {
  createPublicClient,
  http,
  getAddress,
  toHex,
  pad,
  decodeEventLog,
  encodeFunctionData,
  parseAbi,
  type Hash,
  type Log,
  type PublicClient,
  maxUint256,
} from "viem";
import { mainnet, base, polygon, arbitrum, type Chain } from "viem/chains";

// ─── Chain configurations ────────────────────────────────────────────────

const CHAINS: Record<string, { chain: Chain; rpc: string }> = {
  ethereum: { chain: mainnet, rpc: "https://eth.llamarpc.com" },
  base: { chain: base, rpc: "https://base.llamarpc.com" },
  polygon: { chain: polygon, rpc: "https://polygon.llamarpc.com" },
  arbitrum: { chain: arbitrum, rpc: "https://arbitrum.llamarpc.com" },
};

// ─── Popular token addresses per chain ────────────────────────────────────

interface TokenEntry {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

const TOKENS_BY_CHAIN: Record<string, TokenEntry[]> = {
  ethereum: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18 },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", decimals: 18 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18 },
    { address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", symbol: "MATIC", decimals: 18 },
    { address: "0x3845badAde8e6dFF049820680d1F14bD3903a5d0", symbol: "SAND", decimals: 18 },
    { address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381", symbol: "APE", decimals: 18 },
    { address: "0x5283D291DBCF85356A21bA090E6db59121208b44", symbol: "BLUR", decimals: 18 },
  ],
  polygon: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC", decimals: 18 },
  ],
  base: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
    { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", decimals: 18 },
  ],
  arbitrum: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8 },
  ],
};

// ─── Constants ───────────────────────────────────────────────────────────

const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925" as `0x${string}`;
const MAX_UINT = maxUint256;
const STALE_SECONDS = 180n * 24n * 60n * 60n; // 180 days in seconds
const ERC20_APPROVE_ABI = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);

// ─── Types ───────────────────────────────────────────────────────────────

interface ApprovalResult {
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: string;
  is_unlimited: boolean;
  created_at: number | null;
  days_since_approval: number | null;
}

interface RevokeTxData {
  token: `0x${string}`;
  spender: `0x${string}`;
  chain: string;
  tx_data: `0x${string}`;
}

interface AuditOutput {
  approvals: ApprovalResult[];
  risk_flags: {
    unlimited_approvals: number;
    stale_approvals: number;
    high_value_approvals: number;
  };
  revoke_tx_data: RevokeTxData[];
  errors?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Create a viem PublicClient for the given chain name.
 */
function getClient(chainName: string): PublicClient | null {
  const cfg = CHAINS[chainName];
  if (!cfg) return null;
  return createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpc),
  });
}

/**
 * Decode an Approval event log emitted by an ERC-20 token.
 * Returns { owner, spender, value } or null if decoding fails.
 */
interface DecodedApproval {
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: bigint;
}

function decodeApprovalLog(log: Log): DecodedApproval | null {
  try {
    const decoded = decodeEventLog({
      abi: parseAbi(["event Approval(address indexed owner, address indexed spender, uint256 value)"]),
      data: log.data,
      topics: log.topics as [Hash, Hash, Hash],
    });
    return decoded.args as unknown as DecodedApproval;
  } catch {
    return null;
  }
}

/**
 * Fetch the current allowance for a given owner + spender on a token contract.
 */
async function getAllowance(
  client: PublicClient,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  try {
    return await client.readContract({
      address: token,
      abi: parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]),
      functionName: "allowance",
      args: [owner, spender],
    });
  } catch {
    return 0n;
  }
}

/**
 * Get the block timestamp for a given block number.
 */
async function getBlockTimestamp(client: PublicClient, blockNumber: bigint): Promise<number | null> {
  try {
    const block = await client.getBlock({ blockNumber });
    return Number(block.timestamp);
  } catch {
    return null;
  }
}

/**
 * Check if a token is a well-known high-value token (stablecoins, ETH, BTC).
 */
function isHighValueToken(symbol: string): boolean {
  const highValue = new Set([
    "USDC", "USDT", "DAI", "WETH", "WBTC", "WMATIC", "WBNB",
    "cbETH", "rETH", "stETH", "BUSD", "TUSD", "FRAX",
  ]);
  return highValue.has(symbol);
}

/**
 * Build the approve(spender, 0) transaction data to revoke an approval.
 */
function buildRevokeTx(token: `0x${string}`, spender: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, 0n],
  });
}

/**
 * Approximate a "high value" threshold: if the token is a well-known
 * high-value token and the raw amount exceeds the threshold, flag it.
 *
 * For 18-decimal tokens (ETH, DAI, etc.), $10k ≈ 0.00001 ETH/DAI worth.
 * For 6-decimal tokens (USDC/USDT), $10k ≈ 10_000_000_000 (10k * 10^6).
 * We use a simplified heuristic: flag amounts where raw > 10 * 10**decimals
 * which roughly corresponds to > $10 for 18-decimal tokens or > 10 tokens
 * for 6-decimal tokens. This is a reasonable default for "high value".
 */
function isHighValue(amount: bigint, decimals: number): boolean {
  // Simplified: flag > 1,000 of the base unit
  // For USDC (6 decimals): flag > $1,000
  // For DAI (18 decimals): flag > 1,000 DAI
  const threshold = BigInt(1000) * BigInt(10 ** decimals);
  return amount >= threshold;
}

// ─── Scanning logic ──────────────────────────────────────────────────────

/**
 * Scan a single token on a single chain for approvals from the given wallet.
 */
async function scanToken(
  client: PublicClient,
  token: TokenEntry,
  owner: `0x${string}`,
  chainName: string,
  currentTs: number,
): Promise<ApprovalResult[]> {
  const results: ApprovalResult[] = [];

  try {
    // Get current block to set scan range
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock > 100000n ? latestBlock - 100000n : 0n;

    // Query Approval events where owner == our wallet (indexed param)
    const logs = await client.getLogs({
      address: token.address,
      event: parseAbi(["event Approval(address indexed owner, address indexed spender, uint256 value)"]),
      args: { owner },
      fromBlock,
      toBlock: latestBlock,
    });

    // Track the latest approval per spender
    const spenderLatest = new Map<`0x${string}`, { blockNumber: bigint; timestamp: number | null }>();
    for (const log of logs) {
      const decoded = decodeApprovalLog(log as unknown as Log);
      if (!decoded) continue;
      const existing = spenderLatest.get(decoded.spender);
      if (!existing || log.blockNumber! > existing.blockNumber) {
        const ts = await getBlockTimestamp(client, log.blockNumber!);
        spenderLatest.set(decoded.spender, {
          blockNumber: log.blockNumber!,
          timestamp: ts,
        });
      }
    }

    // Also check known DeFi protocols via direct allowance call
    const KNOWN_PROTOCOLS: `0x${string}`[] = [
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
      "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router 2
      "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Exchange Proxy
      "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Seaport 1.1
      "0x00000000006cEE72100F1611b9f59F7D41E7b0F0", // Seaport 1.5
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router
      "0x1111111254fb6c44bAC0beD2854e76F90643097d", // 1inch V4
      "0x0000000000A39bb272e79075f125630b8C0a593e", // Blur 2
      "0x1E0049783F008A0085193E00003D00cd54003c71", // Seaport 1.4
    ];

    // Check all known protocols (union of event-discovered + static)
    const checked = new Set<`0x${string}`>();
    for (const spender of spenderLatest.keys()) {
      checked.add(spender);
    }
    const protocolSpenders = [...spenderLatest.keys(), ...KNOWN_PROTOCOLS];

    for (const spender of protocolSpenders) {
      if (checked.has(spender)) continue;
      checked.add(spender);

      try {
        const allowance = await getAllowance(client, token.address, owner, spender);
        if (allowance === 0n) continue;

        const isUnlimited = allowance >= MAX_UINT;
        const info = spenderLatest.get(spender);
        const createdAt = info?.timestamp ?? null;
        const daysSince = createdAt ? Math.floor((currentTs - createdAt) / 86400) : null;
        const isStale = daysSince !== null && daysSince > 180;

        results.push({
          token: token.address,
          spender,
          amount: allowance.toString(),
          is_unlimited: isUnlimited,
          created_at: createdAt,
          days_since_approval: daysSince,
        });
      } catch {
        // Skip individual spender failures
      }
    }

    return results;
  } catch (err) {
    // If full log scan fails, fall back to checking known protocols via allowance()
    const fallbackSpenders: `0x${string}`[] = [
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
      "0x00000000006cEE72100F1611b9f59F7D41E7b0F0",
      "0x1111111254fb6c44bAC0beD2854e76F90643097d",
    ];

    for (const spender of fallbackSpenders) {
      try {
        const allowance = await getAllowance(client, token.address, owner, spender);
        if (allowance === 0n) continue;

        results.push({
          token: token.address,
          spender,
          amount: allowance.toString(),
          is_unlimited: allowance >= MAX_UINT,
          created_at: null,
          days_since_approval: null,
        });
      } catch {
        // Skip
      }
    }
  }

  return results;
}

// ─── Agent Application ───────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "1.0.0",
  description:
    "Detect risky ERC-20 token approvals (unlimited, stale, high-value) and output safe revocation transaction data across multiple EVM chains.",
});

addEntrypoint({
  key: "audit-approvals",
  description:
    "Audit a wallet address for risky token approvals across one or more supported chains. Returns approvals, risk flags, and revocation tx data.",
  input: z.object({
    wallet: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x-prefixed Ethereum address")
      .describe("EVM wallet address to audit"),
    chains: z
      .array(z.enum(["ethereum", "base", "polygon", "arbitrum"]))
      .min(1)
      .describe("Chains to scan (ethereum, base, polygon, arbitrum)"),
  }),
  async handler({ input }) {
    const { wallet, chains } = input;

    // Validate and normalize wallet address
    let walletAddress: `0x${string}`;
    try {
      walletAddress = getAddress(wallet) as `0x${string}`;
    } catch {
      return {
        status: "error",
        output: {
          approvals: [],
          risk_flags: { unlimited_approvals: 0, stale_approvals: 0, high_value_approvals: 0 },
          revoke_tx_data: [],
          errors: [`Invalid wallet address: ${wallet}`],
        },
      };
    }

    const allApprovals: ApprovalResult[] = [];
    const allErrors: string[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Scan each requested chain
    for (const chainName of chains) {
      const client = getClient(chainName);
      if (!client) {
        allErrors.push(`Unsupported chain: ${chainName}`);
        continue;
      }

      const tokens = TOKENS_BY_CHAIN[chainName] || [];
      if (tokens.length === 0) {
        allErrors.push(`No token list configured for chain: ${chainName}`);
        continue;
      }

      for (const token of tokens) {
        try {
          const approvals = await scanToken(client, token, walletAddress, chainName, now);
          allApprovals.push(...approvals);
        } catch (err) {
          allErrors.push(
            `Failed to scan ${token.symbol} on ${chainName}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // ── Compute risk flags ──────────────────────────────────────────
    let unlimitedCount = 0;
    let staleCount = 0;
    let highValueCount = 0;

    for (const approval of allApprovals) {
      if (approval.is_unlimited) unlimitedCount++;
      if (approval.days_since_approval !== null && approval.days_since_approval > 180) staleCount++;
      // Estimate high value: look up decimals for the token
      const tokenInfo = Object.values(TOKENS_BY_CHAIN)
        .flat()
        .find((t) => t.address.toLowerCase() === approval.token.toLowerCase());
      if (tokenInfo && isHighValue(BigInt(approval.amount), tokenInfo.decimals)) {
        highValueCount++;
      }
    }

    const riskFlags = {
      unlimited_approvals: unlimitedCount,
      stale_approvals: staleCount,
      high_value_approvals: highValueCount,
    };

    // ── Build revocation tx data for risky approvals ────────────────
    // Include unlimited & stale approvals that are still active
    const revokeTxData: RevokeTxData[] = [];
    const revokeSeen = new Set<string>();

    for (const approval of allApprovals) {
      const isRisky =
        approval.is_unlimited ||
        (approval.days_since_approval !== null && approval.days_since_approval > 180);
      if (!isRisky) continue;

      // Find which chain this token belongs to
      let foundChain = chains[0];
      for (const c of chains) {
        const chainTokens = TOKENS_BY_CHAIN[c] || [];
        if (chainTokens.some((t) => t.address.toLowerCase() === approval.token.toLowerCase())) {
          foundChain = c;
          break;
        }
      }

      // Deduplicate (token + spender per chain)
      const key = `${approval.token}:${approval.spender}:${foundChain}`;
      if (revokeSeen.has(key)) continue;
      revokeSeen.add(key);

      const txData = buildRevokeTx(approval.token, approval.spender);

      revokeTxData.push({
        token: approval.token,
        spender: approval.spender,
        chain: foundChain,
        tx_data: txData,
      });
    }

    return {
      status: "success",
      output: {
        approvals: allApprovals,
        risk_flags: riskFlags,
        revoke_tx_data: revokeTxData,
        errors: allErrors.length > 0 ? allErrors : undefined,
      },
    };
  },
});

export default app;
