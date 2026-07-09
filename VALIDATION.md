# Acceptance Criteria Validation

## Bounty #1 Requirements

### ✅ Detect new pairs within 60 seconds of creation

**Validation Method:**
1. Monitor Alchemy Notify dashboard for webhook delivery timestamps
2. Compare webhook delivery time with pair creation block timestamp
3. Expected: < 10 seconds (webhook latency + Worker processing)

**Test Command:**
```bash
# Check health endpoint for last webhook timestamp
curl https://fresh-markets-watch.your-subdomain.workers.dev/health
```

**Success Criteria:**
- [ ] Webhook delivers within 5 seconds of pair creation
- [ ] Worker processes and stores pair within 10 seconds total
- [ ] 95% of pairs detected within 60 seconds

---

### ✅ False positive rate under 1%

**Validation Method:**
1. Query stored pairs via `/scan` endpoint
2. Verify each pair exists on-chain
3. Check transaction status for each pair

**Test Command:**
```bash
# Get recent pairs
curl -X POST https://fresh-markets-watch.your-subdomain.workers.dev/scan \
  -H "Content-Type: application/json" \
  -H "x402-payment: test-token" \
  -d '{"chain": "ethereum", "window_minutes": 10}'
```

**Manual Verification:**
For each returned pair:
1. Verify `pair_address` exists on Etherscan/BscScan
2. Verify `created_at` timestamp matches block timestamp
3. Verify transaction was successful (status = 1)

**Success Criteria:**
- [ ] All returned pairs exist on-chain
- [ ] All transactions have status = 1 (successful)
- [ ] No duplicate pairs in KV storage
- [ ] False positive rate < 1%

---

### ✅ Deploy on a domain reachable via x402

**Validation Method:**
1. Verify Worker is deployed and accessible
2. Test x402 payment middleware
3. Verify endpoints respond correctly

**Test Commands:**

Health endpoint (no payment required):
```bash
curl https://fresh-markets-watch.your-subdomain.workers.dev/health
```

Scan endpoint with payment:
```bash
curl -X POST https://fresh-markets-watch.your-subdomain.workers.dev/scan \
  -H "Content-Type: application/json" \
  -H "x402-payment: valid-payment-token" \
  -d '{"chain": "ethereum", "window_minutes": 5}'
```

Scan endpoint without payment (should fail):
```bash
curl -X POST https://fresh-markets-watch.your-subdomain.workers.dev/scan \
  -H "Content-Type: application/json" \
  -d '{"chain": "ethereum"}'
```

**Success Criteria:**
- [ ] Worker deployed and accessible via HTTPS
- [ ] GET /health returns 200 OK
- [ ] POST /scan with x402-payment header returns pairs
- [ ] POST /scan without payment returns error
- [ ] Cron job runs every 10 minutes

---

### ✅ Return all required fields

**Required Fields:**
- `pair_address` - New pair/pool address
- `tokens` - Token addresses in the pair
- `init_liquidity` - Initial liquidity
- `top_holders` - Top holder addresses
- `created_at` - Creation timestamp

**Validation Method:**
1. Query `/scan` endpoint
2. Verify response structure matches spec

**Expected Response Structure:**
```json
{
  "chain": "ethereum",
  "window_minutes": 5,
  "from_block": 12345678,
  "to_block": 12345700,
  "new_pairs": [
    {
      "pair_address": "0x1234...",
      "tokens": [
        {"address": "0xabc...", "symbol": "TK0"},
        {"address": "0xdef...", "symbol": "TK1"}
      ],
      "init_liquidity": {
        "token0_raw": "1000000000000000000",
        "token1_raw": "2000000000"
      },
      "top_holders": [
        "0xholder1...",
        "0xholder2..."
      ],
      "created_at": "2026-07-10T12:00:00.000Z"
    }
  ],
  "total_found": 1
}
```

**Success Criteria:**
- [ ] Response includes all required fields
- [ ] `pair_address` is valid Ethereum address
- [ ] `tokens` array contains 2 tokens with address and symbol
- [ ] `init_liquidity` contains token0_raw and token1_raw as strings
- [ ] `top_holders` is array of addresses (may be empty for V3 pools)
- [ ] `created_at` is valid ISO 8601 timestamp

---

## End-to-End Test Scenario

### Test 1: Real Pair Detection

1. Wait for new pair creation on Ethereum or BSC
2. Check Alchemy Notify dashboard for webhook delivery
3. Query `/scan` endpoint within 60 seconds
4. Verify pair appears in response with all fields

### Test 2: Cron Fallback

1. Temporarily disable Alchemy Notify webhook
2. Wait for new pair creation
3. Wait 10 minutes for cron to run
4. Verify pair appears in `/scan` response

### Test 3: Deduplication

1. Query `/scan` endpoint twice in succession
2. Verify same pair is not returned twice
3. Check KV storage for duplicate entries

### Test 4: Error Handling

1. Send webhook with invalid transaction hash
2. Verify Worker returns error but continues processing
3. Check Worker logs for error details

---

## Performance Metrics

### Detection Latency
- Target: < 60 seconds
- Expected: < 10 seconds (webhook path)
- Fallback: < 10 minutes (cron path)

### False Positive Rate
- Target: < 1%
- Expected: < 0.1%

### Uptime
- Target: > 99%
- Monitor: Cloudflare Workers dashboard

### Cost
- Target: $0/month
- Expected: Within Alchemy free tier (100k events/month)

---

## Final Checklist

Before submitting PR:

- [ ] Worker deployed and accessible
- [ ] Alchemy Notify webhooks configured (Ethereum + BSC)
- [ ] Cron job running every 10 minutes
- [ ] Health endpoint returns status "ok"
- [ ] Scan endpoint returns pairs with all required fields
- [ ] Webhook detection latency < 60 seconds
- [ ] False positive rate < 1%
- [ ] x402 payment middleware working
- [ ] All 27 tests passing
- [ ] No TypeScript errors
- [ ] wrangler.toml configured correctly
- [ ] KV namespace created and bound

---

## Submission

Once all criteria are met:

1. Create submission file in `submissions/` directory
2. Include:
   - Deployed Worker URL
   - Alchemy Notify webhook configuration
   - Screenshot of health endpoint
   - Sample `/scan` response
   - Detection latency measurements
3. Open PR to `daydreamsai/agent-bounties`
4. Link to issue #1 (Fresh Markets Watch bounty)
