# Smart Contract Risk Scorer

Closes #61

## Live Deployment
https://smart-contract-risk-scorer.netlify.app

## Agent Description
Analyzes smart contracts for security vulnerabilities and rug pull indicators.
Uses GoPlus Security API (completely free, no API key) for comprehensive security checks
including honeypot detection, hidden ownership, mintability, self-destruct, transfer pause,
high taxes, blacklist functions, and more. Returns a 0–100 risk score with detailed
vulnerability list and actionable recommendations.

## How It Works
1. Resolves chain name to GoPlus chain ID
2. `GET https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses={addr}`
3. Maps each risk flag to a severity and point contribution toward the risk score
4. Returns structured assessment with `risk_score`, `risk_level`, `vulnerabilities[]`, `security_checks`, and `recommendations[]`
5. For `scan_depth: "deep"`, also fetches contract source info from block explorer API

## Entrypoint
**Key:** `score`

**Input:**
```json
{
  "contract_address": "0x6b175474e89094c44da98b954eedeac495271d0f",
  "chain": "ethereum",
  "scan_depth": "quick"
}
```

**Output:**
```json
{
  "risk_score": 15,
  "risk_level": "low",
  "vulnerabilities": [],
  "security_checks": {
    "is_honeypot": false,
    "is_open_source": true,
    "is_mintable": false,
    "hidden_owner": false,
    "buy_tax_pct": "0%",
    "sell_tax_pct": "0%"
  },
  "contract_info": {
    "name": "Dai Stablecoin",
    "symbol": "DAI",
    "total_supply": "...",
    "holder_count": "..."
  },
  "recommendations": ["✅ No critical vulnerabilities detected. Still DYOR."],
  "confidence": 0.95
}
```

## APIs Used
- **GoPlus Security** — `https://api.gopluslabs.io/api/v1/token_security/{chainId}` (completely free, no auth)
- **Block Explorer APIs** — Etherscan/PolygonScan/Arbiscan (free tier, no key for basic queries)

## Checks Performed (14+)
- Honeypot detection
- Hidden owner backdoor
- Ownership reclaim possibility
- Self-destruct function
- Transfer pause
- Mintable supply
- Proxy/upgradeable
- Owner can change balances
- Blacklist function
- Buy/sell tax analysis
- Airdrop scam detection
- External calls
- Anti-whale modifiable
- Source code verification

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef
