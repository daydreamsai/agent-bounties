---
title: "feat: GasRoute Oracle — bounty #4"
agent: "agents/gasroute-oracle (v0.1.0)"
deployment: "http://gasroute-oracle.loca.lt (localtunnel, port 3737, fleet-guard 守护)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems（同一命令设置 env）"
tokens: "原生代币 USD 定价：ethereum/binancecoin/matic-network via CoinGecko（fallback 静态价）"
spenders: "n/a（只读 RPC：publicnode/dataseed/optimism.io/fantom/avax 全链 baseFee + estimateFeesPerGas）"
summary: |
  多链实时 gas 费用对比：读 EIP-1559 baseFeePerGas + maxPriorityFeePerGas，按请求的
    calldata_size_bytes/gas_units_est 计算 (fee_native, fee_usd)，busy_level 拥堵分级
      (baseFee<25gwei=low / <100=medium / ≥100=high)，tip_hint 时序建议（send now / wait）。
        L1 数据可用性溢价（rollup: optimism/base/arbitrum 按 calldata×16 gas）已计入。
          路由推荐当前最低 fee_usd 的链。实测 6 链对比：base $0.0019（推荐,low）< BSC $0.0032 <
            Ethereum $0.016 < Polygon $0.0177（high,建议等待）< Arbitrum…——符合跨链直觉。
            evidence: |
              POST /entrypoints/gasroute/invoke {"input":{"chain_set":["base","ethereum","polygon","bsc","arbitrum","optimism"],"calldata_size_bytes":420,"gas_units_est":100000}}
                → 200 {"status":"succeeded","output":{"summary":{"recommended_chain":"base","recommended_fee_usd":0.001921,"best_timing_hint":"send now"},...}}
                  本地 GET /health → {ok:true}; 3737 由 fleet-guard 常驻守护。
                  ---
