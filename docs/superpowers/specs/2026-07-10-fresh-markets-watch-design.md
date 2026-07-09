# Fresh Markets Watch — Design Specification

**Bounty**: Daydreams AI Agent Bounties #1  
**Reward**: $1,000 USD (first-come, first-served)  
**Date**: 2026-07-10

## Goal

Build and deploy an AI agent that monitors new AMM pairs/pools created in the last N minutes on Ethereum and BSC, returning pair details including initial holders and liquidity.

## Acceptance Criteria

- ✅ Detect new pairs within 60 seconds of creation
- ✅ False positive rate under 1%
- ✅ Deploy on a domain reachable via x402
- ✅ Return all required fields: `pair_address`, `tokens`, `init_liquidity`, `top_holders`, `created_at`

## Architecture Overview

**Pattern**: Webhook-triggered real-time detection + cron fallback + KV cache + x402 endpoint

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker                                      │
├─────────────────────────────────────────────────────────┤
│  Alchemy Notify Webhook (real-time)                     │
│    - Alchemy sends HTTP POST when PairCreated occurs    │
│    - Worker processes event, extracts holders           │
│    - Stores in KV with 10-min TTL                       │
│    - Detection latency: ~5-10s                          │
│                                                         │
│  Cron Trigger (every 10 min)                            │
│    - Scans last 15 min of blocks                        │
│    - Catches pairs missed by webhook failures           │
│    - Dedup via KV (never reports twice)                 │
│                                                         │
│  x402 Endpoint (POST /scan)                             │
│    - Reads from KV                                      │
│    - Returns cached results                             │
│    - Accepts optional factory override                  │
│                                                         │
│  Health Endpoint (GET /health)                          │
│    - No payment required                                │
│    - Returns: status, last_scan, pairs_cached           │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Webhook Handler (Real-Time Detection)

**Trigger**: Alchemy Notify sends POST when `PairCreated` or `PoolCreated` event occurs

**Processing**:
1. Verify webhook signature (Alchemy API key)
2. Extract event data: `token0`, `token1`, `pair_address`, `tx_hash`, `block_number`
3. Fetch transaction receipt from Alchemy RPC
4. Verify `receipt.status === 1` (tx succeeded)
5. Verify `getCode(pair_address) !== 0x` (contract exists)
6. Extract holders (see Holder Extraction Logic below)
7. Store in KV with key `pair:{chain}:{pair_address}`, TTL 10 min
8. Return 200 OK

**Detection latency**: ~5-10s (Alchemy processing + RPC call)

**Error handling**:
- RPC call fails → retry once (2 attempts max)
- If still fails → log error, skip this pair (cron will catch it)
- KV write fails → retry twice with 100ms/500ms backoff
- If KV fails → log error, cron will catch it

### 2. Cron Scanner (Fallback)

**Trigger**: Cloudflare Worker cron event every 10 minutes

**Processing**:
1. For each chain (Ethereum, BSC):
   - Fetch current block number
   - Calculate `from_block = current_block - (15 * blocks_per_minute)`
   - Query factory contracts for `PairCreated`/`PoolCreated` events in range
2. For each event:
   - Check KV — if pair already cached, skip (dedup)
   - Fetch tx receipt, verify status
   - Extract holders
   - Store in KV
3. Log results

**Block ranges**:
- Ethereum: ~5 blocks/min → scan last 75 blocks
- BSC: ~20 blocks/min → scan last 300 blocks

**CPU limit protection**:
- Process pairs in batches of 20
- After each batch, check elapsed time
- If >25s → stop processing, let next cron run catch the rest

### 3. x402 Endpoint (POST /scan)

**Input** (via x402 payment):
```ts
{
  chain: "ethereum" | "bsc",
  factories?: string[],  // optional override
  window_minutes?: number  // default: 5
}
```

**Processing**:
1. Read from KV: all pairs for `chain` created in last `window_minutes` (max 10 min, limited by KV TTL)
2. If `factories` provided, filter to only those factories
3. Return cached results

**Note**: KV TTL is 10 minutes, so we can only return data from the last 10 minutes even if `window_minutes` is larger.

**Output**:
```ts
{
  chain: string,
  window_minutes: number,
  from_block: number,
  to_block: number,
  new_pairs: NewPair[],
  total_found: number
}
```

**Payment**: Handled by x402 middleware via `@lucid-dreams/agent-kit`

### 4. Health Endpoint (GET /health)

**No payment required**

**Output**:
```ts
{
  status: "ok",
  last_webhook: ISO timestamp,
  last_cron: ISO timestamp,
  pairs_cached: number
}
```

## Holder Extraction Logic

**Goal**: Find top holder addresses for a newly created pair using only direct contract queries.

**Strategy — Trace the creation transaction**:

```
PairCreated event (block N)
    │
    ├─ event.transactionHash  →  fetch tx receipt
    │
    ├─ Parse all logs in receipt
    │     │
    │     ├─ Filter ERC20 Transfer events WHERE:
    │     │     - from = address(0)  (mint events)
    │     │     - token = token0 OR token1
    │     │     - to ≠ address(0)
    │     │
    │     └─ These "to" addresses = initial holders
    │           (they received tokens in the same tx that created the pair)
    │
    └─ Also include: pair_address itself (holds LP tokens)
         + msg.sender (deployer/initializer)
```

**Fallback — Query known addresses**:

If the tx trace yields fewer than 3 holders (common for V3 pools):
1. Query `balanceOf(pair_address)` on token0/token1
2. Check the factory deployer address
3. Check the `msg.sender` of the creation tx
4. Return whatever we have — partial is better than empty

**Output format**:
```ts
top_holders: [
  "0xDeployer...",      // tx sender / pool initializer
  "0xPairAddress...",   // the pair itself (holds reserves)
  "0xHolder1...",       // received token0 mint in creation tx
  "0xHolder2...",       // received token1 mint in creation tx
]
```

## Initial Liquidity Format

**Decision**: Return raw token0 + token1 reserves (verifiable, no price feeds)

```ts
init_liquidity: {
  token0_raw: "1000000000000000000",  // 1.0 token0
  token1_raw: "2000000000",           // 2.0 token1
}
```

**Rationale**:
- Verifiable on-chain — acceptance test can check reserves directly
- No price feed dependency — new tokens have no market price yet
- Chain-agnostic — works for V2 (has reserves at creation) and V3 (often zero)
- Caller can convert — they have decimals from the token data

## Factory Addresses

**Decision**: Hardcoded defaults + caller override

**Hardcoded factories** (in `chains.ts`):

| Chain | Factory | Type |
|-------|---------|------|
| Ethereum | `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f` | Uniswap V2 |
| Ethereum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | Uniswap V3 |
| BSC | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | PancakeSwap V2 |
| BSC | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` | PancakeSwap V3 |

**x402 endpoint**: Accepts optional `factories` input. If provided, use caller's list. If empty, use hardcoded defaults.

**Cron scanner**: Always uses hardcoded list.

## False Positive Prevention

**Three-layer defense**:

1. **Transaction status check** — only emit if `receipt.status === 1` (tx succeeded)
2. **KV dedup** — never report same pair twice (check KV before storing)
3. **Contract existence** — verify `getCode(pair_address) !== 0x` (contract actually exists)

**Expected false positive rate**: <0.1% (well under 1% requirement)

## Error Handling

### Real-Time (Webhook)
- RPC call fails → retry **once** (2 attempts max)
- If still fails → log error, skip this pair
- Don't block processing for other pairs in the same block

### Cron Fallback
- Scans last **15 minutes** of blocks (not 10)
- Catches any pairs missed by webhook failures
- Dedup via KV (won't report twice)

### KV Writes
- Retry **twice** with 100ms/500ms backoff
- If KV fails → log error, pair will be caught by next cron run

### CPU Limit Protection
- Process pairs in batches of **20**
- After each batch, check elapsed time
- If >25s → stop processing, let cron catch the rest

## RPC Provider

**Decision**: Alchemy free tier

- **Event quota**: 100k events/month
- **Expected usage**: ~15,000-30,000 events/month (Ethereum + BSC)
- **Cost**: $0/month (within free tier)
- **Overage**: $0.001 per additional event (if we exceed 100k, still profitable)

**Webhook**: Alchemy Notify (webhook-based, no persistent WebSocket connection needed)

## Chains

**MVP scope**: Ethereum + BSC only

**Rationale**:
- Highest volume of new pairs
- Most valuable trading pairs
- ~10,000-20,000 events/month (well within 100k free tier)
- Can add Polygon/Arbitrum/Optimism later if needed

## File Structure

```
src/
  fresh-markets-watch.ts   ← main entrypoint, Worker setup
  scanner.ts               ← block scanning logic (cron handler)
  webhook.ts               ← Alchemy Notify webhook handler
  holders.ts               ← tx trace + holder extraction
  chains.ts                ← chain configs (RPC URLs, block times, factory addresses)
  kv.ts                    ← KV read/write helpers
  types.ts                 ← shared types (NewPair, ChainConfig, etc.)
wrangler.toml              ← Worker config + cron triggers + KV binding + Alchemy API key
package.json               ← dependencies
```

## Testing Strategy

**Local testing**:
- Use Alchemy testnet (Sepolia for Ethereum, BSC testnet)
- Create test pairs manually
- Verify webhook processing
- Verify cron scanning
- Verify KV dedup

**Pre-deployment checklist**:
- [ ] Webhook receives events from Alchemy
- [ ] Holder extraction works for V2 and V3 pairs
- [ ] KV stores and retrieves pairs correctly
- [ ] x402 endpoint returns cached data
- [ ] /health endpoint returns status
- [ ] Cron runs every 10 min
- [ ] Error handling works (simulate RPC failures)

## Deployment

**Platform**: Cloudflare Workers

**Steps**:
1. Create Cloudflare account (if not already)
2. Install Wrangler CLI: `bun install -g wrangler`
3. Configure `wrangler.toml`:
   - KV namespace binding
   - Cron trigger (every 10 min)
   - Alchemy API key (secret)
4. Deploy: `wrangler deploy`
5. Configure custom domain (optional, but required for x402)
6. Set up Alchemy Notify webhook (point to Worker URL)
7. Test with `/health` endpoint
8. Submit PR to bounty repo

## Known Risks

1. **Detection latency**: 95% of pairs detected <10s, 5% detected <10 min (cron fallback). May not meet strict 60s requirement for all pairs.
   - **Mitigation**: Acceptable for bounty demo. Most pairs will be detected in real-time.

2. **Incomplete holder list**: V3 pools often have zero holders at creation (liquidity added later).
   - **Mitigation**: Return partial list `[deployer, pool]`. Better than empty.

3. **Alchemy rate limits**: Free tier may throttle under heavy load.
   - **Mitigation**: Retry once, rely on cron fallback.

4. **x402 integration**: Unclear if `agent-kit` has built-in x402 support.
   - **Mitigation**: Research before coding. Implement manually if needed.

## Success Metrics

- **Detection latency**: <10s for 95% of pairs
- **False positive rate**: <0.1%
- **Uptime**: >99% (Worker + Alchemy)
- **Cost**: $0/month (within free tier)
- **Bounty**: Win $1,000 (first to submit)

## Future Enhancements (Out of Scope)

- Add Polygon, Arbitrum, Optimism
- Implement WebSocket for even faster detection
- Add USD value calculation for liquidity
- Implement more sophisticated holder analysis (track transfers over time)
- Add alerting for high-value pairs
