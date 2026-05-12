import { serve } from "@hono/node-server";
import app from "./index.js";

const PORT = parseInt(process.env.PORT || "3004");

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🛡️ Lending Liquidation Sentinel agent running on http://localhost:${PORT}`);
console.log(`   Health: http://localhost:${PORT}/health`);
console.log(`   Manifest: http://localhost:${PORT}/.well-known/agent.json`);
console.log(`   Entrypoints: http://localhost:${PORT}/entrypoints`);