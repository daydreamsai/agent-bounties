import { fileURLToPath } from "node:url";

const DEFAULT_ENDPOINT = "https://li.quest/v1/quote";
const DEFAULT_TIMEOUT_MS = 10_000;

function requiredString(input, key) {
  if (typeof input?.[key] !== "string" || input[key].trim() === "") {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return input[key].trim();
}

function normalizeAmount(input) {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    return String(input);
  }
  if (typeof input === "string" && /^\d+(\.\d+)?$/.test(input.trim())) {
    return input.trim();
  }
  throw new TypeError("amount must be a non-negative decimal string or number");
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function feeUsd(quote) {
  const costs = quote?.estimate?.feeCosts;
  if (!Array.isArray(costs) || costs.length === 0) return null;
  let total = 0;
  let found = false;
  for (const item of costs) {
    const amount = asNumber(item.amountUSD ?? item.amountUsd ?? item.usd);
    if (amount !== null) {
      total += amount;
      found = true;
    }
  }
  return found ? Number(total.toFixed(8)) : null;
}

function requirements(quote) {
  const items = quote?.estimate?.gasCosts ?? [];
  return items.map((item) => ({
    type: "gas",
    token: item.token?.symbol ?? item.token?.address ?? null,
    amount: item.amount ?? null,
    amount_usd: asNumber(item.amountUSD ?? item.amountUsd),
    chain: item.token?.chainId ?? item.chainId ?? null,
  }));
}

function normalizeQuote(quote, requested) {
  const tool = quote.toolDetails?.name ?? quote.tool ?? "unknown";
  const routeId = quote.id ?? quote.transactionRequest?.data ?? `${tool}:${quote.action?.fromChainId ?? requested.from_chain}:${quote.action?.toChainId ?? requested.to_chain}`;
  const seconds = asNumber(quote.estimate?.executionDuration ?? quote.estimate?.duration);

  return {
    id: String(routeId),
    provider: "LI.FI",
    bridge: tool,
    from_chain: String(quote.action?.fromChainId ?? requested.from_chain),
    to_chain: String(quote.action?.toChainId ?? requested.to_chain),
    token: quote.action?.fromToken?.symbol ?? requested.token,
    eta_minutes: seconds === null ? null : Math.ceil(seconds / 60),
    fee_usd: feeUsd(quote),
    requirements: requirements(quote),
    received_amount: quote.estimate?.toAmount ?? null,
    raw: quote,
  };
}

export async function getBridgeRoutes(input, options = {}) {
  const token = requiredString(input, "token");
  const amount = normalizeAmount(input.amount);
  const fromChain = requiredString(input, "from_chain");
  const toChain = requiredString(input, "to_chain");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required");
  }

  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    fromChain: fromChain,
    toChain: toChain,
    fromToken: token,
    toToken: token,
    fromAmount: amount,
    order: "CHEAPEST",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`LI.FI quote request failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const quotes = Array.isArray(payload.routes) ? payload.routes : [payload];
  const routes = quotes.filter((quote) => quote && typeof quote === "object").map((quote) => normalizeQuote(quote, { token, from_chain: fromChain, to_chain: toChain }));

  return {
    routes,
    source: endpoint,
    fetched_at: new Date().toISOString(),
    request: { token, amount, from_chain: fromChain, to_chain: toChain },
  };
}

export function createServer({ fetch, endpoint, timeoutMs } = {}) {
  return async function handler(request) {
    if (request.method !== "POST" || new URL(request.url, "http://localhost").pathname !== "/quote") {
      return new Response(JSON.stringify({ error: "POST /quote is required" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), { status: 400, headers: { "content-type": "application/json" } });
    }

    try {
      const result = await getBridgeRoutes(input, { fetch, endpoint, timeoutMs });
      return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "content-type": "application/json" } });
    }
  };
}

export async function startServer({ port = Number(process.env.PORT) || 3000, fetch, endpoint, timeoutMs } = {}) {
  const { createServer: createHttpServer } = await import("node:http");
  const handler = createServer({ fetch, endpoint, timeoutMs });
  const server = createHttpServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const webRequest = new Request(`http://${request.headers.host ?? "localhost"}${request.url}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
    });
    const webResponse = await handler(webRequest);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
    response.end(await webResponse.text());
  });
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().then(() => console.log(`bridge-route-pinger listening on ${process.env.PORT || 3000}`));
}
