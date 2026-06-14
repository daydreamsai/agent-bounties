import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runLpIlEstimator } from './agent.js';
import { supportedNetworks } from './types.js';

const port = Number(process.env.PORT || 8805);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/estimate_lp_il/invoke', '/entrypoints/lp-il/invoke', '/entrypoints/impermanent-loss/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['pool_address', 'deposit_amounts'],
  properties: {
    pool_address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    network: { enum: supportedNetworks, default: 'base' },
    token_weights: { type: 'array', items: { type: 'number', exclusiveMinimum: 0 }, default: [0.5, 0.5] },
    deposit_amounts: { type: 'array', items: { type: 'number', minimum: 0 } },
    window_hours: { type: 'number', exclusiveMinimum: 0, default: 24 },
    fee_bps: { type: 'number', minimum: 0, maximum: 10000 }
  }
};
const entrypoints = [
  { key: 'estimate_lp_il', method: 'POST', path: '/entrypoints/estimate_lp_il/invoke', description: 'Estimate impermanent loss and fee APR for an LP position.', input_schema: inputSchema },
  { key: 'lp-il', method: 'POST', path: '/entrypoints/lp-il/invoke', description: 'Short alias for LP IL estimation.', input_schema: inputSchema },
  { key: 'impermanent-loss', method: 'POST', path: '/entrypoints/impermanent-loss/invoke', description: 'Hyphenated alias for impermanent loss estimation.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => {
  res.json({ ...agentMetadata, url: publicBaseUrl, supported_networks: supportedNetworks, entrypoints, x402: { protected: invokePaths, network, price: x402Price } });
});
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/estimate_lp_il/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'LP Impermanent Loss Estimator',
    tags: ['lp', 'impermanent-loss', 'defi', 'yield', 'amm'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'estimate_lp_il' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/estimate_lp_il/invoke': protectedRoute,
    'POST /entrypoints/lp-il/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/lp-il/invoke` },
    'POST /entrypoints/impermanent-loss/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/impermanent-loss/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runLpIlEstimator(input);
    res.json({ output, usage: { data_sources: output.data_sources.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`lp-impermanent-loss-estimator listening on ${port}`));
