# Lending Liquidation Sentinel - Bounty #9 Submission

## Agent Information

**Name:** Lending Liquidation Sentinel
**Description:** Monitor Aave V3 borrow positions across Ethereum, Base, and Arbitrum. Fires alerts before health factor crosses 1.0 with accurate liquidation price calculations.
**Framework:** TypeScript + `@lucid-dreams/agent-kit`

## Live Endpoint

**Deployment URL:** https://lending-liquidation-sentinel.up.railway.app
**Invoke URL:** https://lending-liquidation-sentinel.up.railway.app/entrypoints/monitor/invoke

## Acceptance Criteria

- ✅ **Fires alert before health factor crosses 1.0**
  - Configurable `alert_threshold` (default 1.2)
  - Risk levels: `safe` (HF ≥ 1.2), `warning` (1.05–1.2), `critical` (1.0–1.05), `liquidatable` (≤ 1.0)

- ✅ **Accurate liquidation price calculations**
  - Uses Aave V3 `getUserAccountData()` — the canonical on-chain source
  - Health Factor: `HF = (total_collateral × liquidation_threshold) / total_debt`
  - Liquidation Price Drop: `drop% = (1 - 1/HF) × 100`
  - Buffer Percent: `(HF - 1) × 100`

- ✅ **Deployed on a domain and reachable via x402**
  - Built with `@lucid-dreams/agent-kit` (Hono-based, x402-native)
  - Deployed on Railway

## Implementation

### Technology Stack
- **Language:** TypeScript
- **Framework:** `@lucid-dreams/agent-kit` v0.2.24
- **On-chain:** `viem` for direct Aave V3 Pool contract reads
- **Server:** `@hono/node-server`
- **Deployment:** Railway (Docker)

### Supported Chains

| Chain | ID | Aave V3 Pool Address |
|-------|-----|---------------------|
| Ethereum | 1 | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Base | 8453 | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| Arbitrum | 42161 | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |

### Entrypoints

#### `monitor` — Main monitoring endpoint
**Input:**
```json
{
  "wallet": "0x...",
  "protocol_ids": ["aave_v3"],
  "chain_ids": [1, 8453, 42161],
  "alert_threshold": 1.2
}
```

**Output:**
```json
{
  "wallet": "0x...",
  "positions": [{
    "chain_id": 1,
    "chain_name": "ethereum",
    "health_factor": 1.85,
    "liq_price_drop_percent": 45.95,
    "buffer_percent": 85.0,
    "alert_threshold_hit": false,
    "total_collateral_usd": 50000,
    "total_debt_usd": 27000,
    "liquidation_threshold": 0.85
  }],
  "overall_health_factor": 1.85,
  "overall_alert": false,
  "risk_level": "safe",
  "summary": "Monitoring 1 active position(s)..."
}
```

#### `health` — Health check
Returns supported protocols, chains, and version info.

### Key Design Decisions

1. **Direct on-chain reads**: No reliance on third-party APIs — reads directly from Aave V3 Pool contracts via `getUserAccountData()`
2. **Multi-chain parallel**: Queries all chains simultaneously with `Promise.allSettled` for resilience
3. **Precise calculations**: Uses Aave's native 8-decimal USD base and 18-decimal health factor
4. **Graceful degradation**: If one chain fails, others still return results

## Source Code

**Repository:** https://github.com/contactn8n410-del/lending-liquidation-sentinel

## Solana Wallet

**Wallet Address:** 0x0282BdE2f138babC6ABa3bb010121112cC1d7eDa
