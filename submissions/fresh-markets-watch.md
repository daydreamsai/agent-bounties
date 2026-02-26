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
| Deployed and reachable via x402 | ✅ Modal deployment |

## Solana Wallet Address

```
3C1vCMFrgHDRqsLshw7pUx6mST9Wc854neRmDhyTBP8t
```

## Technical Details

### Entrypoints

1. **scan-new-pairs** - Scans DEX factories for newly created pairs
   - Parameters: `chain` (required), `dexName` (optional), `fromBlock` (optional), `toBlock` (optional)
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
| Polygon | Uniswap V2, Uniswap V3, QuickSwap |
| BSC | PancakeSwap V2, PancakeSwap V3 |
| Avalanche | Trader Joe V2, JellySwap |

## Source Code

Available at: `/home/ubuntu/.openclaw/workspace/bounties/fresh-markets-watch/`

## License

MIT
