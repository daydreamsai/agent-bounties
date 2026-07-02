import { serve } from "@hono/node-server";
import app from "./index";

const PORT = parseInt(process.env.PORT || "3100", 10);
const HOST = process.env.HOST || "0.0.0.0";

console.log(`[approval-risk-auditor] Starting server on ${HOST}:${PORT}`);
console.log(`[approval-risk-auditor] Endpoints:`);
console.log(`  GET  /health`);
console.log(`  GET  /entrypoints`);
console.log(`  POST /entrypoints/audit/invoke`);
console.log(`  POST /entrypoints/audit/stream`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
