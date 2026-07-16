import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import app from "./index";

const DEFAULT_PORT = 3003;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = process.env.HOST ?? "127.0.0.1";
const publicOrigin = process.env.AGENT_DOMAIN?.trim().replace(/\/+$/, "");

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

async function readLimitedBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_REQUEST_BODY_BYTES) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  try {
    const requestHost = req.headers.host ?? `127.0.0.1:${port}`;
    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto ?? "http";
    const url = new URL(req.url ?? "/", publicOrigin ?? `${proto}://${requestHost}`);
    const method = req.method ?? "GET";
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const body = await readLimitedBody(req);

    const request = new Request(url, {
      method,
      headers,
      body,
    });

    const response = await app.fetch(request);
    res.statusCode = response.status;
    res.statusMessage = response.statusText;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      res.statusCode = 413;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Request body too large" }));
      return;
    }

    const message =
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error instanceof Error
        ? error.message
        : "Internal Server Error";
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(port, host, () => {
  console.log(`Slippage Sentinel listening on http://${host}:${port}`);
});
