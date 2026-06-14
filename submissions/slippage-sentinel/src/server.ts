import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runSlippageSentinel } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8804);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/estimate_slippage/invoke', '/entrypoints/slippage/invoke', '/entrypoints/slippage-sentinel/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['token_in', 'token_out', 'amount_in'],
  properties: {
    chain: { enum: supportedChains, default: 'base' },
    token_in: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    token_out: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    amount_in: { oneOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'string', minLength: 1 }] },
    route_hint: {
      type: 'object',
      properties: {
        chain: { enum: supportedChains },
        dex: { type: 'string' },
        pool_address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        pool_id: { type: 'string' }
      }
    },
    max_pools: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
    trade_window_hours: { type: 'integer', minimum: 1, maximum: 24, default: 6 }
  }
};
const entrypoints = [
  { key: 'estimate_slippage', method: 'POST', path: '/entrypoints/estimate_slippage/invoke', description: 'Recommend safe swap slippage from live pool depth and recent trade flow.', input_schema: inputSchema },
  { key: 'slippage', method: 'POST', path: '/entrypoints/slippage/invoke', description: 'Short alias for slippage estimation.', input_schema: inputSchema },
  { key: 'slippage-sentinel', method: 'POST', path: '/entrypoints/slippage-sentinel/invoke', description: 'Hyphenated alias for slippage estimation.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => {
  res.json({ ...agentMetadata, url: publicBaseUrl, supported_chains: supportedChains, entrypoints, x402: { protected: invokePaths, network, price: x402Price } });
});
app.get('/entrypoints', (_req, res) => {
  res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) });
});

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/estimate_slippage/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Slippage Sentinel',
    tags: ['slippage', 'defi', 'swap', 'risk', 'x402'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'estimate_slippage' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/estimate_slippage/invoke': protectedRoute,
    'POST /entrypoints/slippage/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/slippage/invoke` },
    'POST /entrypoints/slippage-sentinel/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/slippage-sentinel/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runSlippageSentinel(input);
    res.json({ output, usage: { pools_evaluated: output.pool_depths.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`slippage-sentinel listening on ${port}`));
