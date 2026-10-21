/**
 * 本地开发服务器（Node）。
 *   npm run dev   ->  http://127.0.0.1:8788
 *
 * 生产部署走 Vercel（api/index.ts，hono/vercel 适配器）。
 */

import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT || 8788);
const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, (info: { port: number }) => {
  console.log(`[approval-risk-auditor] listening on http://${hostname}:${info.port}`);
  console.log(`  GET  /health`);
  console.log(`  GET  /entrypoints`);
  console.log(`  GET  /.well-known/agent.json`);
  console.log(`  POST /entrypoints/audit/invoke`);
  console.log(`  POST /entrypoints/echo/invoke`);
});
