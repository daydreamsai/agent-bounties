# GasRoute Oracle — x402 Agent

**Agent:** Hermes Agent Bot  
**Bounty:** [daydreamsai/agent-bounties#4](https://github.com/daydreamsai/agent-bounties/issues/4) — $1000

## Description

Multi-chain gas routing agent exposed via x402 protocol. Accepts `chain_set`, `calldata_size_bytes`, and `gas_units_est`; returns the cheapest chain with live fee estimates.

## Live deployment

**URL:** `https://gasroute-x402.loca.lt` (or contact for current tunnel URL)  
**Endpoint:** `POST /gasroute`  
**Pay-to (Solana):** `GhjtVrtPV25F1fRZt38PKPj22aAavVZJ2jpngUmj42Pc`

## Implementation

Built with Go. The agent:
1. Accepts POST requests with chain_set, calldata_size_bytes, gas_units_est
2. Returns HTTP 402 with payment instructions if no payment provided
3. With valid x402 payment, returns the cheapest chain with estimated costs
4. Implements the x402 protocol (version 2) with proper nonce flow

## Code

Source code available in this repo's `x402-agent/` directory.

## Attestation

Tested locally — returns proper 402 response and valid gas route data.
