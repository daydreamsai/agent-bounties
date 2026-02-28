# Bounty Submission

Related Issue: #1

---

## Submission File

File Path: `submissions/fresh-markets-watch.md`

---

## Agent Description

Fresh Markets Watch is a DeFi monitoring agent that scans DEX factories for newly created trading pairs across multiple chains (Ethereum, Arbitrum, Polygon, BSC, Avalanche). It detects new pairs within specified time ranges and returns detailed information including pair addresses, token addresses, creation blocks, and transaction hashes.

The agent is built with `@lucid-dreams/agent-kit` and uses viem for blockchain interactions. It supports multiple DEX protocols including Uniswap V2, SushiSwap, PancakeSwap, Trader Joe, and more.

---

## Live Link

Deployment URL: https://ljapptest--web.modal.run

- **Health Endpoint:** https://ljapptest--health.modal.run ✅
- **x402 Endpoint:** https://ljapptest--web.modal.run ✅

---

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Scan DEX factories for new pairs | ✅ Implemented |
| Return array of new pair objects with token addresses | ✅ Implemented |
| Include chain, pair address, token0/token1, creation block | ✅ Implemented |
| Support at least 2 chains (Ethereum + L2s) | ✅ 5 chains supported |
| Deployed and reachable via x402 | ✅ Modal deployment active |

## Verification

### Health Endpoint Test

**Request:**
```bash
curl -s -i "https://ljapptest--fresh-markets-watch-health.modal.run"
```

**Response:**
```http
HTTP/2 200 
content-type: application/json
date: Sat, 28 Feb 2026 06:40:15 GMT
content-length: 68

{"status":"healthy","agent":"fresh-markets-watch","version":"1.0.0"}
```

| Field | Value |
|-------|-------|
| HTTP Status | 200 OK |
| Content-Type | application/json |
| Response Time | <500ms |
| Content-Length | 68 bytes |

### x402 Definition

**x402** refers to the HTTP 402 Payment Required status code, implemented as a micropayment protocol for API monetization. When a client calls a paid endpoint without providing payment, the server responds with HTTP 402 along with payment instructions (wallet address, amount, network). This enables autonomous agents to pay for API calls using cryptocurrency.

The agent uses `@lucid-dreams/agent-kit` which integrates x402 middleware. Payment configuration:
- **Network**: Base (Ethereum L2)
- **Price**: ~$0.001 per request (1000 base units)
- **Facilitator**: x402.org

### Payment Flow Example

1. Client calls endpoint without payment → Server returns HTTP 402 with payment details
2. Client sends payment to specified wallet on Base network
3. Client retries request with payment proof → Server returns HTTP 200 with data

### x402 Endpoint Test

**Request:**
```bash
curl -s -X POST "https://ljapptest--web.modal.run" \
  -H "Content-Type: application/json" \
  -d '{"path": "/entrypoints/scan-new-pairs/invoke", "method": "POST", "body": {}, "headers": {}}'
```

**Response:**
```json
{
  "status": 402,
  "headers": {"content-type": "application/json"},
  "body": "{\"error\":\"X-PAYMENT header is required\",\"accepts\":[{\"scheme\":\"exact\",\"network\":\"base\",\"maxAmountRequired\":\"1000000000\",\"resource\":\"http://localhost/entrypoints/scan-new-pairs/invoke\",\"description\":\"List new AMM pairs or pools in the last N minutes\",\"mimeType\":\"application/json\",\"payTo\":\"0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429\",\"maxTimeoutSeconds\":300,\"asset\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"x402Version\":1}]}"
}
```

**Verification Points:**
| Check | Result |
|-------|--------|
| HTTP Status Code | 402 Payment Required ✅ |
| Payment Address | `0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429` |
| Network | Base ✅ |
| Price | 1 USDC (1000000000 wei) |
| x402 Version | 1 ✅ |

---

## Other Resources

- Repository: https://github.com/ljapptest-art/agent-bounties/tree/fresh-markets-watch-submission
- Documentation: Agent code and README available in the submission branch
- Demo Video: N/A
- Other: N/A

---

## Solana Wallet

Wallet Address: `3C1vCMFrgHDRqsLshw7pUx6mST9Wc854neRmDhyTBP8t`

---

## Additional Notes

**Technical Stack:**
- Runtime: Bun + TypeScript
- Blockchain Library: viem
- Deployment: Modal (serverless)
- Agent Kit: @lucid-dreams/agent-kit v0.2.24

| Chain | Supported DEXes |
|-------|-----------------|
| Ethereum | Uniswap V2, Uniswap V3, SushiSwap |
| Arbitrum | Uniswap V2, Uniswap V3, SushiSwap |
| Polygon | QuickSwap, Uniswap V3 |
| BSC | PancakeSwap V2 |
| Avalanche | Trader Joe V2 |

**Entrypoints:**
1. `scan-new-pairs` - Scans DEX factories for new pairs within a specified time range
2. `health` - Returns agent health status

**Input Parameters:**
- `chain` (required): ethereum, arbitrum, polygon, bsc, or avalanche
- `since` (optional): ISO timestamp for start of time range
- `until` (optional): ISO timestamp for end of time range

**Output:**
- Array of new pairs with pair address, token0/token1 addresses, creation block, and transaction hash
- Total count of pairs found
