/**
 * 验证 known spenders: 是否为真合约 + 正确 checksum。
 * 只保留链上确实有 code 的地址。
 */
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const CANDIDATES = [
  ["Uniswap V3 SwapRouter02", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],
  ["Uniswap V2 Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"],
  ["Permit2", "0x000000000022D473030F116dDEE9F6B43aC78BA3"],
  ["1inch V5 Router", "0x1111111254EEB25477B68fb85Ed929B73A7d894F"],
  ["CoW VaultRelayer", "0xC92E8bdf79f0C7cBf174B43D3F4A1f9B3F4D79f8"],
  ["Aave V3 Pool", "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"],
  ["Uniswap Universal Router", "0x3fC91A3afd70395Cd496C647d5aCcC3e91a30798"],
  ["1inch V6 Router", "0x111111125421ca6dc452d289314280a0f8842a65"],
  ["0x Exchange Proxy", "0xDef1C0ded9bec7F1a1670819833240f027b25EfF"],
  ["0x Exchange Proxy (v2)", "0xba0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0"],
  ["ParaSwap Augustus", "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57"],
  ["SushiSwap Router", "0xd9e1cE17f2641f24aE8D1B8Ee7e3D3C7b5a4b9c0"],
];

const rpcUrls = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth-mainnet.public.blastapi.io",
];

async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j: any = await r.json();
  if (j?.error) throw new Error(j.error.message);
  return j.result;
}

async function checksum(addr: string) {
  const { getAddress } = await import("viem");
  try { return getAddress(addr); } catch { return null; }
}

for (const [name, addr] of CANDIDATES) {
  let code = "0x";
  for (const u of rpcUrls) {
    try {
      code = await rpc(u, "eth_getCode", [addr, "latest"]);
      if (code && code !== "0x") break;
    } catch { /* next */ }
  }
  const isContract = !!code && code !== "0x";
  const cs = await checksum(addr);
  console.log(
    `${isContract ? "✅" : "❌"} ${name.padEnd(26)} ${addr}` +
    `  contract=${isContract} checksum=${cs ?? "(invalid)"}`
  );
}
