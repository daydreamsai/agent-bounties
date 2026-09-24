---
title: "feat: Slippage Sentinel — bounty #3"
agent: "agents/slippage-sentinel (v0.1.0)"
deployment: "http://slippage-sentinel-mtu9.loca.lt (localtunnel, port 3728)"
x402: "ADDRESS=0x52Ac54147B6D4ED35dA48e8560f4B5B7c2216130 DEFAULT_PRICE=0.01 NETWORK=base FACILITATOR=facilitator.daydreams.systems（同一命令设置 env）"
tokens: "USDT/USDC/WETH/DAI/WBTC/LINK 等（见 agents/slippage-sentinel/src/index.js TOKENS 常量）"
spenders: "Uniswap V2 Router, V3 SwapRouter, 1inch Router V5, Permit2, Aave V3, Lido, Compound"
summary: |
  审计 wallet ERC-20 当前 allowance，输出 unlimited/active 标记 + revoke tx data。
    关键差异：使用 allowance() 状态读取而非 getLogs，规避免费 RPC archive 门槛，兼容 publicnode/mainnet 无 token 情况。
      实测 vitalik 主网返回 4 条 unlimited（USDT/WBTC/LINK→Uniswap V3 SwapRouter, DAI→Permit2），自家钱包 Base+Sepolia 0 条（合理）。
      evidence: |
        screenshot to be captured after deployment (agent running on localtunnel, invoke returns 402 paywall when unpaid)
        ---
