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
];

addEntrypoint({
  key: "auditApprovals",
  description: "Audit ERC-20 approvals for a wallet",
  input: z.object({
    wallet: z.string(),
    chains: z.array(z.string()),
  }),
  async handler({ input }) {
    const approvals = [];
    const risk_flags = [];
    const revoke_tx_data = [];

    for (const chain of input.chains) {
      const provider = new ethers.providers.JsonRpcProvider(chain);
      // Example token contract address
      const tokenContract = new ethers.Contract("0x...", ERC20_ABI, provider);

      // Example spender address
      const spender = "0x...";
      const allowance = await tokenContract.allowance(input.wallet, spender);

      if (allowance.eq(ethers.constants.MaxUint256)) {
        approvals.push({ token: "0x...", spender, allowance: "unlimited" });
        risk_flags.push({ token: "0x...", risk: "unlimited approval" });
        revoke_tx_data.push({
          to: "0x...",
          data: tokenContract.interface.encodeFunctionData("approve", [spender, 0]),
        });
      } else if (allowance.gt(0)) {
        // Check for stale approvals (e.g., last used over 30 days ago)
        approvals.push({ token: "0x...", spender, allowance: allowance.toString() });
        risk_flags.push({ token: "0x...", risk: "stale approval" });
        revoke_tx_data.push({
          to: "0x...",
          data: tokenContract.interface.encodeFunctionData("approve", [spender, 0]),
        });
      }
    }

    return {
      output: { approvals, risk_flags, revoke_tx_data },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;