# Morpho Blue Looping Simulator – Submission

## Agent Information
- **Name:** Morpho Blue Looping Simulator (entrypoint key: `simulateLooping`)
- **Description:** Deterministic Morpho Blue WETH/USDC looping planner that models recursive borrow/supply loops, stress scenarios, and policy guardrails before executing on-chain. Supports live market parameters, Kyber swap routing, and x402 payments.
- **Live Endpoint: https://strategy-sim.vercel.app/entrypoints/simulateLooping/invoke
- **Discovery:** `GET /.well-known/agent.json` and `GET /.well-known/x402` served by the agent-kit wrapper.

## Acceptance Criteria
- ✅ Implements Morpho Blue Base WETH/USDC looping simulation with deterministic math (BigNumber).
- ✅ Enforces x402 payments through Coinbase facilitator via agent-kit.
- ✅ Provides stress testing hooks (price jump, rate shift, oracle lag) and reports policy violations (`canExecute`, `reason`).
- ✅ Integrates KyberSwap Aggregator API v1 (`/{chain}/api/v1/routes`) with address/amount normalization and optional AMM fallback for testnets.
- ✅ Supplies idempotency caching, IP rate limiting, provenance hashing, and structured logging (including payment lifecycle when `DEBUG_LOOP=1`).

## Implementation Details

### Technology Stack
- **Runtime:** Bun 1.3 (TypeScript, ESM).
- **Server:** Hono wrapped by `@lucid-dreams/agent-kit` for AP2/x402 manifest + middleware.
- **Math & Data:** `bignumber.js`, Kyber Aggregator API, Morpho Blue GraphQL API.
- **Payments:** x402 (Coinbase facilitator) via agent-kit/x402-fetch helpers.

### Core Features
- Live Morpho snapshot fetch with fixture fallback (when `MORPHO_LIVE_DISABLED=1`).
- Loop engine computing borrow amount, swap slippage, interest accrual, health factor trajectory.
- Stress scenarios (price shock, borrow-rate shift, oracle lag) with min-HF & liquidation reporting.
- Action plan generation (borrow/swap/supply steps) and provenance hashing for reproducibility.
- Policy envelope (min HF, max leverage) with configurable defaults.
- Extensive logging: request receipt, market snapshot source, payment verification/settlement attempt logs, simulation summary.

## API Endpoint

### POST `/entrypoints/simulateLooping/invoke`
AP2/x402 compliant entrypoint (requires payment unless using unpaid helper).

**Request Body**
```json
{
  "input": {
    "protocol": "morpho-blue",
    "chain": "base",
    "collateral": { "symbol": "WETH", "decimals": 18 },
    "debt": { "symbol": "USDC", "decimals": 6 },
    "start_capital": "1",
    "target_ltv": 0.6,
    "loops": 3,
    "horizon_days": 30
  }
}
```

**Full-feature Input Example**
```json
{
  "input": {
    "protocol": "morpho-blue",
    "chain": "base",
    "collateral": {
      "symbol": "WETH",
      "decimals": 18,
      "address": "0x4200000000000000000000000000000000000006"
    },
    "debt": {
      "symbol": "USDC",
      "decimals": 6,
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    },
    "start_capital": "2.5",
    "target_ltv": 0.55,
    "loops": 2,
    "horizon_days": 45,
    "price": { "WETHUSD": 3200, "USDCUSD": 1 },
    "rates": { "supply_apr": 0.02, "borrow_apr": 0.035 },
    "oracle": { "type": "chainlink", "lag_seconds": 600 },
    "swap_model": {
      "type": "amm_xyk",
      "fee_bps": 10,
      "pool": { "base_reserve": 500000, "quote_reserve": 150000000 }
    },
    "scenarios": [
      { "type": "price_jump", "asset": "WETH", "shock_pct": -0.15, "at_day": 10 },
      { "type": "rates_shift", "borrow_apr_delta_bps": 150 },
      { "type": "oracle_lag", "lag_seconds": 1200 }
    ],
    "risk_limits": { "min_hf": 1.05, "max_leverage": 8 }
  }
}
```

**Response (wrapper)**
```json
{
  "run_id": "…",
  "status": "succeeded",
  "output": {
    "summary": {
      "loops_done": 3,
      "gross_leverage": 4.92,
      "net_apr": -0.00098,
      "hf_now": 1.079,
      "liq_price": { "WETH": 3564.72 },
      "slip_cost_usd": 67.51
    },
    "time_series": [ … ],
    "stress": [],
    "action_plan": [ … ],
    "canExecute": false,
    "reason": "final health factor 1.0793 is below minimum 1.1"
  }
}
```

## Setup & Deployment
1. Install dependencies: `bun install`
2. Copy `.env.example` to `.env`; populate payment + Morpho/Kyber settings.
3. Start dev server: `bun run dev -- --debug`
   - Serves on `http://localhost:8787`
4. Optional: build/test
   - `bun test`
   - `bunx tsc --noEmit`

## Testing & QA
- **Automated:** `bun test` (covers AMM math, adapter caches, rate limits, engine scenarios, API unpaid flow).
- **Manual unpaid:** `bun run test-loop.ts` (set `TEST_USE_SWAP_MODEL=1` for deterministic runs).
- **Manual paid:** `bun run pay:call` or `bun run pay:call -- --full` (requires wallet funded on `NETWORK`).
- **Health:** `curl http://localhost:8787/health` (returns `{ "ok": true }`).

## Repository & Key Files
- **Repo:** (local) `strategy-sim`
- **Primary Files:**
  - `src/entrypoints/simulateLooping.ts` – entrypoint handler (logging, policy, payment instrumentation).
  - `src/core/looping.ts` – deterministic loop engine & stress handling.
  - `src/adapters/` – Morpho snapshot & Kyber routing clients.
  - `scripts/` – helper scripts for dev/start/testing/payments.
  - `.well-known/agent.json` – manifest for discovery.

## Wallet Information
- **Payment recipient (PAY_TO):** `0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429`
- **Solana Wallet**: `7iEcbihBmPafx8nwQyeb1nXAktuJxgGuBrfhCsvJF1pD`

---
_Submitted by_: [Suri](https://x.com/SuriPuri23)  •  Date: November 1, 2025
