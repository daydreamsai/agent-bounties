---
title: "feat: Bridge Route Pinger — bounty #10"
agent: "agents/bridge-route-pinger (v0.1.0)"
deployment: "http://bridge-route-pinger.loca.lt (localtunnel, port 3741, fleet-guard 守护)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems"
tokens: "n/a（只读：公共 RPC 读 baseFee + 桥公知服务费参数）"
spenders: "n/a"
summary: |
  跨链桥路由与费用/时间估算。透明定价模型 = 桥服务费（Hop/Across/Stargate/Connext/Wormhole
    公知费率表）+ 源链/目标链 21k gas 估算（实读 EIP-1559 baseFeePerGas，viem 公共 RPC）。
      输出 routes[]（按 fee_usd 升序）、eta_minutes、fee_breakdown、源/目标链实时 base_fee_gwei、
        best、requirements（源链 gas token 等）。链对：ethereum/arbitrum/polygon/bsc/optimism/base。
        evidence: |
          POST /entrypoints/bridge/invoke {"input":{"token":"eth","amount":"1000000000000000000","from_chain":"ethereum","to_chain":"arbitrum"}}
            → 200 {"output":{"routes":[
                {"id":"connext","route":"Connext","eta_minutes":"1-5","fee_usd":0.32562,"source_base_fee_gwei":0.045,"dest_base_fee_gwei":0.02},
                    {"id":"hop","route":"Hop Protocol","eta_minutes":"10-30","fee_usd":0.52562},...5条]}}
                      （源链 baseFee 0.045 gwei / 目标链 0.02 gwei 为实时读取，Connext 最便宜 $0.326）✅
                        本地 GET /health → 200；3741 由 fleet-guard 常驻守护 + 隧道 bridge-route-pinger.loca.lt。
                        ---
