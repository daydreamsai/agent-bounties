/**
 * Simple demo client that configures the watcher and pulls a snapshot while
 * handling x402 payments automatically.
 *
 * Usage:
 *   bunx tsx scripts/demo-client.ts
 *
 * Environment variables:
 *   - AGENT_URL / API_BASE_URL / PORT: agent endpoint resolution
 *   - NETWORK: x402 network (defaults to "base")
 *   - PRIVATE_KEY: agent key (fallback for payer)
 *   - PAYER_PRIVATE_KEY: wallet used for x402 payments
 *   - MAX_PAYMENT_ATOMIC: max spend in base units (defaults to 1,000 USDC base units)
 *   - WATCHER_CONFIG_PATH: path to watcher config JSON
 */

import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "path";
import { readFile } from "fs/promises";
import process from "process";
import type { WatcherConfigInput } from "../src/config";
import {
  CLOCK_SKEW_TOLERANCE_MS,
  createClockAdjustedFetch,
  createFetchWithPayment,
  createLoggingFetch,
  detectClockSkewMs,
  invokePaidEntrypoint,
  parseMaxPaymentAtomic,
  parseMaxTimeoutSeconds,
  requirePrivateKey,
  resolveAgentUrl,
  resolveNetwork,
} from "./client-common";

loadEnv();

interface DemoClientOptions {
  agentUrl: string;
  network: string;
  privateKey: `0x${string}`;
  configPath: string;
}

async function readJsonConfig(path: string): Promise<WatcherConfigInput> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as WatcherConfigInput;
}

function logPaymentsInfo(paymentResponse: Response): void {
  const settlement = paymentResponse.headers.get("X-PAYMENT-RESPONSE");
  if (settlement) {
    console.log("[demo] settlement:", settlement);
  }
}

async function main() {
  const agentUrl = resolveAgentUrl();
  const network = resolveNetwork();
  const privateKey = requirePrivateKey();
  const maxPaymentAtomic = parseMaxPaymentAtomic();
  const maxTimeoutSeconds = parseMaxTimeoutSeconds();

  const options: DemoClientOptions = {
    agentUrl,
    network,
    privateKey,
    configPath: resolvePath(
      process.cwd(),
      process.env.WATCHER_CONFIG_PATH ?? "scripts/sample-watcher-config.json"
    ),
  };

  const baseFetch = createLoggingFetch();
  const detectedClockSkewMs = await detectClockSkewMs(options.network);
  const { fetchWithPayment: wrappedFetchWithPayment, signer } =
    await createFetchWithPayment({
      network: options.network,
      privateKey: options.privateKey,
      maxPaymentAtomic,
      maxTimeoutSeconds,
      baseFetch,
      debug: true,
    });

  const fetchWithPayment =
    detectedClockSkewMs !== null &&
    Math.abs(detectedClockSkewMs) > CLOCK_SKEW_TOLERANCE_MS
      ? createClockAdjustedFetch(wrappedFetchWithPayment, detectedClockSkewMs)
      : wrappedFetchWithPayment;

  console.log("[demo] Payer address:", signer.account.address);

  console.log("[demo] Using agent:", options.agentUrl);
  console.log("[demo] Signing payments on network:", options.network);
  console.log("[demo] Loading watcher config from:", options.configPath);

  const watcherConfig = await readJsonConfig(options.configPath);
  if (
    detectedClockSkewMs !== null &&
    Math.abs(detectedClockSkewMs) > CLOCK_SKEW_TOLERANCE_MS
  ) {
    const skewSeconds = (detectedClockSkewMs / 1000).toFixed(0);
    console.warn(
      `[demo] Detected clock skew of ${skewSeconds}s. Adjusting timestamps when signing payments.`
    );
  } else if (
    detectedClockSkewMs !== null &&
    Math.abs(detectedClockSkewMs) > 1_000
  ) {
    const skewSeconds = (detectedClockSkewMs / 1000).toFixed(0);
    console.warn(
      `[demo] Detected minor clock skew of ${skewSeconds}s (within tolerance).`
    );
  }

  console.log(
    `[demo] Configuring watcher (${watcherConfig.pools.length} pool(s), ${watcherConfig.thresholdRules.length} rule(s))...`
  );

  const configureResult = await invokePaidEntrypoint(
    fetchWithPayment,
    options.agentUrl,
    "configure-watcher",
    watcherConfig
  );

  logPaymentsInfo(configureResult.response);
  console.log("[demo] configure-watcher status:", configureResult.response.status);
  console.dir(configureResult.body, { depth: null });

  if (!configureResult.response.ok) {
    process.exitCode = configureResult.response.status;
    return;
  }

  console.log("[demo] Fetching snapshot...");

  const snapshotResult = await invokePaidEntrypoint(
    fetchWithPayment,
    options.agentUrl,
    "get-snapshot",
    {}
  );

  logPaymentsInfo(snapshotResult.response);
  console.log("[demo] get-snapshot status:", snapshotResult.response.status);
  console.dir(snapshotResult.body, { depth: null });
}

main().catch((error) => {
  console.error("[demo] Error:", error);
  process.exitCode = 1;
});
