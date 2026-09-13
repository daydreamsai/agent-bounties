import type { KVNamespace } from "@cloudflare/workers-types";
import { asPoolId } from "./address";
import { listSnapshots } from "./kv";
import { withX402 } from "./x402";

export interface Env {
  SNAPSHOTS_KV: KVNamespace;
  X402_PAY_TO: string;
  X402_PRICE_USDC?: string;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function metricsResponse(request: Request, env: Env): Promise<Response> {
  let body: { pools?: unknown } = {};

  try {
    if (request.headers.get("Content-Type")?.includes("application/json")) {
      body = (await request.json()) as { pools?: unknown };
    }
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  let requestedPools: Set<string> | undefined;
  if (body.pools !== undefined) {
    if (
      !Array.isArray(body.pools) ||
      !body.pools.every((pool): pool is string => typeof pool === "string")
    ) {
      return json({ error: "pools must be an array of EVM addresses" }, 400);
    }

    try {
      requestedPools = new Set(body.pools.map((pool) => asPoolId(pool)));
    } catch {
      return json({ error: "pools must contain valid EVM addresses" }, 400);
    }
  }

  const snapshots = await listSnapshots(env.SNAPSHOTS_KV);
  const filtered = requestedPools
    ? snapshots.filter((snapshot) => requestedPools?.has(snapshot.pool_id))
    : snapshots;

  return json({
    snapshots: filtered,
    count: filtered.length,
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "ok",
        service: "yield-pool-watcher-foundation",
        x402: {
          network: "eip155:8453",
          asset: "USDC",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/metrics") {
      const handler = withX402(
        (paidRequest) => metricsResponse(paidRequest, env),
        {
          payTo: env.X402_PAY_TO,
          amountAtomicUnits: env.X402_PRICE_USDC ?? "10000",
          description: "Read the latest cached yield-pool snapshots",
          serviceName: "Yield Pool Watcher",
        },
      );
      return handler(request);
    }

    return json({ error: "Not found" }, 404);
  },
};

export default worker;
