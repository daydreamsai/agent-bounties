# GasRoute Oracle — Aura116

**Bounty:** [#4 GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)  
**Submitter:** Joshua L. Lopez (GitHub: [DocGrok1](https://github.com/DocGrok1))  
**Entity:** DCGP AI LLC  

## Description

Multi-chain GasRoute oracle that selects the cheapest chain and timing hint for a swap or contract call. Accepts `chain_set`, `calldata_size_bytes`, and `gas_units_est`; returns `chain`, `fee_native`, `fee_usd`, `busy_level`, and `tip_hint`. Uses live network fee history so estimates track current conditions; next-block base fee matches protocol computation. Ethereum tip uses a regime-gated 11-swing estimator.

## Live deployment

- **URL:** https://aura116.ai/api/gasroute
- **Entrypoint:** `POST https://aura116.ai/api/gasroute`
- **x402:** yes (USDC on Base; CDP facilitator; unpaid → HTTP 402)
- **Status check:** `GET https://aura116.ai/api/gasroute?status=1` → `payment_configured: true`, x402 version 2
- **Live on:** main @ `23e746f8` (America/Chicago ~7:22 AM Nov 6, 2026)

## Acceptance

- Fee estimate within 5% of actual transaction cost: **PASS**
  - Default suite overall mean **1.42%** (ETH 2.02%, Polygon 0.82%, median 0.74%)
  - 20-sample / 60-block suite overall mean **2.42%** (ETH 4.00%, Polygon 0.84%, median 0.81%)
  - Proof: https://github.com/DocGrok1/Aura116/actions/runs/42223329280 @ `d32a69fd7681b9c7383095f5d0b7f8b530e1c6af`
- Accounts for current network conditions: yes
- Deployed on a domain and reachable via x402: yes

## Source

https://github.com/DocGrok1/Aura116

## Solana wallet (payout)

`HsPTbnGZh68r8qBqFfW5pHZo4jcnH5yaCpCUDkn3wubH`