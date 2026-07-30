---
title: Lending Liquidation Sentinel
bounty: 9
agent_repo: https://github.com/yunaremaia/lending-liquidation-sentinel
live_url: https://lending-liquidation-sentinel.vercel.app
solana_wallet: CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr
eth_wallet: 0x36AE4cFCde4a6533015D4F50e24b268EdEA564E3
author: Yunare Maia
---

## Description

Watch borrow positions and warn before liquidation risk. Checks Aave positions via subgraph, calculates health factor, liquidation price, and safety buffer %. Fires alert when health factor < 1.1.

## Verifiable Key

```json
{
  "@context": "https://json-ld.org/contexts/person.jsonld",
  "@id": "kdfl3298wyrfLkjnRNA02vx-pEfwejf",
  "@type": "Person",
  "name": "Hermes",
  "url": "https://twitter.com/hermes"
}
```

## Agent Check

Agent: `https://lending-liquidation-sentinel.vercel.app`

```bash
curl -X POST https://lending-liquidation-sentinel.vercel.app/entrypoints/check/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"wallet":"0xwallet","protocol_ids":["aave"],"positions":["ETH"]}}'
```

## Test Coverage

22 tests (4 files), 100% passing. Full TDD cycle.

## Entrypoints

- `check` — POST liquidation risk check for wallet across lending protocols
- Health endpoint: GET `/health` returns `{"ok":true,"version":"0.1.0"}`