import { createPublicClient, http, type Address, parseAbiItem, formatUnits } from "viem";
import { base } from "viem/chains";

const MAX_UINT256 = 2n ** 256n - 1n;
const HIGH_ALLOWANCE_THRESHOLD = 10n ** 30n; // Very large allowance

// Known DEX routers / trusted contracts on Base
const KNOWN_CONTRACTS: Record<string, string> = {
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap V3 Router",
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome Router",
  "0xa238dd80c259a72e81d7e4664a9801593f98d1c5": "Aave V3 Pool",
  "0x3d4e44eb1374240ce5f1b871ab261cd16335b76a": "Uniswap V3 Quoter",
};

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Common tokens on Base
const COMMON_TOKENS: Record<number, Address[]> = {
  8453: [
    "0x4200000000000000000000000000000000000006", // WETH
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
    "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A", // weETH
    "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", // wstETH
  ],
};

// Common spenders to check
const COMMON_SPENDERS: Address[] = [
  "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap Router
  "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome
  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave Pool
];

function getClient(chainId: number) {
  if (chainId === 8453) {
    return createPublicClient({ chain: base, transport: http("https://1rpc.io/base") });
  }
  throw new Error(`Unsupported chain: ${chainId}`);
}

type ApprovalInfo = {
  token: string;
  spender: string;
  allowance: string;
  is_unlimited: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  reason: string;
};

export async function auditApprovals(
  wallet: string,
  chainId: number,
  specificTokens?: string[]
) {
  const client = getClient(chainId);
  const tokens = specificTokens?.map((t) => t as Address) ?? COMMON_TOKENS[chainId] ?? [];

  const approvals: ApprovalInfo[] = [];

  // Also scan Approval events for this wallet to find more spenders
  const approvalEvent = parseAbiItem(
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
  );

  const discoveredSpenders = new Set<Address>(COMMON_SPENDERS);

  // Scan recent Approval events for this wallet
  try {
    const latest = await client.getBlockNumber();
    const fromBlock = latest - 100000n; // ~2.3 days on Base
    
    for (const token of tokens.slice(0, 3)) {
      try {
        const logs = await client.getLogs({
          address: token,
          event: approvalEvent as any,
          args: { owner: wallet as Address },
          fromBlock,
          toBlock: latest,
        });
        for (const log of logs) {
          const spender = (log.args as any).spender;
          if (spender) discoveredSpenders.add(spender as Address);
        }
      } catch {}
    }
  } catch {}

  // Check allowances
  for (const token of tokens) {
    for (const spender of discoveredSpenders) {
      try {
        const allowance = await client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [wallet as Address, spender],
        });

        if (allowance > 0n) {
          const isUnlimited = allowance >= MAX_UINT256 / 2n;
          const knownName = KNOWN_CONTRACTS[spender.toLowerCase()];

          let riskLevel: "low" | "medium" | "high" | "critical";
          let reason: string;

          if (isUnlimited && !knownName) {
            riskLevel = "critical";
            reason = "Unlimited approval to unknown contract";
          } else if (isUnlimited && knownName) {
            riskLevel = "medium";
            reason = `Unlimited approval to ${knownName} (trusted but still risky)`;
          } else if (allowance > HIGH_ALLOWANCE_THRESHOLD && !knownName) {
            riskLevel = "high";
            reason = "Very large approval to unknown contract";
          } else if (knownName) {
            riskLevel = "low";
            reason = `Limited approval to ${knownName}`;
          } else {
            riskLevel = "medium";
            reason = "Approval to unrecognized contract";
          }

          approvals.push({
            token,
            spender,
            allowance: allowance.toString(),
            is_unlimited: isUnlimited,
            risk_level: riskLevel,
            reason,
          });
        }
      } catch {}
    }
  }

  const highRisk = approvals.filter(
    (a) => a.risk_level === "high" || a.risk_level === "critical"
  ).length;

  return {
    wallet,
    chain_id: chainId,
    total_approvals: approvals.length,
    high_risk: highRisk,
    approvals,
    summary: `Found ${approvals.length} approval(s), ${highRisk} high-risk. ${
      highRisk > 0 ? "⚠️ REVOKE recommended for high-risk approvals." : "✅ No critical risks found."
    }`,
  };
}
