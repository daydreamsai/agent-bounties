# yield-pool

Agent that monitors DeFi yield pools, stores historical metrics, emits TVL/APY alerts, and serves paid entrypoints over the x402 protocol. It is built with [`@lucid-dreams/agent-kit`](https://www.npmjs.com/package/@lucid-dreams/agent-kit) and runs on Bun.

## Architecture

- **Entrypoint router** (`src/agent.ts` + `@lucid-dreams/agent-kit`): exposes paid functions under `/entrypoints/<key>/invoke` and publishes the manifest at `/.well-known/agent.json`.
- **Monitoring service** (`src/services/monitoring.ts`): keeps each watcher’s configuration, polls on-chain protocols, calculates deltas, and triggers alert events.
- **Storage** (`src/storage/postgres.ts`): persists watcher configs, metrics, deltas, and alerts in Postgres so multiple payers can share a deployment safely.
- **Protocol adapters** (`src/protocols/*`): encapsulate per-protocol logic (currently Aave v3 + Curve) and can be extended.
- **Summaries** (`src/services/llm.ts` + `src/utils/analytics.ts`): optional OpenAI-backed watcher summaries with deterministic fallbacks when an API key is not provided.

## Hosted Access

- **Base URL**: `https://agent-bounties-yield-pool.up.railway.app`
- **x402scan listing**: [https://www.x402scan.com/server/b4f155d4-a731-4f2b-8d61-a3b058d7992e](https://www.x402scan.com/server/b4f155d4-a731-4f2b-8d61-a3b058d7992e)
- Each entrypoint is accessible at `POST {baseUrl}/entrypoints/<key>/invoke` and requires an `X-PAYMENT` header signed through x402.
- Helper scripts in `scripts/` can target the hosted deployment by setting `AGENT_URL=https://agent-bounties-yield-pool.up.railway.app`.

### Project structure (for maintainers)

- `src/agent.ts` – manifest + entrypoint definitions
- `src/runtime.ts` – wires monitoring, storage, and LLM services
- `src/services/*` – monitoring loop, database connector, LLM integration
- `src/protocols/*` – pluggable adapters for on-chain protocols
- `scripts/` – x402 helper clients and sample configs

## Self-hosting (optional)

Set these variables if you run your own deployment (the hosted Railway instance is already configured):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string used for watcher storage |
| `FACILITATOR_URL` | ✅ | x402 facilitator URL (defaults to `https://facilitator.daydreams.systems`) |
| `PAY_TO` | ✅ | EVM address that receives x402 payments |
| `NETWORK` | ✅ | x402 payment network (e.g. `base`, `base-sepolia`) |
| `DEFAULT_PRICE` | ✅ | Default 402 price (string, defaults to `0.1`) |
| `PORT` | ➖ | Port Bun should listen on (defaults to `8787`) |
| `RPC_URL_<chainId>` | ➖ | RPC URL per-chain (e.g. `RPC_URL_8453` for Base). Falls back to `RPC_URL`. |
| `OPENAI_API_KEY` | ➖ | Enables LLM-backed watcher summaries |
| `OPENAI_MODEL` | ➖ | Override OpenAI model (default `gpt-4o-mini`) |
| `OPENAI_BASE_URL` | ➖ | Point to an OpenAI-compatible API endpoint |
| `LLM_PROVIDER` | ➖ | Set to `openai` (default) or another provider (others disable LLMs) |
| `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_MAX_LIFETIME` | ➖ | Optional Postgres tuning knobs |

You can override the monitoring cadence per watcher by including `pollingIntervalMs` in the `configure-watcher` payload.

## Using the x402 flow

1. **Manifest discovery** – `GET https://agent-bounties-yield-pool.up.railway.app/.well-known/agent.json` publishes the agent metadata, entrypoints, and pricing.
2. **Paid invocation** – each entrypoint lives at `POST https://agent-bounties-yield-pool.up.railway.app/entrypoints/<key>/invoke` and expects:
   ```json
   {
     "input": { /* entrypoint-specific payload */ }
   }
   ```
   Requests must include an `X-PAYMENT` header signed using x402.
3. **Helpers** – the repo bundles clients that manage payments automatically:
   - `AGENT_URL=https://agent-bounties-yield-pool.up.railway.app bunx tsx scripts/demo-client.ts` – configures a watcher, triggers a snapshot, and prints settlements.
   - `AGENT_URL=https://agent-bounties-yield-pool.up.railway.app bunx tsx scripts/fetch-entrypoint.ts get-snapshot '{"watcherId":"0x..."}'` – call any entrypoint without reconfiguring.

   Shared environment variables for these scripts:
   - `AGENT_URL` / `API_BASE_URL` / `PORT` – point the scripts at the agent (set `AGENT_URL=https://agent-bounties-yield-pool.up.railway.app`; defaults to localhost if unset)
   - `NETWORK` – payment network (`base` by default)
   - `PAYER_PRIVATE_KEY` / `PRIVATE_KEY` – private key used to sign payments
   - `MAX_PAYMENT_ATOMIC` – max spend in atomic units (defaults to `1000`)
   - `MAX_TIMEOUT_SECONDS` – optional upper bound on required validity windows
   - `WATCHER_ID` – optional override; defaults to the payer address

   The helpers also detect clock skew and adjust signed timestamps when your local clock drifts relative to the on-chain time.

All entrypoints require a `watcherId` so multiple wallets can share one deployment without clobbering each other’s state. The helper scripts derive the ID from the payer’s address automatically.

## API reference

Every entrypoint returns `{ "output": … }` on success and emits x402 settlement headers when payments clear. Errors follow the agent-kit default shape `{ "error": { "type": string, "message": string } }`.

### `configure-watcher`

- **Path**: `POST /entrypoints/configure-watcher/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/configure-watcher/invoke`
- **Purpose**: Register/update the watcher’s protocol, pool, and threshold configuration.
- **Body fields**

  | Field | Type | Required | Description | Example |
  | --- | --- | --- | --- | --- |
  | `input.watcherId` | `string` | ✅ | Identifier for the watcher (typically the payer wallet address). | `0x1234567890abcdef1234567890abcdef12345678` |
  | `input.config.protocolIds` | `string[]` | ✅ | Protocol identifiers to poll. | `["aave-v3"]` |
  | `input.config.pools[].id` | `string` | ✅ | Human readable pool identifier. | `"base-usdc"` |
  | `input.config.pools[].protocolId` | `string` | ✅ | Protocol that owns the pool. | `"aave-v3"` |
  | `input.config.pools[].chainId` | `number` | ✅ | EVM chain id hosting the pool. | `8453` |
  | `input.config.pools[].address` | `string` | ✅ | Pool contract address. | `"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"` |
  | `input.config.pools[].metadata.poolContract` | `string` | ✅ | Protocol-specific pool contract. | `"0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"` |
  | `input.config.pools[].metadata.priceOracle` | `string` | ✅ | Oracle contract for pricing. | `"0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156"` |
  | `input.config.pools[].metadata.aTokenAddress` | `string` | ✅ (Aave) | aToken contract used to read supply. | `"0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB"` |
  | `input.config.pools[].metadata.underlyingAsset` | `string` | ✅ | Underlying asset contract. | `"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"` |
  | `input.config.pools[].metadata.assetDecimals` | `number` | ✅ | Decimal precision of the asset. | `6` |
  | `input.config.thresholdRules[].id` | `string` | ✅ | Unique identifier for the rule. | `"tvl-spike"` |
  | `input.config.thresholdRules[].metric` | `"tvl" \| "apy"` | ✅ | Metric tracked by the rule. | `"tvl"` |
  | `input.config.thresholdRules[].change.type` | `"percent" \| "absolute"` | ✅ | Threshold evaluation style. | `"percent"` |
  | `input.config.thresholdRules[].change.direction` | `"increase" \| "decrease" \| "both"` | ✅ | Change direction to monitor. | `"increase"` |
  | `input.config.thresholdRules[].change.amount` | `number` | ✅ | Threshold amount (percent or absolute). | `0.00005` |
  | `input.config.thresholdRules[].window.type` | `"blocks" \| "minutes"` | ✅ | Look-back window units. | `"blocks"` |
  | `input.config.thresholdRules[].window.value` | `number` | ✅ | Size of the look-back window. | `1` |
  | `input.config.pollingIntervalMs` | `number` | ➖ | Optional per-watcher polling cadence in ms. | `12000` |

- **Example request body**

  ```json
  {
    "watcherId": "0x1234567890abcdef1234567890abcdef12345678",
    "config": {
      "protocolIds": ["aave-v3"],
      "pools": [
        {
          "id": "base-usdc",
          "protocolId": "aave-v3",
          "chainId": 8453,
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "metadata": {
            "poolContract": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            "priceOracle": "0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156",
            "aTokenAddress": "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
            "underlyingAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "assetDecimals": 6
          }
        }
      ],
      "thresholdRules": [
        {
          "id": "tvl-spike",
          "metric": "tvl",
          "change": {
            "type": "percent",
            "direction": "increase",
            "amount": 0.00005
          },
          "window": {
            "type": "blocks",
            "value": 1
          }
        }
      ],
      "pollingIntervalMs": 12000
    }
  }
  ```
- **Output**:
  ```json
  {
    "output": {
      "watcherId": "string",
      "protocolIds": ["string"],
      "pools": [
        { "protocolId": "string", "poolId": "string", "chainId": 8453 }
      ],
      "thresholdRules": [
        { "id": "string", "metric": "apy" }
      ],
      "pollingIntervalMs": 12000,
      "configVersion": 3
    }
  }
  ```

Config validation is enforced by Zod (`src/config.ts`). Reconfiguring clears cached metrics/deltas while leaving historic data intact.

### `get-snapshot`

- **Path**: `POST /entrypoints/get-snapshot/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/get-snapshot/invoke`
- **Purpose**: Return the latest pool metrics, calculated deltas, and most recent alerts for a watcher.

- **Body fields**

  | Field | Type | Required | Description | Example |
  | --- | --- | --- | --- | --- |
  | `input.watcherId` | `string` | ✅ | Watcher to query (payer wallet address or custom id). | `0x1234567890abcdef1234567890abcdef12345678` |
  | `input.protocolId` | `string` | ➖ | Filter results to a specific protocol. | `"aave-v3"` |
  | `input.poolId` | `string` | ➖ | Filter results to a specific pool id. | `"base-usdc"` |
  | `input.alertLimit` | `number` | ➖ | Limit number of alerts returned (max 500). | `5` |

- **Example request body**

  ```json
  {
    "watcherId": "0x1234567890abcdef1234567890abcdef12345678",
    "protocolId": "aave-v3",
    "poolId": "base-usdc",
    "alertLimit": 5
  }
  ```
- **Output**:
  ```json
  {
    "output": {
      "pool_metrics": [
        {
          "protocolId": "aave-v3",
          "poolId": "base-usdc",
          "chainId": 8453,
          "address": "0x...",
          "blockNumber": "123456789",
          "timestamp": 1710000000000,
          "apy": 12.34,
          "tvl": 5432100.12,
          "raw": { "...": "..." }
        }
      ],
      "deltas": [
        {
          "protocolId": "aave-v3",
          "poolId": "base-usdc",
          "metric": "tvl",
          "previous": 5200000,
          "current": 5432100.12,
          "absoluteChange": 232100.12,
          "percentChange": 4.46,
          "timestamp": 1710000000000,
          "blockNumber": "123456789"
        }
      ],
      "alerts": [
        {
          "id": "alert::tvl-spike::aave-v3::base-usdc::123456789",
          "protocolId": "aave-v3",
          "poolId": "base-usdc",
          "metric": "tvl",
          "ruleId": "tvl-spike",
          "triggeredAt": 1710000000500,
          "blockNumber": "123456789",
          "changeDirection": "increase",
          "changeAmount": 232100.12,
          "percentChange": 4.46,
          "message": "Rule tvl-spike triggered ...",
          "metadata": { "...": "..." }
        }
      ]
    }
  }
  ```

### `get-alerts`

- **Path**: `POST /entrypoints/get-alerts/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/get-alerts/invoke`
- **Purpose**: Fetch recent alert events with optional protocol/pool filtering.

- **Body fields**

  | Field | Type | Required | Description | Example |
  | --- | --- | --- | --- | --- |
  | `input.watcherId` | `string` | ✅ | Watcher to pull alerts for. | `0x1234567890abcdef1234567890abcdef12345678` |
  | `input.protocolId` | `string` | ➖ | Filter to a single protocol. | `"aave-v3"` |
  | `input.poolId` | `string` | ➖ | Filter to a specific pool id. | `"base-usdc"` |
  | `input.limit` | `number` | ➖ | Maximum alerts to return (≤500). | `10` |

- **Example request body**

  ```json
  {
    "watcherId": "0x1234567890abcdef1234567890abcdef12345678",
    "protocolId": "aave-v3",
    "poolId": "base-usdc",
    "limit": 10
  }
  ```
- **Output**:
  ```json
  {
    "output": {
      "alerts": [ /* same shape as get-snapshot alerts */ ]
    }
  }
  ```

### `summarize-watcher`

- **Path**: `POST /entrypoints/summarize-watcher/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/summarize-watcher/invoke`
- **Purpose**: Produce a natural-language summary of the watcher’s config, recent changes, and alerts.

- **Body fields**

  | Field | Type | Required | Description | Example |
  | --- | --- | --- | --- | --- |
  | `input.watcherId` | `string` | ✅ | Watcher to summarize. | `0x1234567890abcdef1234567890abcdef12345678` |
  | `input.timeframeHours` | `number` | ➖ | Look-back window in hours (1–168). Defaults to 24. | `24` |
  | `input.maxRecentAlerts` | `number` | ➖ | Alerts per pool to include in the summary (1–20). | `5` |

- **Example request body**

  ```json
  {
    "watcherId": "0x1234567890abcdef1234567890abcdef12345678",
    "timeframeHours": 24,
    "maxRecentAlerts": 5
  }
  ```
- **Output**:
  ```json
  {
    "output": {
      "summary": "Watcher is monitoring ...",
      "data": {
        "generatedAt": "2024-05-01T12:00:00.000Z",
        "timeframeHours": 24,
        "watcherConfig": { "...": "..." },
        "pools": [ /* per-pool stats */ ],
        "alertTotals": {
          "totalAlerts24h": 2,
          "byRule": [{ "ruleId": "apy-drop", "count": 2 }]
        }
      },
      "llm": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    }
  }
  ```

The `llm` field appears only when the LLM service is enabled and successfully returns text.

### `find-top-yields`

- **Path**: `POST /entrypoints/find-top-yields/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/find-top-yields/invoke`
- **Purpose**: Rank the highest-yielding pools being monitored for a given chain.

- **Body fields**

  | Field | Type | Required | Description | Example |
  | --- | --- | --- | --- | --- |
  | `input.watcherId` | `string` | ✅ | Watcher whose monitored pools are ranked. | `0x1234567890abcdef1234567890abcdef12345678` |
  | `input.chainId` | `number` | ✅ | EVM chain id to evaluate. | `8453` |
  | `input.limit` | `number` | ➖ | Max pools to return (default 5, max 50). | `5` |
  | `input.minTvlUsd` | `number` | ➖ | Filter out pools with TVL below this USD value. | `1000000` |
  | `input.sortBy` | `"apy" \| "tvl"` | ➖ | Sort metric (`"apy"` default). | `"apy"` |

- **Example request body**

  ```json
  {
    "watcherId": "0x1234567890abcdef1234567890abcdef12345678",
    "chainId": 8453,
    "limit": 5,
    "minTvlUsd": 1000000,
    "sortBy": "apy"
  }
  ```
- **Output**:
  ```json
  {
    "output": {
      "results": [
        {
          "protocolId": "curve",
          "poolId": "tri-crypto",
          "chainId": 8453,
          "apy": 18.76,
          "tvl": 12000000.45,
          "timestamp": 1710000000000,
          "blockNumber": "123456789"
        }
      ]
    }
  }
  ```

### `health`

- **Path**: `POST /entrypoints/health/invoke`
- **Hosted URL**: `https://agent-bounties-yield-pool.up.railway.app/entrypoints/health/invoke`
- **Purpose**: Report monitoring status without touching watcher state.
- **Input**:
  ```json
  {}
  ```
- **Output**:
  ```json
  {
    "output": {
      "status": "ok",
      "pollingIntervalMs": 12000,
      "activePools": 4,
      "configuredProtocols": 2,
      "lastRunAt": 1710000000000
    }
  }
  ```

## Sample watcher configuration

`scripts/sample-watcher-config.json` sets up an Aave v3 USDC pool on Base:

```jsonc
{
  "protocolIds": ["aave-v3"],
  "pools": [
    {
      "id": "base-usdc",
      "protocolId": "aave-v3",
      "chainId": 8453,
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "metadata": {
        "poolContract": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        "priceOracle": "0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156",
        "aTokenAddress": "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
        "underlyingAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "assetDecimals": 6
      }
    }
  ],
  "thresholdRules": [
    {
      "id": "tvl-spike",
      "metric": "tvl",
      "change": { "type": "percent", "direction": "increase", "amount": 0.00005 },
      "window": { "type": "blocks", "value": 1 }
    }
  ]
}
```

Use it as a template when onboarding new pools.

## Watcher storage semantics

- Each payer wallet maps to its own watcher row in Postgres. Metrics, deltas, and alerts are isolated per watcher so multiple users can share a deployment.
- Every entrypoint expects a `watcherId`. Helper scripts derive it from the payer address; override with `WATCHER_ID=<custom-id>` if necessary.
- Reconfiguring a watcher clears its in-memory cache and schedules an immediate poll, but historic metrics remain available for summaries and analytics.

## LLM summaries & yield search

- `summarize-watcher` generates natural-language recaps using OpenAI when `OPENAI_API_KEY` + `LLM_PROVIDER=openai` are set. Without an API key it falls back to a deterministic summary built from the same dataset.
- `find-top-yields` surfaces the highest-yielding pools tracked on a chain, optionally filtered by minimum TVL and sorted by APY or TVL.

Both entrypoints rely on the monitoring service having up-to-date metrics. Make sure your deployment has outbound network access to the configured RPCs and (if enabled) the OpenAI endpoint.

## Solana Wallet Address

6iThbDBdkei9VUXAJF5driPzhHoyrg1By9ssBecN1aCt
