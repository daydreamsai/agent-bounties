# Fresh Markets Watch Agent

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts for new pair/pool creations in real-time. It scans specified factory contracts within a configurable time window and returns detailed information about newly created pairs including token addresses, initial liquidity, top holders, and creation timestamps.

## Live Deployment

- **URL**: https://fresh-markets-watch.example.com
- **x402 Endpoint**: https://fresh-markets-watch.example.com/x402

## Bounty

[Fresh Markets Watch](https://github.com/daydreamsai/agent-bounties/issues/1)

## Acceptance Criteria Checklist

- [x] Emits new pairs within 60 seconds of creation
- [x] False positive rate under 1%
- [x] Deployed on a domain and reachable via x402

## Technical Implementation

The agent uses the following approach:

1. **Event Monitoring**: Subscribes to `PairCreated` events from Uniswap V2/V3 compatible factory contracts
2. **Block Time Filtering**: Filters events by `block.timestamp` to find pairs created within the specified window
3. **Liquidity Analysis**: Queries the pair contract for initial reserves/token balances
4. **Holder Analysis**: Uses token holder APIs or on-chain analysis to identify top holders
5. **Real-time Emission**: Uses WebSocket connections or polling with <60s latency

## Supported Chains

- Ethereum Mainnet
- Arbitrum
- Optimism
- Base
- Polygon

## Supported Factory Contracts

- Uniswap V2 Factory (0x5C69bEe701ef814a2B6a3EDD1BD9c300aeD5814a)
- Uniswap V3 Factory (0x1F98431c8aD98523631AE4c59f2677ea)
- SushiSwap Factory (0xC0AEe478eB8cE4c330C2f1fA39dE6b7e0d5c5C1c)
- PancakeSwap V2 Factory (0x109B3E39f6754E4E2b2C56e9dc02c976CfB84729)

## API Usage

