# Approval Risk Auditor - Bounty #5 Submission

## Agent Information

**Name:** Approval Risk Auditor

**Description:** Flag unlimited or stale ERC-20/NFT approvals and build revoke calls. Scans wallet approvals across multiple chains, identifies risk factors, and generates ready-to-broadcast revocation transactions.

**Live Endpoint:** https://approval-risk-auditor-production.up.railway.app/entrypoints/approval-risk-auditor/invoke

## Acceptance Criteria

- ✅ **Matches Etherscan approval data for top tokens**
  - Scans for ERC-20 `Approval` events (topic: 0x8c5be1e5...)
  - Scans for ERC-721 `ApprovalForAll` events (topic: 0x17307eab...)
  - Retrieves current allowances via smart contract calls
  - Parses event logs with Web3.py

- ✅ **Identifies unlimited and stale approvals**
  - Unlimited: allowance >= 2^128
  - Stale: approved > 90 days ago
  - Filters revoked approvals (allowance = 0)
  - Calculates approval age in days

- ✅ **Provides valid revocation transaction data**
  - ERC-20: `approve(spender, 0)` encoded transaction
  - ERC-721: `setApprovalForAll(operator, false)` encoded transaction
  - Returns complete transaction objects: to, from, data, value, chainId
  - Ready to broadcast via Web3

- ✅ **Deployed on a domain and reachable via x402**
  - Deployed: https://approval-risk-auditor-production.up.railway.app
  - Implements AP2 (Agent Payments Protocol)
  - Full x402 protocol compliance
  - Registered on x402scan ✅

## Implementation Details

### Technology Stack
- **Framework:** Python, FastAPI, Web3.py
- **Deployment:** Railway (Docker)
- **Payment:** x402 via daydreams facilitator
- **Network:** Base
- **Pricing:** 0.05 USDC per request

### Features
- Multi-chain support (7 chains: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche)
- ERC-20 and ERC-721 approval detection
- Risk analysis (unlimited/stale approvals)
- Revocation transaction generation
- Configurable block scanning ranges
- Public RPC fallbacks

### API Endpoints

#### POST /approvals/audit
Audit wallet approvals and generate revocation data.

**Input:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chains": [1, 137, 42161]
}
```

**Output:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "approvals": [
    {
      "chain": 1,
      "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "spender": "0x1111111254EEB25477B68fb85Ed929f73A960582",
      "type": "ERC20",
      "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "unlimited": true,
      "age_days": 245,
      "stale": true,
      "risk_flags": ["unlimited", "stale"]
    }
  ],
  "revoke_tx_data": [
    {
      "chain": 1,
      "to": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "data": "0x095ea7b30000000000000000000000001111111254eeb25477b68fb85ed929f73a9605820000000000000000000000000000000000000000000000000000000000000000",
      "value": "0x0",
      "chainId": 1
    }
  ],
  "total_approvals": 1,
  "risky_approvals": 1
}
```

#### GET /.well-known/agent.json
Returns AP2 metadata (HTTP 200)

#### GET /.well-known/x402
Returns x402 payment metadata (HTTP 402)

#### GET /entrypoints/approval-risk-auditor/invoke
AP2-compatible entrypoint (returns HTTP 402 for x402 discovery)

#### GET /health
Health check with chain status

#### GET /chains
List supported chains

### Supported Chains

| Chain | Chain ID | Approval Types |
|-------|----------|----------------|
| Ethereum | 1 | ERC-20, ERC-721 |
| Polygon | 137 | ERC-20, ERC-721 |
| Arbitrum | 42161 | ERC-20, ERC-721 |
| Optimism | 10 | ERC-20, ERC-721 |
| Base | 8453 | ERC-20, ERC-721 |
| BSC | 56 | ERC-20, ERC-721 |
| Avalanche | 43114 | ERC-20, ERC-721 |

### Performance

**Scanning Efficiency:**
- Scans last 100k blocks per chain (configurable)
- Uses indexed event topics for fast filtering
- Parallel processing for multiple chains
- Optimized RPC usage

**Accuracy:**
- Matches Etherscan approval data
- Filters out revoked approvals (allowance = 0)
- Validates contract addresses
- Checksums all addresses

**Risk Detection:**
- Unlimited threshold: 2^128
- Stale threshold: 90 days
- Comprehensive risk flagging

## Testing

Service is live and registered on x402scan: https://www.x402scan.com

### Test Commands

```bash
# Check health
curl https://approval-risk-auditor-production.up.railway.app/health

# List supported chains
curl https://approval-risk-auditor-production.up.railway.app/chains

# Audit wallet approvals (Vitalik's address on Ethereum + Polygon)
curl -X POST https://approval-risk-auditor-production.up.railway.app/approvals/audit \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chains": [1, 137]
  }'

# Verify x402 compliance (must return 402)
curl -I https://approval-risk-auditor-production.up.railway.app/.well-known/x402

# Check AP2 metadata (must return 200)
curl https://approval-risk-auditor-production.up.railway.app/.well-known/agent.json

# Check x402 entrypoint (must return 402)
curl -I https://approval-risk-auditor-production.up.railway.app/entrypoints/approval-risk-auditor/invoke
```

## Repository

**GitHub:** https://github.com/DeganAI/approval-risk-auditor

**Key Files:**
- `/src/main.py` - FastAPI application with AP2/x402 endpoints
- `/src/approval_auditor.py` - Approval scanning and risk analysis
- `/src/chain_config.py` - Multi-chain RPC configuration
- `/Dockerfile` - Container configuration
- `/railway.toml` - Railway deployment config
- `/test_endpoints.sh` - API testing script
- `/README.md` - Complete project documentation
- `/PRODUCTION_SETUP.md` - Deployment guide

## Wallet Information

**Payment Address (ETH/Base):** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c

**Solana Wallet:** Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG

## Additional Resources

- **Live Service:** https://approval-risk-auditor-production.up.railway.app
- **API Documentation:** https://approval-risk-auditor-production.up.railway.app/docs
- **x402 Registration:** ✅ Registered on x402scan

---

**Submitted by:** DeganAI (Ian B - hashmonkey@degenai.us)

**Date:** October 31, 2025

**Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/5
