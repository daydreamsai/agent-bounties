import { handleHealth, handleScan, withX402 } from "./endpoints";
import { handleWebhook } from "./webhook";
import { handleCron } from "./scanner";
import { getChainConfig } from "./chains";
import type { WorkerState } from "./endpoints";
import { ethers } from "ethers";

interface Env {
  PAIRS_KV: any;
  ALCHEMY_API_KEY: string;
}

const state: WorkerState = {
  lastWebhook: "",
  lastCron: "",
};

function getProvider(chain: string, apiKey: string) {
  const config = getChainConfig(chain);
  const rpcUrl = config.rpcUrl.includes("alchemy")
    ? config.rpcUrl.replace("demo", apiKey)
    : config.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl);
}

export default {
  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/health" && req.method === "GET") {
      const result = await handleHealth(env.PAIRS_KV, state);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/scan" && req.method === "POST") {
      const scanHandler = withX402(async (request: Request) => {
        const body = await request.json();
        const result = await handleScan(body, env.PAIRS_KV);
        return result;
      });

      const result = await scanHandler(req);
      
      const status = result.x402Version ? 402 : 200;
      return new Response(JSON.stringify(result), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/webhook" && req.method === "POST") {
      const payload = await req.json();
      const chain = payload?.event?.blockchain?.network === "eth-mainnet" ? "ethereum" : "bsc";
      const provider = getProvider(chain, env.ALCHEMY_API_KEY);
      const result = await handleWebhook(payload, provider, env.PAIRS_KV, state);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    ctx.waitUntil(
      (async () => {
        for (const chain of ["ethereum", "bsc"]) {
          const provider = getProvider(chain, env.ALCHEMY_API_KEY);
          await handleCron(env.PAIRS_KV, provider, state, chain);
        }
      })()
    );
  },
};
