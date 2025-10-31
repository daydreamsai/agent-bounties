import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals",
});

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

interface ApprovalInfo {
  token: string;
  spender: string;
  amount: string;
  is_unlimited: boolean;
  timestamp: number;
  is_stale: boolean;
  risk_level: "high" | "medium" | "low";
}

interface RevokeTxData {
  token: string;
  spender: string;
  data: string;
  to: string;
}

const CHAIN_RPC_URLS: Record<string, string> = {
  ethereum: process.env.RPC_URL_ETHEREUM || "https://eth.llamarpc.com",
  polygon: process.env.RPC_URL_POLYGON || "https://polygon.llamarpc.com",
};

async function auditApprovals(
  wallet: string,
  chains: string[]
): Promise<{
  approvals: ApprovalInfo[];
  risk_flags: string[];
  revoke_tx_data: RevokeTxData[];
}> {
  const approvals: ApprovalInfo[] = [];
  const riskFlags: string[] = [];
  const revokeTxData: RevokeTxData[] = [];

  try {
    const rpcUrl = CHAIN_RPC_URLS[chains[0]] || process.env.RPC_URL || "https://eth.llamarpc.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // ERC20 approval event signature
    const approvalEvent = ethers.id("Approval(address,address,uint256)");

    // Query approval events for the wallet
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10000 blocks

    // Filter by wallet address (owner)
    const filter = {
      address: null, // All tokens
      topics: [
        approvalEvent,
        ethers.zeroPadValue(wallet, 32), // owner
      ],
      fromBlock,
      toBlock: currentBlock,
    };

    const logs = await provider.getLogs(filter);

    for (const log of logs) {
      const token = log.address;
      const parsed = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address", "uint256"],
        log.data
      );
      const spender = parsed[0];
      const amount = parsed[1];
      const block = await provider.getBlock(log.blockNumber);
      const timestamp = block?.timestamp || 0;

      const isUnlimited = amount === MAX_UINT256;
      const daysSinceApproval = (Date.now() / 1000 - timestamp) / 86400;
      const isStale = daysSinceApproval > 90; // Stale if > 90 days

      let riskLevel: "high" | "medium" | "low" = "low";
      if (isUnlimited) {
        riskLevel = "high";
        riskFlags.push(`Unlimited approval for ${token} to ${spender}`);
      }
      if (isStale) {
        riskLevel = isUnlimited ? "high" : "medium";
        riskFlags.push(`Stale approval (${daysSinceApproval.toFixed(0)} days) for ${token}`);
      }

      approvals.push({
        token,
        spender,
        amount: amount.toString(),
        is_unlimited: isUnlimited,
        timestamp,
        is_stale: isStale,
        risk_level: riskLevel,
      });

      // Generate revoke transaction data
      const tokenContract = new ethers.Contract(token, ERC20_ABI, provider);
      const revokeData = tokenContract.interface.encodeFunctionData("approve", [
        spender,
        0,
      ]);

      revokeTxData.push({
        token,
        spender,
        data: revokeData,
        to: token,
      });
    }
  } catch (error) {
    console.error("Error auditing approvals:", error);
  }

  return {
    approvals,
    risk_flags: riskFlags,
    revoke_tx_data: revokeTxData,
  };
}

addEntrypoint({
  key: "audit_approvals",
  description: "Detect risky approvals and output safe revocation data",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit"),
    chains: z.array(z.string()).describe("Chains to scan"),
  }),
  async handler({ input }) {
    try {
      const result = await auditApprovals(
        input.wallet,
        input.chains
      );

      return {
        output: result,
        usage: {
          total_tokens: JSON.stringify(result).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          approvals: [],
          risk_flags: [],
          revoke_tx_data: [],
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;

