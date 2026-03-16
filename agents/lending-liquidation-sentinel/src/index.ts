import { createAgent, http } from "@lucid-dreams/agent-kit";

interface BorrowPosition {
  protocol: string; wallet: string; collateralAsset: string; collateralValueUSD: number;
  borrowAsset: string; borrowValueUSD: number; healthFactor: number;
  liquidationThreshold: number; riskLevel: "safe" | "warning" | "danger" | "liquidation";
}

function assessRisk(hf: number): BorrowPosition["riskLevel"] {
  if (hf <= 1.0) return "liquidation";
  if (hf <= 1.1) return "danger";
  if (hf <= 1.3) return "warning";
  return "safe";
}

async function fetchMarginfi(wallet: string): Promise<BorrowPosition[]> {
  try {
    const r = await fetch(`https://api.marginfi.com/api/v1/user/${wallet}/accounts`, { headers: { Accept: "application/json" } });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    return d.map((a: any) => {
      const col = Number(a.collateralValue || 0);
      const bor = Number(a.borrowValue || 0);
      const hf = bor > 0 ? col / bor : Infinity;
      return { protocol: "marginfi", wallet, collateralAsset: a.collateralAsset || "unknown",
        collateralValueUSD: col, borrowAsset: a.borrowAsset || "unknown", borrowValueUSD: bor,
        healthFactor: Math.round(hf * 1000) / 1000, liquidationThreshold: Number(a.liquidationThreshold || 0.85),
        riskLevel: assessRisk(hf) };
    });
  } catch { return []; }
}

async function fetchSolend(wallet: string): Promise<BorrowPosition[]> {
  try {
    const r = await fetch(`https://api.solend.fi/v1/users/${wallet}/positions`, { headers: { Accept: "application/json" } });
    if (!r.ok) return [];
    const d = await r.json();
    if (!d?.positions) return [];
    return d.positions.map((p: any) => {
      const col = Number(p.depositsValue || 0);
      const bor = Number(p.borrowsValue || 0);
      const hf = bor > 0 ? col / bor : Infinity;
      return { protocol: "solend", wallet, collateralAsset: p.deposits?.[0]?.symbol || "unknown",
        collateralValueUSD: col, borrowAsset: p.borrows?.[0]?.symbol || "unknown", borrowValueUSD: bor,
        healthFactor: Math.round(hf * 1000) / 1000, liquidationThreshold: Number(p.liquidationThreshold || 0.8),
        riskLevel: assessRisk(hf) };
    });
  } catch { return []; }
}

const agent = createAgent({
  name: "lending-liquidation-sentinel",
  description: "Monitor borrow positions for liquidation risk",
  routes: [
    http.get("/health-factor", async ({ query }) => {
      const q = query as any;
      if (!q?.wallet) return { status: 400, body: { error: "Missing: wallet" } };
      const proto = q?.protocol;
      let positions: BorrowPosition[] = [];
      if (!proto || proto === "marginfi") positions.push(...(await fetchMarginfi(q.wallet)));
      if (!proto || proto === "solend") positions.push(...(await fetchSolend(q.wallet)));
      return { status: 200, body: { agent: "lending-liquidation-sentinel", wallet: q.wallet,
        positions, summary: { safe: positions.filter(p => p.riskLevel === "safe").length,
          warning: positions.filter(p => p.riskLevel === "warning").length,
          danger: positions.filter(p => p.riskLevel === "danger").length,
          liquidation: positions.filter(p => p.riskLevel === "liquidation").length }}};
    }),
    http.get("/risk", () => ({ status: 200, body: { agent: "lending-liquidation-sentinel",
      riskLevels: { safe: "Health factor > 1.3", warning: "1.1 - 1.3", danger: "1.0 - 1.1", liquidation: "≤ 1.0" },
      supportedProtocols: ["marginfi", "solend"] }})),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "lending-liquidation-sentinel" } })),
  ],
});
export default agent;
