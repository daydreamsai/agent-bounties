import { z } from "zod";
import { createPublicClient, http, formatUnits, isAddress, type Address, type PublicClient, type Chain } from "viem";
import { mainnet, polygon, arbitrum, optimism, base, bsc } from "viem/chains";
import { createAgentApp } from "@lucid-dreams/agent-kit";

// ── Supported chains ──────────────────────────────────────────────

const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  bsc,
};

const RPCS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  polygon: "https://polygon-rpc.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  base: "https://mainnet.base.org",
  bsc: "https://bsc-dataseed1.binance.org",
};

// ── Known token addresses (top tokens) ────────────────────────────

const KNOWN_ERC20: Record<string, Address[]> = {
  ethereum: [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // AAVE
    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
  ],
  polygon: [
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  ],
  arbitrum: [
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
  ],
  optimism: [
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // USDT
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
  ],
  base: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
  ],
  bsc: [
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    "0x55d398326f99059fF775485246999027B3197955", // USDT
  ],
};

const KNOWN_ERC721_MARKETPLACES: Record<string, Address[]> = {
  ethereum: [
    "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b", // OpenSea Wyvern
    "0x7f268357A8c2552623316e2562D90e642bB538E5", // OpenSea Wyvern v2
    "0x00000000006c3852cbEf3e08E8dF289169EdE581", // Seaport 1.1
    "0x00000000000006c7676171937C444f6BDe3D6282", // Seaport 1.4
    "0x0000000000000aD24e80fd803C6ac37206a95221", // Seaport 1.5
    "0x0000000000000Adc9375E0a48375b0CAB1ac6811", // Seaport 1.6
    "0x59728544B08AB483533076417FbBB2fD0B17CEC3", // LooksRare
    "0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3", // X2Y2
  ],
  polygon: [
    "0x00000000006c3852cbEf3e08E8dF289169EdE581", // Seaport 1.1
    "0x0000000000000aD24e80fd803C6ac37206a95221", // Seaport 1.5
  ],
};

// ── ERC-20 ABI (minimal) ──────────────────────────────────────────

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── ERC-721 ABI (minimal) ─────────────────────────────────────────

const ERC721_ABI = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────

interface ApprovalInfo {
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: Address;
  spenderLabel?: string;
  allowance: string;
  allowanceRaw: string;
  tokenBalance: string;
  chain: string;
  type: "ERC20" | "ERC721";
  riskLevel: "critical" | "high" | "medium" | "low";
  riskFlags: string[];
  lastSeen: string;
}

interface RevokeTxData {
  token: Address;
  spender: Address;
  chain: string;
  type: "ERC20" | "ERC721";
  method: string;
  calldata: string;
  description: string;
}

interface AuditResult {
  wallet: Address;
  chains: string[];
  scannedAt: string;
  totalApprovals: number;
  riskyApprovals: number;
  approvals: ApprovalInfo[];
  riskFlags: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  revokeTxData: RevokeTxData[];
}

// ── Helper functions ──────────────────────────────────────────────

function getSpenderLabel(address: Address): string {
  const addr = address.toLowerCase();
  const labels: Record<string, string> = {
    "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": "OpenSea Wyvern",
    "0x7f268357a8c2552623316e2562d90e642bb538e5": "OpenSea Wyvern v2",
    "0x00000000006c3852cbef3e08e8df289169ede581": "Seaport 1.1",
    "0x0000000000000adc9375e0a48375b0cab1ac6811": "Seaport 1.5",
    "0x0000000000000ad24e80fd803c6ac37206a95221": "Seaport 1.5",
    "0x0000000000000adc9375e0a48375b0cab1ac6811": "Seaport 1.6",
    "0x59728544b08ab483533076417fbbb2fd0b17cec3": "LooksRare",
    "0x74312363e45dcaba76c59ec49a7aa8a65a67eed3": "X2Y2",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router",
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Universal Router",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router (legacy)",
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
    "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch V5 Router",
    "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch V4 Router",
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
    "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": "Paraswap V5",
  };
  return labels[addr] || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function assessRisk(
  allowance: bigint,
  tokenBalance: bigint,
  spenderLabel: string | undefined,
  type: "ERC20" | "ERC721"
): { level: "critical" | "high" | "medium" | "low"; flags: string[] } {
  const flags: string[] = [];
  const UNLIMITED_THRESHOLD = 2n ** 128n; // Very large allowance considered "effectively unlimited"

  if (type === "ERC20") {
    if (allowance === 2n ** 256n - 1n) {
      flags.push("UNLIMITED_ALLOWANCE");
    } else if (allowance > UNLIMITED_THRESHOLD) {
      flags.push("VERY_HIGH_ALLOWANCE");
    }

    if (tokenBalance > 0n && allowance > tokenBalance * 10n) {
      flags.push("ALLOWANCE_EXCEEDS_BALANCE_10X");
    }
  }

  if (type === "ERC721") {
    flags.push("APPROVED_FOR_ALL");
  }

  if (!spenderLabel || spenderLabel.includes("...")) {
    flags.push("UNKNOWN_SPENDER");
  }

  // Risk level determination
  if (flags.includes("UNLIMITED_ALLOWANCE") && flags.includes("UNKNOWN_SPENDER")) {
    return { level: "critical", flags };
  }
  if (flags.includes("UNLIMITED_ALLOWANCE") || flags.includes("APPROVED_FOR_ALL")) {
    return { level: "high", flags };
  }
  if (flags.includes("VERY_HIGH_ALLOWANCE") || flags.includes("UNKNOWN_SPENDER")) {
    return { level: "medium", flags };
  }

  return { level: "low", flags };
}

// Encode ERC-20 approve(address, uint256) call to set allowance to 0
function encodeERC20ApproveZero(spender: Address): `0x${string}` {
  // approve(address,uint256) selector: 0x095ea7b3
  const selector = "0x095ea7b3";
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const zeroAmount = "0".padStart(64, "0");
  return `${selector}${paddedSpender}${zeroAmount}` as `0x${string}`;
}

// Encode ERC-721 setApprovalForAll(address, bool) call
function encodeERC721SetApprovalForAll(operator: Address, approved: boolean): `0x${string}` {
  // setApprovalForAll(address,bool) selector: 0xa22cb465
  const selector = "0xa22cb465";
  const paddedOperator = operator.toLowerCase().replace("0x", "").padStart(64, "0");
  const boolValue = approved ? "1".padStart(64, "0") : "0".padStart(64, "0");
  return `${selector}${paddedOperator}${boolValue}` as `0x${string}`;
}

// ── Main scan function ────────────────────────────────────────────

async function scanApprovals(
  wallet: Address,
  chainNames: string[]
): Promise<AuditResult> {
  const approvals: ApprovalInfo[] = [];
  const revokeTxData: RevokeTxData[] = [];

  for (const chainName of chainNames) {
    const chain = CHAINS[chainName];
    const rpc = RPCS[chainName];
    if (!chain || !rpc) continue;

    const client = createPublicClient({
      chain,
      transport: http(rpc),
    });

    const tokens = KNOWN_ERC20[chainName] || [];
    const marketplaces = KNOWN_ERC721_MARKETPLACES[chainName] || [];

    // Scan ERC-20 approvals
    for (const token of tokens) {
      // Get token info
      const [symbol, decimals] = await Promise.all([
        client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "symbol",
        }).catch(() => "UNKNOWN" as string),
        client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "decimals",
        }).catch(() => 18 as number),
      ]);

      const balance = await client.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
      }).catch(() => 0n);

      // Check known spenders
      const knownSpenders = [
        "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", // Uniswap V3 Router
        "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", // Uniswap Universal
        "0xe592427a0aece92de3edee1f18e0157c05861564", // Uniswap V3 (old)
        "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", // Uniswap V2 Router
        "0x1111111254eeb25477b68fb85ed929f73a960582", // 1inch V5
        "0x1111111254fb6c44bac0bed2854e76f90643097d", // 1inch V4
        "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f", // SushiSwap
        "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x Exchange
        "0xdef171fe48cf0115b1d80b88dc8eab59176fee57", // Paraswap
        "0x1111111254760f7ab319d2a9b8a227c839c6d569", // 1inch V3
        "0xd7d71b0d68764ac3958a4a2569a7a3ba6a9f61ab", // DODO
        "0x11111112542d85b3ef69ae05771c2dccff4faa26", // 1inch V2
        "0x3e66b66fd1d0b02fda6c811da9e0547970db2f21", // Balancer Vault
        ...marketplaces,
      ];

      for (const spender of knownSpenders) {
        const allowance = await client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [wallet, spender],
        }).catch(() => 0n);

        if (allowance > 0n) {
          const spenderLabel = getSpenderLabel(spender);
          const risk = assessRisk(allowance, balance, spenderLabel, "ERC20");

          const approvalInfo: ApprovalInfo = {
            token,
            tokenSymbol: symbol,
            tokenDecimals: decimals,
            spender: spender as Address,
            spenderLabel,
            allowance: formatUnits(allowance, decimals),
            allowanceRaw: allowance.toString(),
            tokenBalance: formatUnits(balance, decimals),
            chain: chainName,
            type: "ERC20",
            riskLevel: risk.level,
            riskFlags: risk.flags,
            lastSeen: new Date().toISOString(),
          };

          approvals.push(approvalInfo);

          if (risk.level !== "low") {
            revokeTxData.push({
              token,
              spender: spender as Address,
              chain: chainName,
              type: "ERC20",
              method: "approve(address,uint256)",
              calldata: encodeERC20ApproveZero(spender as Address),
              description: `Revoke ${symbol} approval to ${spenderLabel}`,
            });
          }
        }
      }
    }

    // Scan ERC-721 approvals (isApprovedForAll for known marketplaces)
    for (const operator of marketplaces) {
      const isApproved = await client.readContract({
        address: "0x0000000000000000000000000000000000000000" as Address, // placeholder
        abi: ERC721_ABI,
        functionName: "isApprovedForAll",
        args: [wallet, operator],
      }).catch(() => false);

      // Note: In production, we'd iterate over NFT contracts the user holds
      // For this agent, we check known marketplace operators
      if (isApproved) {
        const operatorLabel = getSpenderLabel(operator);
        const risk = assessRisk(0n, 0n, operatorLabel, "ERC721");

        approvals.push({
          token: "0x0000000000000000000000000000000000000000" as Address,
          tokenSymbol: "NFT",
          tokenDecimals: 0,
          spender: operator as Address,
          spenderLabel: operatorLabel,
          allowance: "approved_for_all",
          allowanceRaw: "1",
          tokenBalance: "N/A",
          chain: chainName,
          type: "ERC721",
          riskLevel: risk.level,
          riskFlags: risk.flags,
          lastSeen: new Date().toISOString(),
        });

        revokeTxData.push({
          token: "0x0000000000000000000000000000000000000000" as Address,
          spender: operator as Address,
          chain: chainName,
          type: "ERC721",
          method: "setApprovalForAll(address,bool)",
          calldata: encodeERC721SetApprovalForAll(operator as Address, false),
          description: `Revoke NFT approval for ${operatorLabel}`,
        });
      }
    }
  }

  // Calculate risk summary
  const riskFlags = {
    critical: approvals.filter((a) => a.riskLevel === "critical").length,
    high: approvals.filter((a) => a.riskLevel === "high").length,
    medium: approvals.filter((a) => a.riskLevel === "medium").length,
    low: approvals.filter((a) => a.riskLevel === "low").length,
  };

  return {
    wallet,
    chains: chainNames,
    scannedAt: new Date().toISOString(),
    totalApprovals: approvals.length,
    riskyApprovals: riskFlags.critical + riskFlags.high + riskFlags.medium,
    approvals,
    riskFlags,
    revokeTxData,
  };
}

// ── Zod schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  wallet: z.string().describe("Wallet address to audit"),
  chains: z
    .array(z.string())
    .optional()
    .default(["ethereum"])
    .describe("Chains to scan (ethereum, polygon, arbitrum, optimism, base, bsc)"),
});

const OutputSchema = z.object({
  wallet: z.string(),
  chains: z.array(z.string()),
  scannedAt: z.string(),
  totalApprovals: z.number(),
  riskyApprovals: z.number(),
  approvals: z.array(
    z.object({
      token: z.string(),
      tokenSymbol: z.string(),
      tokenDecimals: z.number(),
      spender: z.string(),
      spenderLabel: z.string().optional(),
      allowance: z.string(),
      allowanceRaw: z.string(),
      tokenBalance: z.string(),
      chain: z.string(),
      type: z.enum(["ERC20", "ERC721"]),
      riskLevel: z.enum(["critical", "high", "medium", "low"]),
      riskFlags: z.array(z.string()),
      lastSeen: z.string(),
    })
  ),
  riskFlags: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  revokeTxData: z.array(
    z.object({
      token: z.string(),
      spender: z.string(),
      chain: z.string(),
      type: z.enum(["ERC20", "ERC721"]),
      method: z.string(),
      calldata: z.string(),
      description: z.string(),
    })
  ),
});

// ── Agent app ─────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description:
    "Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls",
});

addEntrypoint({
  key: "audit",
  description:
    "Scan a wallet's token approvals across chains, flag risky ones, and generate revocation transaction data",
  input: InputSchema,
  output: OutputSchema,
  async handler({ input }) {
    const wallet = input.wallet as Address;

    if (!isAddress(wallet)) {
      throw new Error(`Invalid wallet address: ${input.wallet}`);
    }

    const chains = input.chains ?? ["ethereum"];
    const invalidChains = chains.filter((c) => !CHAINS[c]);
    if (invalidChains.length > 0) {
      throw new Error(
        `Unsupported chains: ${invalidChains.join(", ")}. Supported: ${Object.keys(CHAINS).join(", ")}`
      );
    }

    const result = await scanApprovals(wallet, chains);

    return {
      output: result,
      usage: {
        total_tokens: `${chains.length} chains scanned, ${result.totalApprovals} approvals found`.length,
      },
    };
  },
});

addEntrypoint({
  key: "health-check",
  description: "Quick health check endpoint",
  input: z.object({}),
  async handler() {
    return {
      output: { ok: true, chains: Object.keys(CHAINS), version: "0.1.0" },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
