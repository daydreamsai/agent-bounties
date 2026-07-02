import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

// ── Chain configurations ──────────────────────────────────────────────
const CHAIN_CONFIGS: Record<string, { chainId: number; rpc: string }> = {
  ethereum: { chainId: 1, rpc: "https://eth.llamarpc.com" },
  polygon:  { chainId: 137, rpc: "https://polygon.llamarpc.com" },
  arbitrum: { chainId: 42161, rpc: "https://arbitrum.llamarpc.com" },
  optimism: { chainId: 10, rpc: "https://optimism.llamarpc.com" },
  base:     { chainId: 8453, rpc: "https://base.llamarpc.com" },
  bsc:      { chainId: 56, rpc: "https://bsc.llamarpc.com" },
};

// ── Popular ERC-20 token addresses by chain ──────────────────────────
const TOKENS_BY_CHAIN: Record<string, Array<{ address: string; symbol: string; decimals: number }>> = {
  ethereum: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC",  decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT",  decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI",   decimals: 18 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH",  decimals: 18 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI",   decimals: 18 },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE",  decimals: 18 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK",  decimals: 18 },
    { address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", symbol: "MATIC", decimals: 18 },
  ],
  polygon: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",   symbol: "USDC",   decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",   symbol: "USDT",   decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",   symbol: "DAI",    decimals: 18 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",   symbol: "WETH",   decimals: 18 },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",   symbol: "WMATIC", decimals: 18 },
  ],
  arbitrum: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",   symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",   symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",   symbol: "DAI",  decimals: 18 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",   symbol: "WETH", decimals: 18 },
  ],
  optimism: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",   symbol: "USDC", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",   symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",   symbol: "DAI",  decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006",   symbol: "WETH", decimals: 18 },
  ],
  base: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",   symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006",   symbol: "WETH", decimals: 18 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",   symbol: "DAI",  decimals: 18 },
  ],
  bsc: [
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",   symbol: "USDC", decimals: 18 },
    { address: "0x55d398326f99059fF775485246999027B3197955",   symbol: "USDT", decimals: 18 },
    { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",   symbol: "DAI",  decimals: 18 },
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",   symbol: "WBNB", decimals: 18 },
  ],
};

// ── Popular NFT collections ───────────────────────────────────────────
const NFTS_BY_CHAIN: Record<string, Array<{ address: string; name: string }>> = {
  ethereum: [
    { address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", name: "BoredApeYachtClub" },
    { address: "0x60E4d786628Fea6478F785A6d7e704777c86a7c6", name: "MutantApeYachtClub" },
    { address: "0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258", name: "Otherdeed" },
  ],
};

// ── ABI fragments ─────────────────────────────────────────────────────
const ERC20_APPROVAL_EVENT_TOPIC = ethers.id("Approval(address,address,uint256)");
const ERC721_APPROVAL_EVENT_TOPIC = ethers.id("Approval(address,address,uint256)");
const ERC721_APPROVAL_FOR_ALL_EVENT_TOPIC = ethers.id("ApprovalForAll(address,address,bool)");

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
];

const ERC721_ABI = [
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
];

const MAX_UINT256 = ethers.MaxUint256;
const STALE_SECONDS = 180n * 24n * 60n * 60n; // ~6 months

// ── Types ─────────────────────────────────────────────────────────────
interface ApprovalInfo {
  tokenAddress: string;
  tokenSymbol: string;
  tokenType: "ERC-20" | "ERC-721" | "ERC-1155";
  spender: string;
  currentAllowance: string;
  currentAllowanceFormatted: string;
  isUnlimited: boolean;
  isStale: boolean;
  lastApprovedBlock?: number;
  lastApprovedTimestamp?: number;
  chain: string;
}

interface RevokeTxData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenType: string;
  spender: string;
  to: string;
  data: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────
function getProvider(chain: string): ethers.JsonRpcProvider | null {
  const cfg = CHAIN_CONFIGS[chain];
  if (!cfg) return null;
  return new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId);
}

function getLatestBlockTimestamp(provider: ethers.JsonRpcProvider): Promise<number> {
  return provider.getBlock("latest").then(b => b!.timestamp);
}

/**
 * Fetch ERC-20 Approval events for a given owner on a specific token,
 * then check current allowance to get live approval state.
 */
async function scanErc20Approvals(
  provider: ethers.JsonRpcProvider,
  token: { address: string; symbol: string; decimals: number },
  owner: string,
  chain: string,
): Promise<ApprovalInfo[]> {
  const results: ApprovalInfo[] = [];
  const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);

  try {
    // Get latest block number
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 50000); // scan last ~10 days worth
    const latestBlockData = await provider.getBlock(latestBlock);
    const currentTs = latestBlockData?.timestamp ?? Math.floor(Date.now() / 1000);

    // Query Approval events for this owner
    const filter = {
      address: token.address,
      topics: [
        ERC20_APPROVAL_EVENT_TOPIC,
        ethers.zeroPadValue(owner, 32),  // indexed owner (left-padded to 32 bytes)
      ],
      fromBlock: ethers.toQuantity(fromBlock),
      toBlock: ethers.toQuantity(latestBlock),
    };

    let logs: ethers.Log[] = [];
    try {
      logs = await provider.getLogs(filter);
    } catch {
      // If getLogs fails (archive data not available), skip event-scan
      logs = [];
    }

    // Track unique spenders we've seen
    const seenSpenders = new Set<string>();

    // Also check for a special case: if we find any approvals, process latest per spender
    const spenderLatestBlock: Map<string, ethers.Log> = new Map();
    for (const log of logs) {
      const spender = ethers.getAddress(ethers.dataSlice(log.topics[2], 12)); // second indexed param
      const existing = spenderLatestBlock.get(spender);
      if (!existing || log.blockNumber > existing.blockNumber) {
        spenderLatestBlock.set(spender, log);
      }
    }

    // Check current allowance for each discovered spender
    for (const [spender, log] of spenderLatestBlock.entries()) {
      try {
        const currentAllowance = await tokenContract.allowance(owner, spender);
        const zero = 0n;

        if (currentAllowance > zero) {
          const isUnlimited = currentAllowance >= MAX_UINT256;
          const blockData = await provider.getBlock(log.blockNumber);
          const blockTs = blockData?.timestamp ?? 0;
          const isStale = (currentTs - blockTs) > Number(STALE_SECONDS);

          results.push({
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenType: "ERC-20",
            spender,
            currentAllowance: currentAllowance.toString(),
            currentAllowanceFormatted: ethers.formatUnits(currentAllowance, token.decimals),
            isUnlimited,
            isStale,
            lastApprovedBlock: log.blockNumber,
            lastApprovedTimestamp: blockTs,
            chain,
          });
        }
      } catch {
        // Skip if allowance check fails
      }
    }

    // Also check known protocol addresses via direct allowance calls
    const KNOWN_PROTOCOLS: string[] = [
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
      "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router 2
      "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Exchange Proxy
      "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Seaport 1.1
      "0x00000000006cEE72100F1611b9f59F7D41E7b0F0", // Seaport 1.5
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router
      "0x1111111254fb6c44bAC0beD2854e76F90643097d", // 1inch V4
    ];

    for (const spender of KNOWN_PROTOCOLS) {
      if (seenSpenders.has(spender)) continue;
      try {
        const currentAllowance = await tokenContract.allowance(owner, spender);
        if (currentAllowance > 0n) {
          const isUnlimited = currentAllowance >= MAX_UINT256;
          results.push({
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenType: "ERC-20",
            spender,
            currentAllowance: currentAllowance.toString(),
            currentAllowanceFormatted: ethers.formatUnits(currentAllowance, token.decimals),
            isUnlimited,
            isStale: false, // Unknown timestamp, don't flag as stale
            chain,
          });
        }
      } catch {
        // Skip
      }
    }
  } catch (err) {
    // If full scan fails, still try direct checks for known protocols
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const KNOWN_PROTOCOLS: string[] = [
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
    ];
    for (const spender of KNOWN_PROTOCOLS) {
      try {
        const currentAllowance = await tokenContract.allowance(owner, spender);
        if (currentAllowance > 0n) {
          const isUnlimited = currentAllowance >= MAX_UINT256;
          results.push({
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenType: "ERC-20",
            spender,
            currentAllowance: currentAllowance.toString(),
            currentAllowanceFormatted: ethers.formatUnits(currentAllowance, token.decimals),
            isUnlimited,
            isStale: false,
            chain,
          });
        }
      } catch {
        // Skip
      }
    }
  }

  return results;
}

/**
 * Scan ERC-721 / ERC-1155 ApprovalForAll events for a given owner.
 */
async function scanNftApprovals(
  provider: ethers.JsonRpcProvider,
  collection: { address: string; name: string },
  owner: string,
  chain: string,
): Promise<ApprovalInfo[]> {
  const results: ApprovalInfo[] = [];
  const nftContract = new ethers.Contract(collection.address, ERC721_ABI, provider);

  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 50000);
    const latestBlockData = await provider.getBlock(latestBlock);
    const currentTs = latestBlockData?.timestamp ?? Math.floor(Date.now() / 1000);

    // Query ApprovalForAll events
    const filter = {
      address: collection.address,
      topics: [
        ERC721_APPROVAL_FOR_ALL_EVENT_TOPIC,
        ethers.zeroPadValue(owner, 32),
      ],
      fromBlock: ethers.toQuantity(fromBlock),
      toBlock: ethers.toQuantity(latestBlock),
    };

    let logs: ethers.Log[] = [];
    try {
      logs = await provider.getLogs(filter);
    } catch {
      logs = [];
    }

    const seenOperators = new Set<string>();
    const operatorLatest: Map<string, ethers.Log> = new Map();

    for (const log of logs) {
      const operator = ethers.getAddress(ethers.dataSlice(log.topics[2], 12));
      const existing = operatorLatest.get(operator);
      if (!existing || log.blockNumber > existing.blockNumber) {
        operatorLatest.set(operator, log);
      }
    }

    for (const [operator, log] of operatorLatest.entries()) {
      try {
        const isApproved = await nftContract.isApprovedForAll(owner, operator);
        if (isApproved) {
          const blockData = await provider.getBlock(log.blockNumber);
          const blockTs = blockData?.timestamp ?? 0;
          const isStale = (currentTs - blockTs) > Number(STALE_SECONDS);

          results.push({
            tokenAddress: collection.address,
            tokenSymbol: collection.name,
            tokenType: "ERC-721",
            spender: operator,
            currentAllowance: isApproved ? "true" : "false",
            currentAllowanceFormatted: isApproved ? "ApprovedForAll" : "None",
            isUnlimited: true, // ApprovalForAll is always "unlimited"
            isStale,
            lastApprovedBlock: log.blockNumber,
            lastApprovedTimestamp: blockTs,
            chain,
          });
        }
      } catch {
        // Skip
      }
    }

    // Also check known marketplaces
    const KNOWN_MARKETPLACES: string[] = [
      "0x00000000006cEE72100F1611b9f59F7D41E7b0F0", // Seaport 1.5
      "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Seaport 1.1
      "0x1E0049783F008A0085193E00003D00cd54003c71", // Seaport 1.4
      "0x7f268357A8c2552623316e2562D90e642bB538E5", // Blur
      "0x0000000000A39bb272e79075f125630b8C0a593e", // Blur 2
    ];

    for (const marketplace of KNOWN_MARKETPLACES) {
      if (seenOperators.has(marketplace)) continue;
      try {
        const isApproved = await nftContract.isApprovedForAll(owner, marketplace);
        if (isApproved) {
          results.push({
            tokenAddress: collection.address,
            tokenSymbol: collection.name,
            tokenType: "ERC-721",
            spender: marketplace,
            currentAllowance: "true",
            currentAllowanceFormatted: "ApprovedForAll",
            isUnlimited: true,
            isStale: false,
            chain,
          });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Fallback: check known marketplaces
    const KNOWN_MARKETPLACES: string[] = [
      "0x00000000006cEE72100F1611b9f59F7D41E7b0F0",
      "0x1E0049783F008A0085193E00003D00cd54003c71",
      "0x7f268357A8c2552623316e2562D90e642bB538E5",
    ];
    for (const marketplace of KNOWN_MARKETPLACES) {
      try {
        const isApproved = await nftContract.isApprovedForAll(owner, marketplace);
        if (isApproved) {
          results.push({
            tokenAddress: collection.address,
            tokenSymbol: collection.name,
            tokenType: "ERC-721",
            spender: marketplace,
            currentAllowance: "true",
            currentAllowanceFormatted: "ApprovedForAll",
            isUnlimited: true,
            isStale: false,
            chain,
          });
        }
      } catch {
        // Skip
      }
    }
  }

  return results;
}

/**
 * Build revocation transaction data for an approval.
 */
function buildRevokeTx(approval: ApprovalInfo): RevokeTxData {
  if (approval.tokenType === "ERC-20") {
    // approve(spender, 0)
    const erc20Interface = new ethers.Interface([
      "function approve(address spender, uint256 amount) public returns (bool)",
    ]);
    const data = erc20Interface.encodeFunctionData("approve", [approval.spender, 0]);
    return {
      tokenAddress: approval.tokenAddress,
      tokenSymbol: approval.tokenSymbol,
      tokenType: approval.tokenType,
      spender: approval.spender,
      to: approval.tokenAddress,
      data,
      description: `Revoke ${approval.tokenSymbol} approval for ${approval.spender}`,
    };
  } else {
    // setApprovalForAll(operator, false)
    const erc721Interface = new ethers.Interface([
      "function setApprovalForAll(address operator, bool approved) public",
    ]);
    const data = erc721Interface.encodeFunctionData("setApprovalForAll", [approval.spender, false]);
    return {
      tokenAddress: approval.tokenAddress,
      tokenSymbol: approval.tokenSymbol,
      tokenType: approval.tokenType,
      spender: approval.spender,
      to: approval.tokenAddress,
      data,
      description: `Revoke ${approval.tokenSymbol} ApprovalForAll for ${approval.spender}`,
    };
  }
}

// ── Agent Application ─────────────────────────────────────────────────
const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals and build safe revocation transaction data",
});

addEntrypoint({
  key: "audit",
  description: "Audit a wallet address for risky token approvals across multiple chains",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit"),
    chains: z.array(z.string()).min(1).describe("Chains to scan (e.g., ethereum, polygon, arbitrum)"),
  }),
  async handler({ input }) {
    const { wallet, chains } = input;

    // Validate wallet address
    let walletAddress: string;
    try {
      walletAddress = ethers.getAddress(wallet);
    } catch {
      return {
        output: {
          error: `Invalid wallet address: ${wallet}`,
          approvals: [],
          risk_flags: [],
          revoke_tx_data: [],
        },
        usage: { total_tokens: "0" },
      };
    }

    const allApprovals: ApprovalInfo[] = [];
    const errors: string[] = [];

    // Scan each requested chain
    for (const chain of chains) {
      const provider = getProvider(chain);
      if (!provider) {
        errors.push(`Unsupported chain: ${chain}`);
        continue;
      }

      // Scan ERC-20 tokens
      const tokens = TOKENS_BY_CHAIN[chain] || [];
      for (const token of tokens) {
        try {
          const approvals = await scanErc20Approvals(provider, token, walletAddress, chain);
          allApprovals.push(...approvals);
        } catch (err) {
          // Individual token failure shouldn't block everything
        }
      }

      // Scan NFT collections
      const nfts = NFTS_BY_CHAIN[chain] || [];
      for (const nft of nfts) {
        try {
          const nftApprovals = await scanNftApprovals(provider, nft, walletAddress, chain);
          allApprovals.push(...nftApprovals);
        } catch {
          // Skip
        }
      }
    }

    // Build risk flags
    const riskFlags = allApprovals.map(a => ({
      tokenAddress: a.tokenAddress,
      tokenSymbol: a.tokenSymbol,
      tokenType: a.tokenType,
      spender: a.spender,
      chain: a.chain,
      risks: [
        ...(a.isUnlimited ? ["UNLIMITED_ALLOWANCE"] : []),
        ...(a.isStale ? ["STALE_APPROVAL"] : []),
      ],
    })).filter(r => r.risks.length > 0);

    // Build revoke tx data for risky approvals
    const revokeTxData = allApprovals
      .filter(a => a.isUnlimited || a.isStale)
      .map(buildRevokeTx);

    return {
      output: {
        wallet: walletAddress,
        chains,
        approvals: allApprovals.map(a => ({
          tokenAddress: a.tokenAddress,
          tokenSymbol: a.tokenSymbol,
          tokenType: a.tokenType,
          spender: a.spender,
          currentAllowance: a.currentAllowanceFormatted,
          isUnlimited: a.isUnlimited,
          isStale: a.isStale,
          chain: a.chain,
        })),
        risk_flags: riskFlags,
        revoke_tx_data: revokeTxData,
        errors: errors.length > 0 ? errors : undefined,
      },
      usage: {
        total_tokens: String(allApprovals.length),
      },
    };
  },
});

export default app;
