/**
 * 真实冒烟测试：用公共 RPC 真跑一次审计，验证输出结构与实际链上数据。
 *   npx tsx scripts/smoke.ts
 */
import { auditWallet } from "../src/auditor.js";

const WALLETS = [
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
];

for (const wallet of WALLETS) {
  console.log("=".repeat(70));
  console.log("审计:", wallet);
  console.log("=".repeat(70));
  try {
    const t0 = Date.now();
    const r = await auditWallet({ wallet, chains: [1], top_token_limit: 6 });
    console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log("summary:", JSON.stringify(r.summary));
    console.log("approvals:", r.approvals.length, "| risk_flags:", r.risk_flags.length,
                "| revoke_tx:", r.revoke_tx_data.length);
    for (const a of r.approvals.slice(0, 6)) {
      console.log(`  - ${a.token_symbol} spender=${a.spender} value=${a.value.slice(0, 24)}… ` +
                  `unlimited=${a.unlimited} src=${a.source} ts=${a.last_approved_at ?? "-"}`);
    }
    for (const f of r.risk_flags.slice(0, 6)) {
      console.log(`  ! [${f.severity}] ${f.risk}: ${f.detail.slice(0, 110)}`);
    }
    if (r.revoke_tx_data[0]) {
      console.log("  revoke sample:", r.revoke_tx_data[0].data.slice(0, 74) + "…");
    }
    console.log("  notes:");
    for (const n of r.notes) console.log("   -", n.slice(0, 150));
  } catch (e) {
    console.log("  ERROR:", String(e).slice(0, 300));
  }
  console.log();
}
