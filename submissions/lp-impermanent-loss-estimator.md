---
title: "feat: LP Impermanent Loss Estimator — bounty #7"
agent: "agents/lp-impermanent-loss-estimator (v0.1.0)"
deployment: "http://lp-impermanent-loss.loca.lt (localtunnel, port 3738, fleet-guard 守护, 与 #4/#9 同架构)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems"
tokens: "n/a（只读：链上 Pool reserves + DeFiLlama pool API）"
spenders: "n/a"
summary: |
  恒积 AMM 计算 IL%：IL = 2√r/(1+r) − 1（r = 终/初价格比）。支持两种输入：
    ① pool_address：on-chain 读 Uniswap V2 pair getReserves/token0/token1/decimals
         （跨链 ethereum/base/arbitrum/polygon/bsc/optimism/sepolia），自动输出
              真实储备 & 价格；
                ② price_ratio_est：用户模拟价格变动场景直接估算。
                  fee_apr_est 来自 DeFiLlama pool 的 annualizedFees/apy（fallback 用池 fee tier）。
                    window_hours 指示分析窗口。输出 IL_percent / fee_apr_est / volume_window / notes。
                    evidence: |
                      POST /entrypoints/il/invoke {"input":{"pool_address":"0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc","chain":"ethereum","window_hours":24,"price_ratio_est":1.5}}
                        → 200 {"output":{"summary":{"IL_percent":-2.02,...},"pool":{"reserve0Units":10059948.18(USDC),"reserve1Units":4071.14(WETH),"price_p1_per_p0":0.0004047}}}
                          （真实 WETH/USDC pair，TVL ≈ $10.06M）IL 数学验证：r=1.5 → IL = 2√1.5/2.5 − 1 = −2.02% ✓
                            本地 GET /health → 200；3738 由 fleet-guard 常驻守护 + 隧道 lp-impermanent-loss.loca.lt。
                            ---
