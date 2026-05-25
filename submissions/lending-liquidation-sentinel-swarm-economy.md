# Lending Liquidation Sentinel — Swarm Economy

## Agent Description

**Lending Liquidation Sentinel** monitors Aave v3 borrow health and warns before liquidation risk.

- **Entrypoint:** `POST /entrypoints/watch/invoke`
- **Inputs:** `wallet`, `protocol_ids`, `positions[]`, `alert_threshold`
- **Outputs:** `health_factor`, `liq_price`, `buffer_percent`, `alert_threshold_hit` per protocol/position

## Live Deployment

- **Health:** `http://127.0.0.1:8099/health`
- **x402:** paywall on `/entrypoints/watch/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/lending-liquidation-sentinel/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/lending-liquidation-sentinel

## Related Bounty

Closes #9

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] Aave v3 health factor + liquidation price estimates on Base / Ethereum / Arbitrum / Optimism
- [x] Alert fires when health factor drops below configurable threshold (default 1.05)
- [x] x402 paywall on invoke endpoint

## Test

```bash
curl -s http://127.0.0.1:8099/health
npx tsx -e "import { fetchLiquidationSentinel } from './src/protocols.ts'; fetchLiquidationSentinel({ wallet:'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', protocol_ids:['aave-v3-base'], positions:[], alert_threshold:1.05 }).then(r=>console.log(JSON.stringify(r,null,2)));"
```
