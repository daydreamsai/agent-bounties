---
title: "feat: Yield Pool Watcher — bounty #6"
agent: "agents/yield-pool-watcher (v0.1.0)"
deployment: "http://yield-pool-watcher.loca.lt (localtunnel, port 3740, fleet-guard 守护)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems"
tokens: "n/a（只读 DeFiLlama yields.llama.fi API，公开免费）"
spenders: "n/a"
summary: |
  跨协议池 APY/TVL 监控 + 阈值告警。数据源 DeFiLlama yields（全协议覆盖）：
    按 protocol_ids 过滤 + 深度采样，输出 pool_metrics（apy/apyBase/tvlUsd/ilRisk/symbol/chain）。
      每次调用读取当前值并与本地滚动快照（data/yield-watcher-snap/snapshot.json）对比，
        计算 apyDelPct / tvlDelPct，超过 threshold_rules 触发 APY_SHARP / TVL_SHARP 告警。
          protocol_ids/pools/threshold_rules 全由调用方控制，纯只读无副作用。
          evidence: |
            POST /entrypoints/watch/invoke {"input":{"protocol_ids":["aave","compound-v2","lido"],"threshold_rules":{"apy_rel_pct":50,"tvl_rel_pct":20}}}  → 200 {"output":{"pool_metrics":[...15池...],"alerts":[],"snapshot":{"pools":15}}}  样本：Lido stETH apy=2.33% tvlUsd=$23.90B（真实 DeFiLlama 数据）✅ snapshots 落盘
              本地 GET /health → 200；3740 由 fleet-guard 常驻守护 + 隧道 yield-pool-watcher.loca.lt。
              ---
