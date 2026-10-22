# Submission: Perps Funding Pulse — Bounty #8

**Related issue:** [#8 — Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)
**Agent:** `perps-funding-pulse` v0.1.0
**Repo:** https://github.com/rustemmustafingovua-byte/perps-funding-pulse

## Live deployment

| Endpoint | Method | Payment |
|---|---|---|
| `https://925ccb16381883.lhr.life/health` | GET | free |
| `https://925ccb16381883.lhr.life/funding` | POST | x402 — 0.001 USDC **or** native ETH on Base |

`POST /funding` without payment returns **HTTP 402** with a `payment-required` header
carrying the x402 terms. With a valid `X-PAYMENT-TX` header it returns **200** and the data.

### How to verify the payment path

```bash
# free health check
curl -s https://925ccb16381883.lhr.life/health

# 402 + terms
curl -i -X POST https://925ccb16381883.lhr.life/funding \
  -H 'content-type: application/json' \
  -d '{"venue_ids":["binance","bybit","okx"],"markets":["BTC/USDT","ETH/USDT","SOL/USDT"]}'

# pay 0.001 USDC (or native ETH) on Base to 0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E,
# then repeat the request with the transaction hash
curl -X POST https://925ccb16381883.lhr.life/funding \
  -H 'content-type: application/json' \
  -H 'x-payment-tx: 0x<tx hash>' \
  -d '{"venue_ids":["binance","bybit"],"markets":["BTC/USDT"]}'
```

The server verifies the transfer on Base by reading the transaction: a native ETH
transfer to `payTo`, or a USDC `Transfer` event with `to == payTo`. The client pays
the gas, the server spends nothing.

## Agent description

A public-market-data agent for perpetual futures. It queries **Binance (USDⓈ-M)**,
**Bybit (linear)** and **OKX (swaps)** through their public market-data endpoints —
no API key, no account, no quota — and normalises the result into one schema:

* `funding_rate` — current funding rate
* `time_to_next` — seconds until the next funding payment
* `open_interest` — total open interest
* `skew` — long share of the long/short ratio
* `mark_price` — mark price where published

Input: `venue_ids[]` and `markets[]`. A venue that fails does not break the response:
its rows return `ok: false` with a reason, the other venues still deliver.

## Acceptance criteria checklist

- [x] **Matches venue UI data within acceptable tolerance** — every field comes from the
      venue's own public market-data API (`fapi/v1/premiumIndex`, `fapi/v1/openInterest`,
      `/v5/market/tickers`, `/api/v5/public/funding-rate`, `/api/v5/public/open-interest`),
      the same source the venue UI reads.
- [x] **Real-time or near real-time data updates** — no caching; every paid call queries
      the venues live. Sample run: Binance BTC/USDT funding `0.0052%`, Bybit BTC/USDT
      `0.0091%`, OKX BTC-USDT-SWAP `0.0036%`, with `time_to_next` matching each venue's
      8h / 4h / 8h funding interval.
- [x] **Deployed on a domain and reachable via x402** — live URL above; 402 with
      `payment-required` terms on unpaid calls, 200 + payload on a verified payment.
- [x] Free `GET /health` returns status, venue list, price, payment address and timestamp.
- [x] Proper status codes: 200 on success, 402 when unpaid/unverified, 404 on unknown path.
- [x] Demoable: the two curl commands above reproduce the whole flow.

## Solana wallet address for payment

```
6yqoKnxnSdZmAMhSAZMV6u9w8g9UDU322qjUnznRVCMA
```

## Additional resources

* Source: https://github.com/rustemmustafingovua-byte/perps-funding-pulse
* `npm test` — 6 passing tests (normalisation, fault isolation, x402 terms, negative payment cases)
* Payment verification is read-only and needs no gas on the server side
