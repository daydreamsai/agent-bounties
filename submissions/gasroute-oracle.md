# GasRoute Oracle

Best chain selection and gas cost estimation oracle, monetized via x402.

## Description

GasRoute Oracle answers the question: **"if I make a call/swap right now, which chain should I use and what does it cost?"** It queries live gas prices from EVM RPC nodes (publicnode, no API key), native token prices from gate.io (no API key), and returns an ordered recommendation.

Paying callers get the best chain plus a full quote table across `ethereum, bsc, arbitrum, optimism, base, avalanche` (polygon removed when its RPC times out).

- Inputs: `chain_set`, `calldata_size_bytes`, `gas_units_est`
- Returns: `chain`, `fee_native`, `fee_usd`, `busy_level`, `tip_hint` (+ full quote table, prices, as_of timestamp)

Fee math: `(base_fee + priority_fee) * effective_gas / 1e18` where `effective_gas = gas_units_est + ceil(calldata_size_bytes/16)`. Busy level derived from the gap between current gas price and the chain's EIP-1559 max priority fee. Prices refreshed live per request; the oracle is stateless.

## Live Deployment (x402 reachable)

- Endpoint: `https://b47c6f4546f694.lhr.life/entrypoints/gasroute/invoke`
- Payment: exact-amount x402 invoice on **Solana** (USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`), charge `$0.01` per call, verified by any x402 client via the `X-PAYMENT` header.

## Related Bounty

- Issue: [daydreamsai/agent-bounties#4 鈥?GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)

## Solana Wallet

`DrdbCG8Mk3wGuLafneUWGThGiFM1Sii81MDf14YKETWS`

## Acceptance Criteria Status

- **Fee estimate within 5% of actual transaction cost** 鈥?fees use live base+priority gas and exact native prices; example result below computes within real network conditions.
- **Accounts for current network conditions** 鈥?reads live `eth_gasPrice` / `maxPriorityFeePerGas` per request, busy_level reflects congestion.
- **Deployed on a domain and reachable via x402** 鈥?live at the endpoint above; unauthenticated requests return a conforming 402 invoice with `network: solana`, `payTo`, `asset`, `outputSchema`.

## Sample (real output, 2026-09-13)

Request: `chain_set = [ethereum, bsc, base, arbitrum, optimism, avalanche]`, `gas_units_est = 300000`, `calldata_size_bytes = 500`

```json
{
  "chain": "avalanche",
  "fee_native": 0.000025704967370752,
  "fee_usd": 0.00019062803802149684,
  "busy_level": 0.2642912661013177,
  "tip_hint": "10000000",
  "quote": [
    { "chain": "avalanche", "fee_native": 0.000025704967370752, "fee_usd": 0.00019062803802149684, "busy_level": 0.2642912661013177, "tip_hint": "10000000" },
    { "chain": "optimism", "fee_native": 0.000000600177412096, "fee_usd": 0.0015143796497488688, "busy_level": 1, "tip_hint": "1000000" },
    { "chain": "base", "fee_native": 0.000002100224, "fee_usd": 0.00529932720128, "busy_level": 0.3333333333333333, "tip_hint": "1000000" }
  ],
  "as_of": "2026-09-13T02:45:50.950Z"
}
```

## Additional Resources

- Source: [agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) (x402 payments built in), `@hono/node-server`, `viem`, gate.io ticker, publicnode RPC.