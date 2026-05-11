/**
 * Type definitions for approval risk auditor
 */

export interface Approval {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenType: "ERC20" | "ERC721" | "ERC1155";
  tokenId?: string; // For ERC-721
  spender: string;
  spenderName?: string; // Known protocol name
  amount: string;
  isUnlimited: boolean;
  blockNumber: number;
  timestamp: number; // Unix timestamp of the approval tx
  txHash: string;
  chain: string;
  chainId: number;
}

export interface RiskFlag {
  approvalIndex: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
}

export interface RevokeTxData {
  chain: string;
  chainId: number;
  tokenAddress: string;
  spender: string;
  tokenType: string;
  to: string; // Contract to call
  data: string; // Calldata for revoke
  value: string; // 0x0 for approvals
  gasEstimate?: string;
  description: string;
}

export interface AuditResult {
  wallet: string;
  approvals: Approval[];
  riskFlags: RiskFlag[];
  revokeTxData: RevokeTxData[];
  summary: {
    totalApprovals: number;
    unlimitedCount: number;
    staleCount: number;
    criticalCount: number;
    highCount: number;
    chainsScanned: string[];
    overallRiskScore: number;
  };
}

export interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  input: string;
}

export interface EtherscanLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  transactionHash: string;
  logIndex: string;
}

// Known spenders mapped to protocol names
export const KNOWN_SPENDERS: Record<string, string> = {
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
  "0x0000000000007f150bd6f54c40a34d7c3d5e9f56": "Uniswap Permit2",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Uniswap Permit2",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": "SushiSwap Router",
  "0xfcb155c2e0022a43a0e6b45b7e032262c8ae6eda": "Aave V2 LendingPool",
  "0x41393e5e337606dc11c2bb0d4f68d2023b24a2c9": "Aave V3 Pool",
  "0x0000000000000000000000000000000000000001": "ERC-20 Permit2",
  "0x0000000000000ad24e80fd803c6ac37206a45f15": "Uniswap UniversalRouter",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap UniversalRouter",
  "0x0000000000000c30d1b3a4b5c12e1d1f5e5d6d5a": "Blur Marketplace",
  "0x0000000000001ff3684f27cca1a7252b3f2c2b5d": "Blend (Blur)",
  "0x39da41747a83aee658334415666f3ef92dd0d541": "Blur",
  "0x1e0049783f008a0085193e00003d00cd54003c71": "OpenSea Seaport 1.1",
  "0x00000000006c3852cbef3e08e8df289169ede581": "OpenSea Seaport 1.5",
  "0x000000000000ad05ccc4f10045630fb830b95127": "OpenSea Seaport 1.6",
  "0xa5409ec958c83c3f309868babaca7c86dcb077c1": "OpenSea Registry",
  "0xfed24ec7e22f573d2d6d0f9c9a0f0fdb5c2e9a1f": "LooksRare",
  "0x0000000000e655fae079d09dbe70a03e68d56cfb": "X2Y2",
  "0x74312363e45dcaba76c59ec49a7aa8a65a67eed3": "ParaSwap",
  "0x216b4b4ba9f3e719726886d34a177484278bfcae": "Paraswap Augustus",
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch Router V5",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch Router V6",
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "Aave V2 LendingPool",
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "Lido stETH",
  "0x0000000000a39bb272e79075ade125fd3512acb0": "MetaMask Swap Router",
  "0x881d40237659c251811cec9c364ef91dc08d300c": "MetaMask Swap Router",
  "0xdf1a1b60f2d438842b0b12494fe0d9d12da85665": "Lens Protocol",
};

// Top tokens by market cap to focus scanning on
export const TOP_TOKENS: Record<number, string[]> = {
  1: [
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0x853d955acef822db058eb8505911ed77f175b99e", // FRAX
    "0x4fabb145d64652a948d72533023f6e7a623c7c53", // BUSD
    "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
    "0x3845badade8e6dff049820680d1f14bd3903a5d0", // SAND
    "0x0f5d2fb29fb7d3cfee444a200298f468908cc942", // MANA
    "0xba100000625a3754423978a60c9317c58a424e3d", // BAL
    "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f", // SNX
  ],
  137: [
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT
    "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
    "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC
    "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39", // LINK
    "0xd6df932a45c0f255f85145f286ea0b292b21c90b", // AAVE
    "0xb33eaad8d922b1083446dc23f610c2567fb5180f", // UNI
  ],
  56: [
    "0x55d398326f99059ff775485246999027b3197955", // USDT
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // DAI
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
    "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
    "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
    "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  ],
  42161: [
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", // WBTC
    "0x912ce59144191c1204e64559fe8253a0e49e6548", // ARB
  ],
  10: [
    "0x4200000000000000000000000000000000000006", // WETH
    "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
    "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    "0x4200000000000000000000000000000000000042", // OP
  ],
  8453: [
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
    "0x4200000000000000000000000000000000000006", // WETH
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", // USDbC
  ],
  43114: [
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
    "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", // USDT
    "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI
    "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", // WETH
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
  ],
};
