# Smart Contract Risk Scorer

Analyze smart contracts for security vulnerabilities, rug pull indicators, and malicious patterns across Ethereum and EVM-compatible chains.

**Bounty:** https://github.com/daydreamsai/agent-bounties/issues/61

## Features

- Multi-source verification: GoPlus Security API + Etherscan source code analysis
- Honeypot detection via GoPlus API
- Source code pattern scanning: 50+ malicious patterns (selfdestruct, hidden mint, blacklist, reentrancy, etc.)
- Ownership analysis: renounced, hidden owner, timelock, multisig detection
- Buy/sell tax detection
- Batch analysis for up to 10 contracts at once
- Risk score (0-100) with confidence level
- Actionable recommendations per finding
- Supports: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC

## Quick Start

```bash
npm install
npm start
```

Agent runs on `http://localhost:8087` by default.

## Quick Test

### Analyze a contract (quick scan)
```bash
curl -X POST http://localhost:8087/entrypoints/analyze_contract/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
      "chain": "ethereum",
      "scan_depth": "quick"
    }
  }'
```

### Deep scan (includes full source code analysis)
```bash
curl -X POST http://localhost:8087/entrypoints/analyze_contract/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
      "chain": "ethereum",
      "scan_depth": "deep"
    }
  }'
```

### Batch analyze multiple contracts
```bash
curl -X POST http://localhost:8087/entrypoints/batch_analyze/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "contracts": [
        {"contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "chain": "ethereum"},
        {"contract_address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "chain": "ethereum"}
      ],
      "scan_depth": "quick"
    }
  }'
```

## Response Schema

```json
{
  "contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
  "chain": "ethereum",
  "risk_score": 45,
  "risk_level": "medium",
  "confidence": 0.72,
  "vulnerabilities": [
    {
      "name": "Mint Function",
      "severity": "medium",
      "description": "Owner can create new tokens, potentially inflating supply",
      "evidence": "Pattern matched in contract source"
    }
  ],
  "security_checks": {
    "is_honeypot": false,
    "ownership_renounced": false,
    "has_proxy": false,
    "has_mint_function": true,
    "has_blacklist": false,
    "has_pausable": false,
    "verified_source": true,
    "has_timelock": false,
    "has_multisig": false,
    "sell_tax": 1.0,
    "buy_tax": 1.0
  },
  "external_checks": {
    "goplus_risk_score": 15,
    "goplus_honeypot": false,
    "goplus_open_source": true,
    "etherscan_verified": true,
    "etherscan_creator": "0xb8f226ddb7bc672e27dffb67e4adabfa8c0dfa08"
  },
  "contract_info": {
    "name": "Shiba Inu",
    "symbol": "SHIB",
    "total_supply": "999982383883209255940131948",
    "holder_count": 1388420,
    "top_holder_pct": 41.06,
    "is_token": true
  },
  "recommendations": [
    "Owner can mint unlimited tokens — watch for supply inflation that devalues your holdings.",
    "MEDIUM RISK: Review the specific vulnerabilities before investing significant capital.",
    "Use tools like Tenderly, DeFi Safety, or a manual audit before investing significant funds."
  ],
  "scan_depth": "quick",
  "analyzed_at": "2026-03-16T10:00:00.000Z"
}
```

## Supported Chains

| Chain | ID |
|-------|-----|
| ethereum | 1 |
| polygon | 137 |
| arbitrum | 42161 |
| optimism | 10 |
| base | 8453 |
| bsc | 56 |

## Technology Stack

- TypeScript + `@lucid-dreams/agent-kit`
- GoPlus Security API (honeypot, blacklist, ownership flags)
- Etherscan API (source code verification, creator)
- 50+ malicious source code pattern detection
- x402 payment middleware integrated
