# Fresh Markets Watch Agent

## Agent Description

The Fresh Markets Watch agent monitors blockchain networks for newly created AMM pairs and liquidity pools within a specified time window. It scans factory contracts for PairCreated events, validates pair existence on-chain, extracts initial liquidity data, and identifies top token holders. The agent provides real-time detection of new trading pairs with <1% false positive rate and responds within 60 seconds.

**Key Features:**
- Monitors multiple factory addresses simultaneously
- Extracts pair addresses, token addresses, initial liquidity amounts
- Identifies top token holders via Transfer event analysis
- Validates pair existence on-chain to prevent false positives
- Returns structured data with timestamps and metadata

## Related Bounty Issue

[#1 - Fresh Markets Watch](https://github.com/daydreamsai/agent-bounties/issues/1)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/fresh-markets-watch`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Emits new pairs within 60 seconds of creation
- ✅ False positive rate <1%
- ✅ Includes pair address, tokens, initial liquidity, top holders, created_at timestamp
- ✅ Supports multiple chains and factory addresses
- ✅ Validates pair existence on-chain
- ✅ All tests pass (6/6 tests)

## Entrypoint

**Key:** `scan_new_pairs`

**Input:**
```json
{
  "chain": "ethereum",
  "factories": ["0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"],
  "window_minutes": 5
}
```

**Output:**
```json
{
  "pairs": [...],
  "count": 0,
  "window_minutes": 5,
  "scanned_factories": ["..."]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` for blockchain interaction
- Queries `PairCreated` events from factory contracts
- Validates pairs via `eth_getCode` checks
- Calculates top holders from Transfer events
- Implements Hono server for HTTP endpoints

