---
title: "feat: Lending Liquidation Sentinel — bounty #9"
agent: "agents/lending-liquidation-sentinel (v0.1.0)"
deployment: "http://lending-sentinel.loca.lt (localtunnel, port 3736)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems（同一命令设置 env）"
tokens: "Aave V3 全部储备资产（读 getUserAccountData，含 collateral/debt/available 的 base 计价 USD）"
spenders: "Aave V3 Pool：Ethereum 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 / Polygon / Arbitrum 0x794a61358D6845594F94dc1DB02A252b5b4814aD / Base 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 / BSC 0xff75A6B56E85cD442C8eD9ABa36d2b6C2807a545 / Sepolia 0x6Ae43d3271ff6888e7Ffc46f45E8E3B199FDd2f3"
summary: |
  扫描 wallet 在 Aave V3 的借贷健康度：读链上 getUserAccountData 得 totalCollateralBase/totalDebtBase/availableBorrowsBase/healthFactor。
    输出 health_factor、buffer_percent、alert_threshold_hit（默认阈值 1.3，可调 0.1-10），
      健康因子 ≤ 阈值即触发清算提醒。全程只读链上、无私钥、免 archive RPC。
        实测入口 /entrypoints/liquidation/invoke 返回 200；vitalik 主网无 Aave 头寸（tracked=false，符合）。
          x402 配置已绑定 ADDRESS/PORT/FACILITATOR，公网经 fleet-guard 守护的 localtunnel 隧道可达。
          evidence: |
            invoke: POST /entrypoints/liquidation/invoke {"input":{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chains":["ethereum"]}} → 200
              {output:{summary:{activePositions:0,alerts:0},positions:[{chain:"ethereum",protocol:"Aave V3",tracked:false}]}}
                本地 GET /health → {ok:true}; 3736 由 fleet-guard 常驻守护,隧道进程 --subdomain lending-sentinel 运行中。
                ---
