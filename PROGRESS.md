# PROGRESS.md — agent-bounties

> 墨子 Harness · 自动生成于 2026-07-09

---

## ✅ 已完成

- [x] Harness 初始化 (AGENTS.md + PROGRESS.md + setup.sh)
- [x] 创建 package.json + tsconfig.json
- [x] 安装 @lucid-dreams/agent-kit + zod 依赖
- [x] 实现 Slippage Sentinel agent 核心逻辑
- [x] 为 `estimate-slippage` / `echo` entrypoint 增加 x402-ready 配置（`paymentsFromEnv` + per-entrypoint price/network）
- [x] 新增 `DEPLOYMENT.md`，记录 domain/x402 环境变量与验证命令
- [x] 固定 pnpm 11 build-script policy，避免依赖安装门禁阻塞四条 Harness 命令
- [x] type-check ✅ (`pnpm type-check`)
- [x] test ✅ (`pnpm test`)
- [x] lint ✅ (`pnpm lint`)
- [x] build ✅ (`pnpm build`)

---

## 🔄 进行中

- PR #294 等待维护者 review / merge
- 外部 live domain 部署仍需要真实 host、domain、payment address/facilitator 配置

---

## 📋 待办

- [ ] NEO 提供可用外部部署目标 + x402 settlement address 后，部署并回填 live URL
- [ ] 用公开 URL 验证 `/health`、`/entrypoints`、`/.well-known/agent.json`、x402 paid invoke

---

## ⚠️ 已知问题

- 当前工作区没有 Vercel/Wrangler/Fly/Railway/Cloudflared CLI，也没有可写入的外部 domain/payment 凭据；因此本轮只能补齐 x402-ready 代码与部署说明，不能完成真实公网部署。
- 链上数据源仍为确定性 demo provider；生产部署时应替换为 DEX subgraph/RPC 数据源。
