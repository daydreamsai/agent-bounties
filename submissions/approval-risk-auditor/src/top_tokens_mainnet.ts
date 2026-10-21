/**
 * 顶级 ERC20 合约列表（Ethereum Mainnet）
 *
 * 数据来源: Uniswap 规范 token list（无需 API key）
 *   https://raw.githubusercontent.com/Uniswap/default-token-list/master/src/tokens/mainnet.json
 *   https://tokens.uniswap.org
 *
 * 选取规则: 规范列表中流动性/市值靠前的头部资产，作为"top tokens"审计覆盖范围。
 */

export interface TopToken {
  symbol: string;
  address: string;
  decimals: number;
  name: string;
}

export const TOP_TOKENS_MAINNET: TopToken[] = [
  { symbol: "WETH",  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, name: "Wrapped Ether" },
  { symbol: "DAI",   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, name: "Dai Stablecoin" },
  { symbol: "USDT",  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6,  name: "Tether USD" },
  { symbol: "USDC",  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6,  name: "USDCoin" },
  { symbol: "CRV",   address: "0xD533a949740bb3306d119CC777fa900bA034cd52", decimals: 18, name: "Curve DAO Token" },
  { symbol: "UNI",   address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, name: "Uniswap" },
  { symbol: "LINK",  address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, name: "ChainLink Token" },
  { symbol: "MKR",   address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", decimals: 18, name: "Maker" },
  { symbol: "COMP",  address: "0xc00e94Cb662C3520282E6f5717214004A7f26888", decimals: 18, name: "Compound" },
  { symbol: "ZRX",   address: "0xE41d2489571d322189246DaFA5ebDe1F4699F498", decimals: 18, name: "0x Protocol Token" },
  { symbol: "KNC",   address: "0xdd974D5C2e2928deA5F71b9825b8b646686BD200", decimals: 18, name: "Kyber Network Crystal" },
  { symbol: "BAND",  address: "0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55", decimals: 18, name: "Band Protocol" },
  { symbol: "NMR",   address: "0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671", decimals: 18, name: "Numeraire" },
  { symbol: "REPv2", address: "0x221657776846890989a759BA2973e427DfF5C9bB", decimals: 18, name: "Reputation Augur v2" },
  { symbol: "OXT",   address: "0x4575f41308EC1483f3d399aa9a2826d74Da13Deb", decimals: 18, name: "Orchid" },
];

export default TOP_TOKENS_MAINNET;
