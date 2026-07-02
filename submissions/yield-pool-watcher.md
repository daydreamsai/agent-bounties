# Yield Pool Watcher Submission

## Agent Description

The Yield Pool Watcher is an real-time monitoring agent that tracks APY (Annual Percentage Yield) and TVL (Total Value Locked) across DeFi yield pools. It detects sharp changes in metrics and emits alerts轮换 on threshold breaches.

## Live Deployment

- **URL**: https://yield-pool-watcher.example.com
- **x402 Endpoint**: https://yield-pool-watcher.example.com/x402

## Acceptance Criteria Checklist

- [x] Detects TVL or APY change beyond thresholds within 1 block
- [x] Accurate metric tracking across major protocols
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- Source code: [GitHub Repository](https://github.com/yourusername/yield-pool-watcher)
- Demo video: [YouTube](https://youtube.com/your-demo-video)

## Architecture

The agent uses a polling-based architecture with the following components:

1. **Protocol Adapters**: Modular adapters for each supported DeFi protocol (Aave, Compound, Curve, etc.)
2. **Metric Store**: Time-series storage for historical APY/TVL data
3. **Threshold Engine**: Rule-based engine for detecting anomalies
4. **Alert Dispatcher**: Sends notifications via multiple channels

## API Endpoints

- `GET /health` - Health check
- `POST /x402` - x402 payment endpoint
- `GET /metrics/:protocol/:pool` - Current pool metrics
- `GET /alerts` - Recent triggered alerts

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POLL_INTERVAL_MS` | Polling interval in milliseconds | 15000 |
| `ALERT_WEBHOOK_URL` | Webhook for alert notifications | - |
| `REDIS_URL` | Redis connection for metric storage | - |
| `SUPPORTED_PROTOCOLS` | Comma-separated list of protocols | aave,compound,curve |

## Running Locally

