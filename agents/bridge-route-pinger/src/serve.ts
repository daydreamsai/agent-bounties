/**
 * Plain Node HTTP adapter for the Hono app. No extra server dependency: Hono exposes
 * `app.fetch(request)`, so a 20-line node:http bridge is enough to expose the agent on a port.
 *
 * Environment:
 *   PORT  listen port (default 8145)
 *   ADDRESS  x402 pay-to address; when set, entrypoints are paywalled by agent-kit
 *   FACILITATOR_URL  x402 facilitator; defaults to the agent-kit value
 *   NETWORK  x402 network; defaults to the agent-kit value
 *   DEFAULT_PRICE  fallback price in atomic USDC units (e.g. 1000 = $0.001)
 */
import http from "node:http";
import app from "./index.ts";

const port = Number(process.env.PORT || 8145);

async function toRequest(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  // The 402 challenge echoes the request URL as the resource id, so it must be the public one:
  // behind the tunnel the Host header is the public hostname, not 127.0.0.1.
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `127.0.0.1:${port}`);
  const url = `${proto}://${host}${req.url || "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((one) => headers.append(k, one));
    else if (v !== undefined) headers.set(k, v);
  }
  return new Request(url, { method: req.method, headers, body });
}

const server = http.createServer(async (req, res) => {
  try {
    const response = await app.fetch(await toRequest(req));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(err).slice(0, 300) }));
  }
});

server.listen(port, () => {
  console.log(`bridge-route-pinger listening on :${port}`);
});
