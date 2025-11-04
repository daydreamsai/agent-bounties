/**
 * Fetch a paid agent entrypoint without reconfiguring the watcher.
 *
 * Usage:
 *   bunx tsx scripts/fetch-entrypoint.ts [entrypoint] [payloadJson] [--delay=ms]
 *
 * Examples:
 *   bunx tsx scripts/fetch-entrypoint.ts get-snapshot
 *   bunx tsx scripts/fetch-entrypoint.ts get-alerts '{"limit":5}'
 *   bunx tsx scripts/fetch-entrypoint.ts get-snapshot --delay=15000
 *
 * Environment variables mirror scripts/demo-client.ts:
 *   AGENT_URL / API_BASE_URL / PORT, NETWORK, PAYER_PRIVATE_KEY, PRIVATE_KEY,
 *   MAX_PAYMENT_ATOMIC, MAX_TIMEOUT_SECONDS, FETCH_DELAY_MS (optional wait).
 */

import { config as loadEnv } from "dotenv";
import process from "process";
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

function parseArgs() {
  const args = process.argv.slice(2);
  let entrypoint = "get-snapshot";
  let payloadRaw: string | undefined;
  let delayMs: number | undefined;

  for (const arg of args) {
    if (arg.startsWith("--delay=")) {
      const value = Number(arg.split("=", 2)[1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--delay must be a non-negative number of milliseconds.");
      }
      delayMs = value;
      continue;
    }
    if (arg.startsWith("--payload=")) {
      payloadRaw = arg.split("=", 2)[1];
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag "${arg}".`);
    }
    if (entrypoint === "get-snapshot") {
      entrypoint = arg;
    } else if (!payloadRaw) {
      payloadRaw = arg;
    } else {
      throw new Error("Unexpected extra argument. Provide at most entrypoint and payload.");
    }
  }

  if (!entrypoint) {
    entrypoint = "get-snapshot";
  }

  const fallbackDelay = process.env.FETCH_DELAY_MS
    ? Number(process.env.FETCH_DELAY_MS)
    : 0;
  if (delayMs === undefined) {
    delayMs = Number.isFinite(fallbackDelay) && fallbackDelay > 0 ? fallbackDelay : 0;
  }

  return { entrypoint, payloadRaw, delayMs };
}

function parsePayload(payloadRaw: string | undefined): unknown {
  if (!payloadRaw) {
    return {};
  }
  try {
    return JSON.parse(payloadRaw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse payload JSON: ${message}`);
  }
}

function logPaymentsInfo(paymentResponse: Response): void {
  const settlement = paymentResponse.headers.get("X-PAYMENT-RESPONSE");
  if (settlement) {
    console.log("[fetch] settlement:", settlement);
  }
}

async function main() {
  const { entrypoint, payloadRaw, delayMs } = parseArgs();
  const payload = parsePayload(payloadRaw);

  const agentUrl = resolveAgentUrl();
  const network = resolveNetwork();
  const privateKey = requirePrivateKey();
  const maxPaymentAtomic = parseMaxPaymentAtomic();
  const maxTimeoutSeconds = parseMaxTimeoutSeconds();

  if (delayMs && delayMs > 0) {
    console.log(`[fetch] Waiting ${delayMs}ms before invoking ${entrypoint}...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const baseFetch = createLoggingFetch();
  const detectedClockSkewMs = await detectClockSkewMs(network);
  if (
    detectedClockSkewMs !== null &&
    Math.abs(detectedClockSkewMs) > CLOCK_SKEW_TOLERANCE_MS
  ) {
    const skewSeconds = (detectedClockSkewMs / 1000).toFixed(0);
    console.warn(
      `[fetch] Detected clock skew of ${skewSeconds}s. Adjusting timestamps when signing payments.`
    );
  } else if (
    detectedClockSkewMs !== null &&
    Math.abs(detectedClockSkewMs) > 1_000
  ) {
    const skewSeconds = (detectedClockSkewMs / 1000).toFixed(0);
    console.warn(
      `[fetch] Detected minor clock skew of ${skewSeconds}s (within tolerance).`
    );
  }
  const { fetchWithPayment: wrappedFetchWithPayment } =
    await createFetchWithPayment({
      network,
      privateKey,
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

  console.log("[fetch] Using agent:", agentUrl);
  console.log("[fetch] Entry point:", entrypoint);
  console.dir({ payload }, { depth: null });

  const result = await invokePaidEntrypoint(
    fetchWithPayment,
    agentUrl,
    entrypoint,
    payload
  );

  logPaymentsInfo(result.response);
  console.log(
    `[fetch] ${entrypoint} status:`,
    result.response.status
  );
  console.dir(result.body, { depth: null });

  if (!result.response.ok) {
    process.exitCode = result.response.status;
  }
}

main().catch((error) => {
  console.error("[fetch] Error:", error);
  process.exitCode = 1;
});
