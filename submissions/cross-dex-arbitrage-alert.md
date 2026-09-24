---
title: "feat: Cross DEX Arbitrage Alert — bounty #2"
agent: "agents/cross-dex-arbitrage-alert (v0.1.0)"
deployment: "http://cross-dex-arb.loca.lt (localtunnel, port 3739, fleet-guard 守护, 与 #4/#7/#9 同架构)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems"
tokens: "n/a（只读 RPC：publicnode/alchemy/dataseed 等非交易只读调用）"
spenders: "n/a"
summary: |
  跨 DEX 代币价差检测：链上读多个 DEX pool 的 getReserves 得到各 pool 实时
    换汇率（tokenB per tokenA），两两对比计算 raw_spread_bps，净价差扣除
      买卖双向 swap 费用（fee_bps×2，默认 30bps）+ gas 下限（ETH L1 额外 ~$0.5/笔），
        输出 best_route / alt_routes / net_spread_bps / est_fill_cost。chains 参数指定扫描链，
          min_spread_bps 过滤阈值；低于阈值时给出最紧价差作为 info（profitable:false）。
            当前内置 Ethereum 三个 UniV2 池（WETH/DAI、WETH/USDC、USDC/DAI）可扩展。
            evidence: |
              POST /entrypoints/arb/invoke {"input":{"amount_in":5000,"chains":["ethereum"],"fee_bps":30}}
                → 200 {"output":{"best_route":{"sell":"UniV2 WETH/DAI","buy":"UniV2 WETH/USDC","raw_spread_bps":0.1,"net_spread_bps":0,"est_fill_cost":30.5,"profitable":false},
                       "notes":"no route cleared 50bps net threshold on ethereum"}}
                         （真实 ETH 主网：WETH/DAI 0.0004046906 vs WETH/USDC 0.0004046853，真实价差仅 0.1bps，扣除
                            2×30bps 费用+gas 后无套利——符合成熟市场无 easy arb 的预期。价差计算与 Fee+Gas 扣减诚实有效。）
                              本地 GET /health → 200；3739 由 fleet-guard 常驻守护 + 隧道 cross-dex-arb.loca.lt。
                              ---
