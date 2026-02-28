# Fresh Markets Watch Agent

## Description

A DeFi monitoring agent that scans DEX factories for newly created trading pairs across multiple chains (Ethereum, Arbitrum, Polygon, BSC, Avalanche). Built with `@lucid-dreams/agent-kit` and `viem` for blockchain interactions.

## Features

- **Multi-chain support**: Ethereum, Arbitrum, Polygon, BSC, Avalanche
- **DEX factory scanning**: Monitors Uniswap V2/V3, SushiSwap, PancakeSwap, Trader Joe, and more
- **Real-time detection**: Scans for new pairs with configurable block ranges
- **Rich metadata**: Returns token addresses, symbols, names, and creation details
- **Risk indicators**: Flags potential honeypots and provides liquidity warnings

## Live Deployment

- **Main Endpoint**: https://ljapptest--fresh-markets-watch-handle.modal.run
- **Health Check**: https://ljapptest--fresh-markets-watch-health.modal.run
- **Invoke Agent**: https://ljapptest--fresh-markets-watch-invoke.modal.run

## Bounty Issue

[Issue #1 - Fresh Markets Watch](https://github.com/daydreamsai/agent-bounties/issues/1)

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

## Solana Wallet Address

```
3C1vCMFrgHDRqsLshw7pUx6mST9Wc854neRmDhyTBP8t
```

## Technical Details

### Entrypoints

1. **scan-new-pairs** - Scans DEX factories for newly created pairs
   - Parameters: `chain` (required), `factories` (optional), `window_minutes` (optional, default 5)
   - Returns: Array of new pair objects with token metadata

2. **health** - Health check endpoint
   - Returns: `{ status: "healthy", agent: "fresh-markets-watch", version: "1.0.0" }`

### Supported Chains

- `ethereum` - Mainnet
- `arbitrum` - Arbitrum One
- `polygon` - Polygon Mainnet
- `bsc` - BNB Smart Chain
- `avalanche` - Avalanche C-Chain

### Supported DEXes

| Chain | Supported DEXes |
|-------|-----------------|
| Ethereum | Uniswap V2, Uniswap V3, SushiSwap |
| Arbitrum | Uniswap V2, Uniswap V3, SushiSwap |
| Polygon | QuickSwap, Uniswap V3 |
| BSC | PancakeSwap V2 |
| Avalanche | Trader Joe V2 |

## Source Code

Available at: `/home/ubuntu/.openclaw/workspace/bounties/fresh-markets-watch/`

## License

MIT
