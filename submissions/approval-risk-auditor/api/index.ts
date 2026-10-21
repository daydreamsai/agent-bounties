/**
 * Vercel (Node runtime) 入口 —— 暴露 agent-kit 的 hono app。
 * x402 支付中间件由 agent-kit 自动挂载，env 见 .env.example。
 *
 * 注意: 这里用无扩展名的相对 import，让 Vercel 的 TS 构建器正确解析到 ../src/app.ts
 */
import { handle } from "hono/vercel";
import { app } from "../src/app";

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
