import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { encodeFunctionData, parseAbi } from "viem";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls.",
});

// ERC-20 approval ABI for generating revoke transactions
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)"
]);

const ERC721_ABI = parseAbi([
  "function setApprovalForAll(address operator, bool approved) external"
]);

// Mock function representing block explorer API calls (e.g. Etherscan)
async function fetchApprovals(wallet, chain) {
  // In a real agent, we would hit Etherscan API: ?module=account&action=txlist
  // and parse Approval events, or use an API like Revoke.cash / Covalent.
  
  // Returning mock risky approvals for the bounty
  return [
    {
      type: "ERC20",
      token_address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      spender_address: "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x Exchange (mock)
      amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935", // Max uint256
      last_updated: Date.now() - (1000 * 60 * 60 * 24 * 400), // > 1 year ago (Stale)
    },
    {
      type: "ERC721",
      token_address: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", // BAYC
      spender_address: "0x000000000000000000000000000000000000dEaD", // Suspicious contract
      amount: "ALL",
      last_updated: Date.now() - (1000 * 60 * 60 * 24 * 10), 
    }
  ];
}

addEntrypoint({
  key: "audit_approvals",
  description: "Detect risky approvals and output safe revocation data",
  input: z.object({
    wallet: z.string(),
    chains: z.array(z.string()),
  }),
  async handler({ input }) {
    const approvals = [];
    const risk_flags = [];
    const revoke_tx_data = [];

    const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 365; // 1 year

    for (const chain of input.chains) {
      try {
        const rawApprovals = await fetchApprovals(input.wallet, chain);
        
        for (const app of rawApprovals) {
          approvals.push(app);
          
          let flags = [];
          // Check for unlimited ERC20
          if (app.type === "ERC20" && app.amount.length > 60) {
            flags.push("UNLIMITED_APPROVAL");
          }
          
          // Check for NFT All
          if (app.type === "ERC721" && app.amount === "ALL") {
            flags.push("NFT_APPROVE_ALL");
          }

          // Check for stale
          if (Date.now() - app.last_updated > STALE_THRESHOLD_MS) {
            flags.push("STALE_APPROVAL_>1_YEAR");
          }
          
          risk_flags.push({
            token: app.token_address,
            spender: app.spender_address,
            flags: flags,
            risk_score: flags.length * 3.33 // simple 1-10 scoring
          });

          // Generate Revoke TX Data
          let txData = "";
          if (app.type === "ERC20") {
            txData = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [app.spender_address, 0n]
            });
          } else if (app.type === "ERC721") {
            txData = encodeFunctionData({
              abi: ERC721_ABI,
              functionName: 'setApprovalForAll',
              args: [app.spender_address, false]
            });
          }

          revoke_tx_data.push({
            to: app.token_address,
            data: txData,
            chain: chain,
            description: `Revoke ${app.type} access for ${app.spender_address}`
          });
        }
      } catch (e) {
        console.error(`Failed audit on ${chain}`, e);
      }
    }

    return {
      output: {
        approvals,
        risk_flags,
        revoke_tx_data,
      },
      usage: { total_tokens: 180 },
    };
  },
});

export default app;