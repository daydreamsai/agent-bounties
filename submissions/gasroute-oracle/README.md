# GasRoute Oracle

**Bounty:** [Daydreams Agent Bounties #4](https://github.com/daydreamsai/agent-bounties/issues/4)

## Purpose

Find the cheapest chain for transactions by comparing real-time gas prices across 7 EVM chains: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, and Avalanche.

## Features

- **Real-time gas prices** from public RPC endpoints (LlamaRPC)
- **USD cost estimation** using CoinGecko price feeds (cached 60s)
- **Transaction type support:** simple transfers, ERC-20 transfers, swaps
- **Savings calculation** vs Ethereum mainnet
- **Chain comparison** head-to-head between any two chains
- **Sub-second response** with parallel RPC calls

## Actions

| Action | Description |
|--------|-------------|
| `get_gas_prices` | Get current gas prices across all (or filtered) chains |
| `find_cheapest` | Find cheapest chain for a specific tx type with savings data |
| `compare_chains` | Compare two chains across all tx types |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8094** by default.

### Example — Find Cheapest for Swap

```bash
curl -X POST http://localhost:8094/invoke/find_cheapest \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "tx_type": "swap"
    }
  }'
```

### Example — Compare Arbitrum vs Base

```bash
curl -X POST http://localhost:8094/invoke/compare_chains \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain_a": "Arbitrum",
      "chain_b": "Base"
    }
  }'
```

### Example — Get All Gas Prices

```bash
curl -X POST http://localhost:8094/invoke/get_gas_prices \
  -H "Content-Type: application/json" \
  -d '{"input": {}}'
```

## Architecture

```
User Request → Agent-Kit Handler → Parallel RPC Calls → Price Normalization → Response
                                  ↓
                            CoinGecko Price Feed (cached)
```

- Gas prices fetched via `eth_gasPrice` JSON-RPC
- Native token prices from CoinGecko (60s TTL cache)
- All costs calculated in USD for fair comparison
- Parallel fetching for low latency

## Acceptance Criteria

- [x] Covers ≥5 EVM chains (7 covered)
- [x] Reports gas in gwei and USD
- [x] Costs for simple transfer, ERC-20 transfer, and swap
- [x] Savings vs Ethereum calculated
- [x] Uses public RPCs (no API keys required)
- [x] Health check endpoint
