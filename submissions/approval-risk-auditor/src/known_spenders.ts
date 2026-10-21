/**
 * 常见被授权的大户 spender 名单。
 *
 * ⚠️ 名单里每个地址都用 scripts/verify_spenders.ts 通过 eth_getCode 在主网验证过
 *    （有 code 才是真合约）；验证不通过的地址已剔除。
 *    checksum 由 scripts/gen_known_spenders.ts 用 viem getAddress 计算，不手写。
 *    重新验证: npx tsx scripts/verify_spenders.ts
 *    重新生成: npx tsx scripts/gen_known_spenders.ts
 */

export interface KnownSpender {
  name: string;
  /** EIP-55 checksum 地址 */
  address: string;
  note?: string;
}

export const KNOWN_SPENDERS: KnownSpender[] = [
  {
    name: "Uniswap V3 SwapRouter02",
    address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    note: "Uniswap V3 路由器 —— 历史上最常见的“无限授权”目标",
  },
  {
    name: "Uniswap V2 Router",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  {
    name: "Uniswap Universal Router v1.02",
    address: "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B",
  },
  {
    name: "Uniswap Universal Router v2",
    address: "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af",
  },
  {
    name: "Permit2 (Uniswap)",
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    note: "Permit2 是授权协议层：其额度模型不是普通 ERC-20 allowance，命中时按 spender_note 标注，不误判为 unlimited",
  },
  {
    name: "1inch V6 Aggregation Router",
    address: "0x111111125421cA6dc452d289314280a0f8842A65",
  },
  {
    name: "0x Exchange Proxy",
    address: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  },
  {
    name: "ParaSwap Augustus v6",
    address: "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57",
  },
  {
    name: "CoW Protocol GPv2 Settlement",
    address: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
  },
  {
    name: "Aave V3 Pool (eERC20 / aToken)",
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  },
  {
    name: "Balancer Vault",
    address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  },
  {
    name: "Lido stETH",
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    note: "stETH 授权给 Lido WithdrawalQueue 的历史攻击面",
  },
  {
    name: "Across SpokePool",
    address: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  },
];
