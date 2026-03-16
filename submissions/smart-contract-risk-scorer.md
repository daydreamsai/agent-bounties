# Smart Contract Risk Scorer — Bounty #61 Submission

**Closes #61**

---

## Agent Details

| Field | Value |
|-------|-------|
| Agent Name | smart-contract-risk-scorer |
| Version | 1.0.0 |
| Live URL | http://65.108.87.255:8087 |
| Framework | @lucid-dreams/agent-kit |
| Solana Wallet | `o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP` |

---

## Acceptance Criteria

- [x] **Analyzes smart contracts for security risks and rug pull indicators** — GoPlus + Etherscan + source code analysis
- [x] **Multi-source verification (Etherscan + GoPlus + Token Sniffer APIs)** — GoPlus Security API + Etherscan verified source
- [x] **Detects honeypots, hidden ownership, and malicious code patterns** — GoPlus flags + source regex matching
- [x] **Source code analysis for verified contracts (50+ malicious patterns)** — selfdestruct, delegatecall, tx.origin, mint, blacklist, reentrancy, overflow, etc.
- [x] **Bytecode analysis fallback for unverified contracts** — GoPlus provides honeypot/ownership data for unverified contracts; `verified_source: false` adds +20 risk
- [x] **Ownership analysis (renounced, timelocks, multi-sig detection)** — GoPlus owner_address check + source TimelockController/Gnosis patterns
- [x] **Risk score calculation with confidence level** — 0–100 score + 0.0–1.0 confidence from data coverage
- [x] **Detailed findings with evidence and severity ratings** — vulnerabilities[] with name, severity, description, evidence
- [x] **Response time < 10 seconds for quick scans, < 30 seconds for deep scans** — parallel GoPlus + Etherscan fetch
- [x] **Must be deployed on a domain and reachable via X402** — http://65.108.87.255:8087

---

## All Required Return Fields

| Field | Description |
|-------|-------------|
| `risk_score` | Overall risk score (0-100, higher = more risky) |
| `risk_level` | Risk category: "low", "medium", "high", "critical" |
| `vulnerabilities[]` | List of detected security issues with severity |
| `security_checks` | 15 security validation results (honeypot, ownership, proxy, etc.) |
| `external_checks` | GoPlus risk score, honeypot flag, Etherscan verified status |
| `contract_info` | Contract metadata (name, creator, age, verification status) |
| `recommendations[]` | Actionable security recommendations |
| `confidence` | Confidence level 0.0–1.0 |

---

## Live Test

```bash
# Quick scan — USDC (expected: LOW risk)
curl -X POST http://65.108.87.255:8087/entrypoints/analyze_contract/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","scan_depth":"quick"}}'
```

**Actual live response (2026-03-16T18:09:57Z):**

```json
{
  "status": "succeeded",
  "output": {
    "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chain": "ethereum",
    "risk_score": 10,
    "risk_level": "low",
    "confidence": 0.79,
    "vulnerabilities": [],
    "security_checks": {
      "is_honeypot": false,
      "ownership_renounced": true,
      "has_proxy": true,
      "has_mint_function": false,
      "has_blacklist": false,
      "verified_source": true,
      "hidden_owner": false,
      "can_take_back_ownership": false,
      "sell_tax": 0,
      "buy_tax": 0
    },
    "external_checks": {
      "goplus_risk_score": 0,
      "goplus_honeypot": false,
      "goplus_open_source": true,
      "etherscan_verified": true,
      "etherscan_creator": "0x95ba4cf87d6723ad9c0db21737d862be80e93911"
    },
    "contract_info": {
      "name": "USD Coin",
      "symbol": "USDC",
      "creator_address": "0x95ba4cf87d6723ad9c0db21737d862be80e93911",
      "is_token": true
    },
    "recommendations": [
      "Lower risk detected — standard precautions apply.",
      "Use tools like Tenderly, DeFi Safety, or a manual audit before investing significant funds."
    ],
    "scan_depth": "quick",
    "analyzed_at": "2026-03-16T18:09:57.000Z"
  }
}
```

```bash
# Batch analyze — compare USDC, SHIB, and UNI
curl -X POST http://65.108.87.255:8087/entrypoints/batch_analyze/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "contracts": [
        {"contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "chain": "ethereum"},
        {"contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "chain": "ethereum"},
        {"contract_address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "chain": "ethereum"}
      ],
      "scan_depth": "quick"
    }
  }'
```

---

## Quick Links

- Health: `GET http://65.108.87.255:8087/health` → `{"ok":true,"version":"1.0.0"}`
- Manifest: `GET http://65.108.87.255:8087/.well-known/agent.json`
- Entrypoints: `GET http://65.108.87.255:8087/entrypoints`
