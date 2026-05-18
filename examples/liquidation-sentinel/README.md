
## 🛠️ Protocol Integration Guide
The Sentinel is designed for easy expansion. Developers can integrate new lending protocols by adding them to the `protocol` enum and providing the corresponding liquidation threshold logic. See [EXTENDING.md](./EXTENDING.md) for more details.

### Why this implementation?
- **Framework Native:** Built directly on the `@lucid-dreams/agent-kit`.
- **M2M Ready:** First submission to include native **x402 micropayment** support.
- **Production Math:** Uses real-world liquidation formulas for high-accuracy alerting.
