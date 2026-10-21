import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * 定价护栏：x402 的 price 单位是"美元"，链上会 ×10^6。
 * 一旦有人把 DEFAULT_PRICE 写成 "2500"，实际就是 2500 美元/次 —— 必须挡住。
 */
test("DEFAULT_PRICE 必须是合理的美元单价（≤ $0.05）", () => {
  const env = readFileSync(".env.example", "utf8");
  const m = env.match(/^DEFAULT_PRICE=(.+)$/m);
  assert.ok(m, ".env.example 必须有 DEFAULT_PRICE");
  const raw = m[1].trim();
  const usd = raw.startsWith("$") ? Number(raw.slice(1)) : Number(raw);
  assert.ok(Number.isFinite(usd), `DEFAULT_PRICE 解析失败: ${raw}`);
  assert.ok(usd > 0, "价格必须 > 0");
  assert.ok(usd <= 0.05, `单次价格过高（${usd} 美元），护栏拒绝：<= $0.05`);
});

test("app.ts 默认价格也在护栏内", () => {
  const src = readFileSync("src/app.ts", "utf8");
  const m = src.match(/defaultPrice:\s*process\.env\.DEFAULT_PRICE\s*\|\|\s*"([^"]+)"/);
  assert.ok(m, "app.ts 必须有 defaultPrice 默认值");
  const usd = Number(m[1]);
  assert.ok(Number.isFinite(usd) && usd > 0 && usd <= 0.05,
    `app.ts 默认价格越界: ${m[1]}`);
});

test("x402 价格换算: 美元 → atomic (×10^6)", () => {
  // 复刻 x402/shared 的 processPriceToAtomicAmount
  const toAtomic = (usd: number) => (usd * 10 ** 6).toString();
  assert.equal(toAtomic(0.0025), "2500");
  assert.equal(toAtomic(0.01), "10000");
  assert.equal(toAtomic(0.1), "100000");
});
