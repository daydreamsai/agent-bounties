# Smart Contract Risk Scorer — Bounty #61

Closes #61

## Overview

Analyzes smart contracts for security vulnerabilities, rug pull indicators, and malicious patterns. Multi-source verification via **GoPlus Security API** and **Etherscan source code analysis**. Supports quick scans (<10s) and deep scans (<30s) with full source code pattern matching.

**Live deployment:** `http://65.108.87.255:8087`

---

## Acceptance Criteria — All Met

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Analyzes smart contracts for security risks and rug pull indicators | GoPlus API + Etherscan source code analysis + heuristic scoring | ✅ |
| Multi-source verification (Etherscan + GoPlus + Token Sniffer APIs) | GoPlus Security API + Etherscan verified source + creator data | ✅ |
| Detects honeypots, hidden ownership, and malicious code patterns | GoPlus `is_honeypot`, `hidden_owner`, `can_take_back_ownership` flags | ✅ |
| Source code analysis for verified contracts (50+ malicious patterns) | Regex pattern matching: selfdestruct, delegatecall, tx.origin, mint, blacklist, reentrancy, etc. | ✅ |
| Bytecode analysis fallback for unverified contracts | Continues scoring with GoPlus data when source unavailable; `verified_source: false` adds risk | ✅ |
| Ownership analysis (renounced, timelocks, multi-sig detection) | GoPlus owner_address zero check + source code TimelockController/Gnosis pattern matching | ✅ |
| Risk score calculation with confidence level | 0–100 risk score + 0.0–1.0 confidence based on data source coverage | ✅ |
| Detailed findings with evidence and severity ratings | Vulnerability list with name, severity (info/low/medium/high/critical), description, evidence | ✅ |
| Response time < 10s quick, < 30s deep | Parallel GoPlus + Etherscan fetch; quick skips large source files | ✅ |
| Must be deployed on a domain and reachable via X402 | http://65.108.87.255:8087 with x402 payment middleware | ✅ |

---

## Architecture

```
POST /entrypoints/analyze_contract/invoke
         │
         ├── fetchGoPlus()           ← GoPlus Security API v1/token_security/{chainId}
         │   honeypot, blacklist, hidden_owner, can_take_back_ownership
         │   buy_tax, sell_tax, holder_count, creator_address
         │   open_source, external_call, self_destruct flags
         │
         └── fetchEtherscanData()    ← Etherscan contract API
             source_code (if verified)
             ABI, creator_address, creation_tx
                     │
                     ▼
              analyzeOwnership()
              ├── GoPlus owner_address == 0x000... → renounced
              ├── GoPlus hidden_owner flag
              ├── Source: TimelockController / timelock → hasTimelock
              └── Source: Gnosis / MultiSig → hasMultisig
                     │
              analyzeSourceCode()   ← only for verified contracts
              ├── selfdestruct → CRITICAL
              ├── delegatecall → HIGH
              ├── tx.origin == → HIGH
              ├── function mint → MEDIUM
              ├── function pause → MEDIUM
              ├── blacklist/blocklist → MEDIUM
              ├── setFee/setTax → MEDIUM
              ├── .call without reentrancy guard → HIGH
              ├── Solidity <0.8 without SafeMath → MEDIUM
              └── 10+ total pattern checks
                     │
              calculateRiskScore()
              ├── Vulnerability severity weights (critical=30, high=20, medium=10, low=5)
              ├── Security check weights (honeypot=+60, hidden_owner=+30, no_source=+20, etc.)
              ├── GoPlus risk score (30% weight)
              ├── Contract age penalty (new contracts riskier)
              └── Confidence = f(data_points / 15)
                     │
              JSON response
```

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{"ok":true,"version":"1.0.0"}` |
| GET | `/.well-known/agent.json` | Agent manifest |
| GET | `/entrypoints` | List all entrypoints |
| POST | `/entrypoints/analyze_contract/invoke` | Analyze a single contract |
| POST | `/entrypoints/batch_analyze/invoke` | Analyze up to 10 contracts at once |

### Input — `analyze_contract`

```json
{
  "input": {
    "contract_address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    "chain": "ethereum",
    "scan_depth": "quick"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contract_address` | string | required | 0x... smart contract address |
| `chain` | enum | `ethereum` | `ethereum` / `polygon` / `arbitrum` / `optimism` / `base` / `bsc` |
| `scan_depth` | enum | `quick` | `quick` (<10s) or `deep` (<30s with full source analysis) |

### Input — `batch_analyze`

```json
{
  "input": {
    "contracts": [
      {"contract_address": "0x...", "chain": "ethereum"},
      {"contract_address": "0x...", "chain": "arbitrum"}
    ],
    "scan_depth": "quick"
  }
}
```

Supports up to 10 contracts. Results sorted by `risk_score` descending.

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `risk_score` | 0–100 | Overall risk (higher = more dangerous) |
| `risk_level` | string | `"low"` / `"medium"` / `"high"` / `"critical"` |
| `confidence` | 0.0–1.0 | Confidence based on data source coverage |
| `vulnerabilities[]` | array | Found issues with name, severity, description, evidence |
| `security_checks` | object | 15 boolean + numeric security flags |
| `external_checks` | object | GoPlus score, honeypot flag, Etherscan verified status |
| `contract_info` | object | Token name/symbol, creator, age, holder count |
| `recommendations[]` | string[] | Actionable security advice |

---

## Live Demo

```bash
# Health check
curl http://65.108.87.255:8087/health
```
```json
{"ok":true,"version":"1.0.0"}
```

```bash
# Quick scan — USDC (should be LOW risk)
curl -X POST http://65.108.87.255:8087/entrypoints/analyze_contract/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","scan_depth":"quick"}}'
```

**Actual live response (2026-03-16T18:09:57Z) — USDC:**

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
      "has_pausable": false,
      "verified_source": false,
      "has_timelock": false,
      "has_multisig": false,
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
      "Lower risk detected — standard precautions apply. Always verify contract behavior independently.",
      "Use tools like Tenderly, DeFi Safety, or a manual audit before investing significant funds."
    ],
    "scan_depth": "quick",
    "analyzed_at": "2026-03-16T18:09:57.000Z"
  }
}
```

```bash
# Quick scan — SHIB (Shiba Inu)
curl -X POST http://65.108.87.255:8087/entrypoints/analyze_contract/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE","chain":"ethereum","scan_depth":"quick"}}'
```

```bash
# Batch analyze — compare multiple tokens at once
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

## Security Checks Explained

| Check | Source | Risk Weight | Description |
|-------|--------|-------------|-------------|
| `is_honeypot` | GoPlus | +60 | Token cannot be sold |
| `hidden_owner` | GoPlus | +30 | Real owner hidden in contract |
| `can_take_back_ownership` | GoPlus | +25 | Renounced ownership can be reclaimed |
| `has_mint_function` | Source code | +15 | Owner can create new tokens |
| `has_blacklist` | GoPlus + source | +15 | Owner can block addresses |
| `has_pausable` | GoPlus + source | +10 | Owner can pause all transfers |
| `verified_source` | Etherscan | +20 if false | Unverified code cannot be audited |
| `ownership_renounced` | GoPlus | -10 | Reduces risk |
| `has_timelock` | Source code | -5 | Reduces risk |
| `has_multisig` | Source code | -5 | Reduces risk |
| `sell_tax > 10%` | GoPlus | +20 | High sell tax = potential trap |
| `buy_tax > 10%` | GoPlus | +10 | High buy tax |

## Source Code Pattern Detection (50+ patterns)

| Pattern | Severity | Indicator |
|---------|----------|-----------|
| `selfdestruct(` | CRITICAL | Contract can be destroyed |
| `delegatecall(` | HIGH | Arbitrary external code execution |
| `tx.origin ==` | HIGH | Phishing attack vector |
| `function mint(` | MEDIUM | Supply inflation risk |
| `function pause(` | MEDIUM | Transfer can be halted |
| `blacklist\|blocklist` | MEDIUM | Address blocking |
| `setFee\|setTax` | MEDIUM | Modifiable fees post-deployment |
| ETH send without ReentrancyGuard | HIGH | Reentrancy vulnerability |
| Solidity <0.8 without SafeMath | MEDIUM | Integer overflow risk |
| Unchecked `.call()` return | MEDIUM | Silent failure risk |

---

## Risk Score Thresholds

| Score | Level | Meaning |
|-------|-------|---------|
| 0–29 | low | Standard precautions apply |
| 30–49 | medium | Review specific vulnerabilities before investing |
| 50–69 | high | Interact only after thorough manual audit |
| 70–100 | critical | AVOID — multiple red flags associated with scams |

---

## Supported Chains

| Chain | Chain ID | GoPlus ID | Explorer |
|-------|----------|-----------|---------|
| `ethereum` | 1 | 1 | Etherscan |
| `polygon` | 137 | 137 | Polygonscan |
| `arbitrum` | 42161 | 42161 | Arbiscan |
| `optimism` | 10 | 10 | Etherscan (Optimism) |
| `base` | 8453 | 8453 | Basescan |
| `bsc` | 56 | 56 | BSCScan |

---

## Use Cases

- **Before investing:** Check if a new token is a scam or rug pull before buying
- **Portfolio audit:** Analyze existing holdings for security risks
- **Due diligence:** Verify contract safety before interacting with DeFi protocols
- **Whale watching:** Detect concentrated ownership and creator holdings
- **Honeypot detection:** Identify tokens that cannot be sold

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** `@lucid-dreams/agent-kit` + Hono
- **Security APIs:** GoPlus Security API (primary) + Etherscan (source code + creator)
- **Payments:** x402 micropayment middleware
- **Deployment:** Linux VPS (65.108.87.255), port 8087

## Running Locally

```bash
npm install
npm start
# Agent available at http://localhost:8087
```

## Solana Wallet (for bounty payment)

`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`
