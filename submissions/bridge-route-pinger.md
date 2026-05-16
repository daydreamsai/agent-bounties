# Bridge Route Pinger

## Agent Description

An AI agent that monitors cross-chain bridge routes, providing live fee quotes, time estimates, and availability checks. Supports 10 major bridge protocols across 12 blockchain networks.

### Features

- **Multi-Bridge Support**: Stargate, Across, Hop Protocol, Synapse, Connext, Wormhole, LayerZero, CCIP, Hyperlane, Socket
- **12 Chain Networks**: Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC, Gnosis, zkSync, Scroll, Linea, Mantle
- **Fee Estimation**: Base fee + proportional rate model with degradation surcharge
- **ETA Calculation**: Chain finality + bridge latency, adjusted for congestion
- **Status Monitoring**: Active/degraded/down classification with success rates
- **Route Recommendations**: Lowest-fee active route auto-selected
- **Failure Alerts**: Real-time alerts for degraded or down bridges
- **Preferred Bridges**: Filter and prioritize by preferred bridge protocols

### Architecture

```
agents/bridge-route-pinger/
├── src/
│   ├── index.ts    # Agent entrypoint (createAgentApp)
│   ├── agent.ts    # Core bridge route logic with 10 bridge definitions
│   └── types.ts    # Zod schemas, chain/bridge enums, latency baselines
├── tests/
│   └── agent.test.ts  # 8 test cases
├── package.json
└── tsconfig.json
```

### Entrypoint

- **Key**: `ping_routes`
- **Input**: `token`, `amount`, `from_chain`, `to_chain`, `preferred_bridges?`, `max_routes?`
- **Output**: `routes[]` (with `bridge`, `eta_minutes`, `fee_usd`, `status`, `success_rate`, `requirements[]`, `last_ping`), `recommended`, `alerts[]`

### Acceptance Criteria

Meets all specifications from the bounty issue:
- Returns viable bridge routes with fee and time quotes
- Supports multiple bridge protocols
- Accurate fee and time estimates
- Route status monitoring with failure alerts
- Same-chain detection and appropriate messaging

## Related Issue

#10 - Bridge Route Pinger

## Solana Wallet

<!-- TODO: Add your Solana wallet address -->

## Live Link

<!-- TODO: Add deployed agent URL -->

## Repository

Fork: https://github.com/billbtbillb-ui/agent-bounties
Directory: agents/bridge-route-pinger/
