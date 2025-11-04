import { wrapFetchWithPayment, createSigner } from "x402-fetch";
import { selectPaymentRequirements } from "x402/client";
import { exact } from "x402/schemes";
import { createPublicClient, http } from "viem";
import { base as baseChain, baseSepolia } from "viem/chains";
import type { Chain } from "viem/chains";

const networkToChain: Record<string, Chain> = {
  base: baseChain,
  "base-sepolia": baseSepolia,
};

export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export function resolveAgentUrl(env: NodeJS.ProcessEnv = process.env): string {
  const defaultUrl = "http://localhost:8787";
  const envPort = env.PORT;
  const envApiBase = env.API_BASE_URL;
  let resolved =
    env.AGENT_URL ??
    envApiBase ??
    (envPort ? `http://localhost:${envPort}` : defaultUrl);

  if (
    !env.AGENT_URL &&
    envPort &&
    envPort !== "8787" &&
    (!envApiBase || envApiBase === defaultUrl)
  ) {
    resolved = `http://localhost:${envPort}`;
  }

  return resolved;
}

export function resolveNetwork(env: NodeJS.ProcessEnv = process.env): string {
  return env.NETWORK ?? "base";
}

export function requirePrivateKey(
  env: NodeJS.ProcessEnv = process.env
): `0x${string}` {
  const key = (env.PAYER_PRIVATE_KEY ?? env.PRIVATE_KEY) as `0x${string}` | undefined;
  if (!key) {
    throw new Error(
      "Set PAYER_PRIVATE_KEY or PRIVATE_KEY in your environment (0x-prefixed EVM private key)."
    );
  }
  return key;
}

export function parseMaxPaymentAtomic(
  env: NodeJS.ProcessEnv = process.env
): bigint {
  const raw = env.MAX_PAYMENT_ATOMIC;
  if (!raw) {
    return 1_000n;
  }
  const value = BigInt(raw);
  if (value <= 0n) {
    throw new Error("MAX_PAYMENT_ATOMIC must be positive.");
  }
  return value;
}

export function parseMaxTimeoutSeconds(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  const raw = env.MAX_TIMEOUT_SECONDS;
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("MAX_TIMEOUT_SECONDS must be a positive number when set.");
  }
  return value;
}

export function createLoggingFetch(): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = init?.headers;
    const headerValue = getPaymentHeader(headers);
    const hasPaymentHeader = Boolean(headerValue);

    console.log(
      `[client] -> fetch ${url}${hasPaymentHeader ? " (with X-PAYMENT)" : ""}`
    );

    if (headerValue) {
      console.log(`[client]    X-PAYMENT (${headerValue.length} chars):`);
      console.log(headerValue);
      try {
        const decoded = exact.evm.decodePayment(headerValue);
        console.dir(
          {
            scheme: decoded.scheme,
            maxAmount: decoded.maxAmount,
            amount: decoded.amount,
            asset: decoded.asset,
            payTo: decoded.payTo,
            payer: decoded.payer,
            nonce: decoded.nonce,
            validAfter: decoded.validAfter,
            validBefore: decoded.validBefore,
          },
          { depth: null }
        );
      } catch (error) {
        console.error("[client] Failed to decode X-PAYMENT:", error);
      }
    }

    const response = await fetch(input, init);
    console.log(
      `[client] <- response ${response.status}${
        response.headers.get("X-PAYMENT-RESPONSE") ? " (settled)" : ""
      }`
    );
    return response;
  };
}

function getPaymentHeader(
  headers: HeadersInit | undefined
): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    return headers.get("X-PAYMENT") ?? headers.get("x-payment") ?? undefined;
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === "x-payment");
    return entry ? entry[1] : undefined;
  }
  if (typeof headers === "object") {
    const record = headers as Record<string, string>;
    return record["X-PAYMENT"] ?? record["x-payment"];
  }
  return undefined;
}

export async function detectClockSkewMs(
  network: string
): Promise<number | null> {
  const chain = networkToChain[network];
  if (!chain) {
    return null;
  }

  const rpcUrl = resolveRpcUrlForChain(chain);
  if (!rpcUrl) {
    console.warn(
      `[client] Unable to resolve RPC URL for network ${network}. Skipping clock skew detection.`
    );
    return null;
  }

  try {
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    const block = await client.getBlock();
    const blockTimestamp = block.timestamp;
    if (blockTimestamp === undefined) {
      return null;
    }
    const chainTimeMs = Number(blockTimestamp) * 1000;
    if (!Number.isFinite(chainTimeMs)) {
      return null;
    }
    const localTimeMs = Date.now();
    return localTimeMs - chainTimeMs;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.warn(
      `[client] Failed to detect clock skew for ${network}: ${message}`
    );
    return null;
  }
}

export function createClockAdjustedFetch(
  baseFetchWithPayment: typeof fetch,
  clockSkewMs: number
): typeof fetch {
  return async (input, init) => {
    const originalDateNow = Date.now;
    (Date as unknown as { now: () => number }).now = () =>
      originalDateNow() - clockSkewMs;
    try {
      return await baseFetchWithPayment(input, init);
    } finally {
      (Date as unknown as { now: () => number }).now = originalDateNow;
    }
  };
}

interface FetchWithPaymentOptions {
  network: string;
  privateKey: `0x${string}`;
  maxPaymentAtomic: bigint;
  maxTimeoutSeconds?: number;
  baseFetch?: typeof fetch;
  debug?: boolean;
}

export async function createFetchWithPayment(
  options: FetchWithPaymentOptions
): Promise<{
  fetchWithPayment: typeof fetch;
  signer: Awaited<ReturnType<typeof createSigner>>;
}> {
  const baseFetch = options.baseFetch ?? createLoggingFetch();
  const signer = await createSigner(options.network, options.privateKey);

  const selector = (
    paymentRequirements: Parameters<typeof selectPaymentRequirements>[0],
    network: Parameters<typeof selectPaymentRequirements>[1],
    scheme: Parameters<typeof selectPaymentRequirements>[2]
  ) => {
    const selected = {
      ...selectPaymentRequirements(paymentRequirements, network, scheme),
    };

    if (options.maxTimeoutSeconds !== undefined) {
      const incoming = selected.maxTimeoutSeconds;
      selected.maxTimeoutSeconds =
        incoming !== undefined
          ? Math.min(incoming, options.maxTimeoutSeconds)
          : options.maxTimeoutSeconds;
    }

    return selected;
  };

  const fetchWithPayment = wrapFetchWithPayment(
    baseFetch,
    signer,
    options.maxPaymentAtomic,
    selector,
    { debug: options.debug ?? true }
  );

  return { fetchWithPayment, signer };
}

export async function invokePaidEntrypoint(
  fetchWithPayment: typeof fetch,
  agentUrl: string,
  key: string,
  payload: unknown
): Promise<{ response: Response; body: unknown }> {
  const response = await fetchWithPayment(
    `${agentUrl}/entrypoints/${key}/invoke`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ input: payload ?? {} }),
    }
  );

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }

  return { response, body };
}

function resolveRpcUrlForChain(chain: Chain): string | null {
  const envVarName = `RPC_URL_${chain.id}`;
  const envSpecific = process.env[envVarName];
  if (envSpecific && envSpecific.trim().length > 0) {
    return envSpecific.trim();
  }
  const fallback =
    process.env.RPC_URL ??
    chain.rpcUrls.public?.http?.[0] ??
    chain.rpcUrls.default?.http?.[0];
  return fallback ?? null;
}
