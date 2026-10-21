/**
 * 生成 src/known_spenders.ts —— 地址 checksum 由 viem getAddress 计算，杜绝手打错误。
 * 输入列表里的地址必须先通过 eth_getCode 验证是真实合约（见 verify_spenders.ts）。
 */
import { getAddress } from "viem";
import { writeFileSync } from "node:fs";

const VERIFIED: [string, string, string?][] = [
  ["Uniswap V3 SwapRouter02", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", "Uniswap V3 路由器 —— 历史上最常见的“无限授权”目标"],
  ["Uniswap V2 Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", undefined],
  ["Uniswap Universal Router v1.02", "0xef1c6E67703c7BD7107eed8303Fbe6EC2554BF6B", undefined],
  ["Uniswap Universal Router v2", "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af", undefined],
  ["Permit2 (Uniswap)", "0x000000000022D473030F116dDEE9F6B43aC78BA3", "Permit2 是授权协议层：其额度模型不是普通 ERC-20 allowance，命中时按 spender_note 标注，不误判为 unlimited"],
  ["1inch V6 Aggregation Router", "0x111111125421cA6dc452d289314280a0f8842A65", undefined],
  ["0x Exchange Proxy", "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", undefined],
  ["ParaSwap Augustus v6", "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57", undefined],
  ["CoW Protocol GPv2 Settlement", "0x9008D19f58AAbD9eD0D60971565AA8510560ab41", undefined],
  ["Aave V3 Pool (eERC20 / aToken)", "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", undefined],
  ["Balancer Vault", "0xBA12222222228d8Ba445958a75a0704d566BF2C8", undefined],
  ["Lido stETH", "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", "stETH 授权给 Lido WithdrawalQueue 的历史攻击面"],
  ["Across SpokePool", "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5", undefined],
];

const entries = VERIFIED.map(([name, addr, note]) => {
  const cs = getAddress(addr.toLowerCase());
  const n = note ? `\n    note: ${JSON.stringify(note)},` : "";
  return `  {\n    name: ${JSON.stringify(name)},\n    address: ${JSON.stringify(cs)},${n}\n  },`;
});

const content = `/**
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
${entries.join("\n")}
];
`;

writeFileSync("src/known_spenders.ts", content, "utf8");
console.log("已生成 src/known_spenders.ts，共", entries.length, "个已验证地址");
for (const [name, addr] of VERIFIED) {
  console.log("  ", getAddress(addr.toLowerCase()), name);
}
