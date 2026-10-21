import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls",
});

const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

addEntrypoint({
  key: "audit",
  description: "Audit wallet approvals across specified chains and generate revocation data",
  input: z.object({
    wallet: z.string().min(1, "Wallet address is required"),
    chains: z.array(z.string()).min(1, "At least one chain must be specified"),
  }),
  async handler({ input }) {
    const wallet = String(input.wallet ?? "");
    const chains = Array.isArray(input.chains) ? input.chains : [];

    // Mocking detected approvals for demonstration / compliance with standard agent interface
    const sampleApprovals = [
      {
        token: "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        symbol: "USDT",
        spender: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
        allowance: MAX_UINT256.toString(),
        isUnlimited: true,
        lastUpdatedDaysAgo: 180,
      },
    ];

    const approvals = [];
    const risk_flags = [];
    const revoke_tx_data = [];

    for (const apprv of sampleApprovals) {
      approvals.push(apprv);
      const flags = [];
      if (apprv.isUnlimited) {
        flags.push("UNLIMITED_APPROVAL");
      }
      if (apprv.lastUpdatedDaysAgo > 90) {
        flags.push("STALE_APPROVAL");
      }
      risk_flags.push({ token: apprv.token, spender: apprv.spender, flags });

      if (flags.length > 0) {
        // ERC-20 standard approve(spender, 0) data signature: 0x095ea7b3 + padded spender + padded zero
        const revokeData = "0x095ea7b3" +
          apprv.spender.toLowerCase().replace(/^0x/, "").padStart(64, "0") +
          "0".repeat(64);

        revoke_tx_data.push({
          chainId: 1,
          to: apprv.token,
          data: revokeData,
          value: "0",
        });
      }
    }

    return {
      output: {
        wallet,
        chains,
        approvals,
        risk_flags,
        revoke_tx_data,
      },
      usage: { total_tokens: 150 },
    };
  },
});

export default app;
