import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runFreshMarketsWatch } from './agent.js';

const port = Number(process.env.PORT || 8802);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/watch_fresh_markets/invoke', '/entrypoints/fresh-markets/invoke', '/entrypoints/markets/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  properties: {
    chain: { type: 'string', default: 'base' },
    factories: { type: 'array', items: { type: 'string' }, default: [] },
    window_minutes: { type: 'integer', default: 10 },
    from_block: { type: 'integer' },
    to_block: { oneOf: [{ type: 'integer' }, { type: 'string', enum: ['latest'] }], default: 'latest' }
  }
};
const entrypoints = [
  { key: 'watch_fresh_markets', method: 'POST', path: '/entrypoints/watch_fresh_markets/invoke', description: 'Scan AMM factory logs for newly created pairs or pools.', input_schema: inputSchema },
  { key: 'fresh-markets', method: 'POST', path: '/entrypoints/fresh-markets/invoke', description: 'Hyphenated alias for fresh markets watch.', input_schema: inputSchema },
  { key: 'markets', method: 'POST', path: '/entrypoints/markets/invoke', description: 'Short alias for fresh markets watch.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => res.json({ ...agentMetadata, url: publicBaseUrl, supported_chains: ['base', 'arbitrum'], entrypoints, x402: { protected: invokePaths, network, price: x402Price } }));
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/watch_fresh_markets/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Fresh Markets Watch',
    tags: ['fresh-markets', 'amm', 'pool-created', 'pair-created', 'defi'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'watch_fresh_markets' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/watch_fresh_markets/invoke': protectedRoute,
    'POST /entrypoints/fresh-markets/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/fresh-markets/invoke` },
    'POST /entrypoints/markets/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/markets/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runFreshMarketsWatch(input);
    res.json({ output, usage: { markets_returned: output.markets.length, warnings: output.warnings.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`fresh-markets-watch listening on ${port}`));
