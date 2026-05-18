# Extending the Liquidation Sentinel

This guide explains how to add new lending protocols and assets to the J.A.R.V.I.S. Liquidation Sentinel.

## 🚀 Adding a New Protocol

To add a new protocol (e.g., Solend, Marginfi), update the `check_liquidation_risk` entrypoint in `liquidation_sentinel.ts`:

1.  **Update the Zod Schema:** Add the protocol name to the enum.
    ```typescript
    protocol: z.enum(["aave-v3", "compound-v3", "kamino", "drift", "solend"]),
    ```
2.  **Add Price Fetching Logic:** Ensure the `fetch` call includes the new asset's CoinGecko ID.
3.  **Implement Protocol-Specific Math:** If the protocol uses a unique health factor formula, add a switch case in the handler.

## 🛠️ Modular Architecture

The sentinel is designed to be machine-to-machine (M2M) ready via **x402 micropayments**. 

- **Entrypoint:** `check_liquidation_risk`
- **Micropayment Price:** 10,000 Micro-lamports (Configurable in `server.ts`)

## 📊 Roadmap for Contributors
- [ ] Integration with Pyth Network real-time oracles.
- [ ] Automated deleveraging actions (Flash Loans).
- [ ] Cross-chain bridge monitoring.

---
*Maintained by the J.A.R.V.I.S. Engineering Lab*
