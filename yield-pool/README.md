## yield-pool

This project was scaffolded with `create-agent-kit` and ships with a ready-to-run agent app built on [`@lucid-dreams/agent-kit`](https://www.npmjs.com/package/@lucid-dreams/agent-kit).

### Quick start

```sh
bun install
bun run dev
```

The dev command runs `bun` in watch mode, starts the HTTP server, and reloads when you change files inside `src/`.

### Project structure

- `src/agent.ts` – defines your agent manifest and entrypoints.
- `src/index.ts` – boots a Bun HTTP server with the agent.

### Available scripts

- `bun run dev` – start the agent in watch mode.
- `bun run start` – start the agent once.
- `bun run agent` – run the agent module directly (helpful for quick experiments).
- `bunx tsc --noEmit` – type-check the project.

### Next steps

- Update `src/agent.ts` with your use case.
- Wire up `@lucid-dreams/agent-kit` configuration and secrets (see `AGENTS.md` in the repo for details).
- Copy `.env.example` to `.env` and fill in the values for your environment.
- Deploy with your preferred Bun-compatible platform when you're ready.

## Deployment

### Railway

This project ships with a `Dockerfile` compatible with Railway's Bun runtime. The high-level deployment flow:

1. Push your changes to a GitHub repository.
2. Create a new Railway project and choose **Deploy from GitHub repo**.
3. When prompted for the service path, select `yield-pool/` (or set the Working Directory to `yield-pool`).
4. Railway auto-detects the Dockerfile and builds from `oven/bun`. No extra build command is required.
5. Set the start command to `bun run start` (Railway injects the `PORT` environment variable automatically).
6. Configure environment variables:
   - `FACILITATOR_URL` – x402 facilitator (defaults to Daydreams prod if unset).
   - `PAY_TO` – EVM address that will receive payments.
   - `NETWORK` – x402 payment network (e.g. `base`).
   - `DEFAULT_PRICE` – fallback price (string, e.g. `0.1`).
   - `RPC_URL_8453` – Base mainnet RPC provider URL (Alchemy/Infura/etc).
   - Any other `RPC_URL_<chainId>` you support.
7. Redeploy. Railway assigns a public URL once the container is healthy.

You can customize the polling cadence by passing `POLLING_INTERVAL_MS` in your watcher configuration via `configure-watcher`.

### Verifying the deployment

After Railway finishes the deploy:

```sh
curl https://<railway-domain>/.well-known/agent.json
```

Confirm the manifest loads and reflects your configuration. Use the demo client or the fetch helper scripts to run `configure-watcher`, `get-snapshot`, and `get-alerts` against the hosted URL to make sure x402 payments settle end-to-end.

## Registering on x402scan

1. Ensure the Railway deployment is publicly reachable and that the `.well-known/agent.json` endpoint returns the agent manifest.
2. Visit [https://x402scan.xyz/agents/register](https://x402scan.xyz/agents/register) (or the latest registration URL).
3. Submit the Railway HTTPS URL as the agent endpoint.
4. Complete the verification flow:
   - x402scan will issue a 402 challenge; confirm that your agent responds with the expected payment requirements (you can cross-check using the fetch helper script locally).
   - Once payment settles, the registry will validate the manifest and entrypoints.
5. After approval, the agent will show up in x402scan with its status and payment info.

If you need to rotate deployment URLs, update the agent manifest (if required) and resubmit to x402scan so the registry points to the new endpoint. For troubleshooting, use `bunx tsx scripts/fetch-entrypoint.ts` against the Railway URL to inspect payment headers and responses directly.
