/**
 * Approval type definitions for the Approval Risk Auditor.
 */

export interface ApprovalRecord {
  /** ERC-20 token contract address */
  tokenAddress: string;
  /** Token symbol (e.g., USDC, WETH) */
  tokenSymbol?: string;
  /** Token name */
  tokenName?: string;
  /** Spender address that has the approval */
  spender: string;
  /** Chain ID */
  chainId: number;
  /** Approved amount as a string (hex or decimal) */
  amount: string;
  /** Whether the approval is MAX_UINT256 (unlimited) */
  isUnlimited: boolean;
  /** Block number when approval was last updated */
  lastUpdatedBlock?: number;
  /** Current block number (for staleness calculation) */
  currentBlock?: number;
  /** Whether spender is a contract */
  spenderIsContract?: boolean;
  /** Whether spender has bytecode */
  spenderHasCode?: boolean;
  /** Whether spender is a known verified protocol */
  spenderIsVerified?: boolean;
  /** Max uint256 value for reference */
  readonly MAX_UINT256: string;
}

export type RiskFlagType =
  | "unlimited_allowance"
  | "stale_approval"
  | "high_value_allowance"
  | "unknown_spender"
  | "suspicious_contract"
  | "nft_approval"
  | "approver_not_owner";

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export interface RiskFlag {
  type: RiskFlagType;
  severity: RiskSeverity;
  message: string;
}

export interface RevokeTxData {
  /** Index of the approval in the results array */
  approval_index: number;
  /** Token contract address */
  token_address: string;
  /** Spender address to revoke from */
  spender: string;
  /** Chain ID */
  chain_id: number;
  /** Target address for the transaction (the token contract) */
  to: string;
  /** Encoded calldata for approve(spender, 0) */
  data: string;
  /** Value to send (always "0x0" for ERC-20 approve) */
  value: string;
  /** Estimated gas for the transaction */
  gas_estimate?: string;
}

/**
 * ERC-20 ABI fragment for the approve function.
 */
export const ERC20_APPROVE_ABI = {
  type: "function" as const,
  name: "approve",
  stateMutability: "nonpayable" as const,
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
};

/**
 * ERC-20 ABI fragment for the allowance function.
 */
export const ERC20_ALLOWANCE_ABI = {
  type: "function" as const,
  name: "allowance",
  stateMutability: "view" as const,
  inputs: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
  ],
  outputs: [{ name: "", type: "uint256" }],
};

/**
 * MAX_UINT256 value as a hex string.
 */
export const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/**
 * Known popular token addresses per chain for priority scanning.
 */
export const KNOWN_TOKENS: Record<number, string[]> = {
  1: [
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
  ],
  56: [
    "0x55d398326f99059fF775485246999027B3197955", // USDT
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", // BUSD
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // WETH
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  ],
  137: [
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // WBTC
  ],
  42161: [
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
  ],
  10: [
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDT
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC (native)
    "0x4200000000000000000000000000000000000006", // WETH
    "0x68f94fc8f36Cdc812F59235317c65Ae89f473C56", // WBTC
  ],
  8453: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC
    "0x4200000000000000000000000000000000000006", // WETH
  ],
  43114: [
    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
    "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDT
    "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", // WETH
    "0x50b7545627a5162F82A992c33b87aDc75187B218", // WBTC
  ],
};

/**
 * Known popular DEX/DeFi spender addresses for checking approval safety.
 */
export const KNOWN_SPENDERS: Record<number, string[]> = {
  1: [
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router
    "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B", // Uniswap Universal Router
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // Uniswap V3 Router 2
    "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Protocol
    "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
  ],
  56: [
    "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", // PancakeSwap V3
  ],
  137: [
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // Uniswap V3 Router
    "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
  ],
  42161: [
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Swapr
  ],
  10: [
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router
  ],
  8453: [
    "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 Base
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
  ],
};

/**
 * Encode ERC-20 approve(spender, 0) transaction data.
 */
export function encodeRevokeTxData(
  approval: ApprovalRecord,
  index: number
): RevokeTxData {
  // Manually encode: approve(address spender, uint256 amount)
  // Function selector: 0x095ea7b3
  // spender: padded to 32 bytes
  // amount: 0 padded to 32 bytes

  const spenderPadded = approval.spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountPadded = "0".repeat(64);

  return {
    approval_index: index,
    token_address: approval.tokenAddress,
    spender: approval.spender,
    chain_id: approval.chainId,
    to: approval.tokenAddress,
    data: `0x095ea7b3${spenderPadded}${amountPadded}`,
    value: "0x0",
    gas_estimate: "46000", // Typical gas for ERC-20 approve
  };
}

/**
 * RPC endpoints for supported chains (public fallbacks).
 */
export const RPC_ENDPOINTS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  8453: "https://mainnet.base.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  250: "https://rpc.ftm.tools",
  100: "https://rpc.gnosischain.com",
};

/**
 * Chain names for display purposes.
 */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Smart Chain",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  8453: "Base",
  43114: "Avalanche C-Chain",
  250: "Fantom",
  100: "Gnosis",
};
