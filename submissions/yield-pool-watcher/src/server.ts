import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runYieldPoolWatcher } from './agent.js';

const port = Number(process.env.PORT || 8799);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/watch_yield_pools/invoke', '/entrypoints/yield-pools/invoke', '/entrypoints/pools/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  properties: {
    protocol_ids: { type: 'array', items: { type: 'string' } },
    pools: { type: 'array', items: { type: 'string' } },
    threshold_rules: { type: 'object' },
    limit: { type: 'integer', default: 25 },
    include_charts: { type: 'boolean', default: true }
  }
};
const entrypoints = [
  { key: 'watch_yield_pools', method: 'POST', path: '/entrypoints/watch_yield_pools/invoke', description: 'Return current APY/TVL metrics, deltas, and threshold alerts for DeFi yield pools.', input_schema: inputSchema },
  { key: 'yield-pools', method: 'POST', path: '/entrypoints/yield-pools/invoke', description: 'Hyphenated alias for yield pool watcher.', input_schema: inputSchema },
  { key: 'pools', method: 'POST', path: '/entrypoints/pools/invoke', description: 'Short alias for yield pool watcher.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => {
  res.json({ ...agentMetadata, url: publicBaseUrl, entrypoints, x402: { protected: invokePaths, network, price: x402Price } });
});
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/watch_yield_pools/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Yield Pool Watcher',
    tags: ['yield', 'defi', 'tvl', 'apy', 'alerts'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'watch_yield_pools' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/watch_yield_pools/invoke': protectedRoute,
    'POST /entrypoints/yield-pools/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/yield-pools/invoke` },
    'POST /entrypoints/pools/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/pools/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runYieldPoolWatcher(input);
    res.json({ output, usage: { pools_returned: output.pool_metrics.length, alerts: output.alerts.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`yield-pool-watcher listening on ${port}`));