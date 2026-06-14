import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runCrossDexArb } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8806);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/detect_arbitrage/invoke', '/entrypoints/detect-spread/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['token_in', 'token_out', 'amount_in'],
  properties: {
    token_in: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    token_out: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    amount_in: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    chains: { type: 'array', items: { enum: supportedChains }, default: ['base'] },
    threshold_bps: { type: 'number', default: 0 },
    max_routes: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
  }
};
const entrypoints = [
  { key: 'detect_arbitrage', method: 'POST', path: '/entrypoints/detect_arbitrage/invoke', description: 'Detect cross-DEX arbitrage opportunities after DEX fees and gas.', input_schema: inputSchema },
  { key: 'detect-spread', method: 'POST', path: '/entrypoints/detect-spread/invoke', description: 'Alias for cross-DEX spread detection.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => {
  res.json({ ...agentMetadata, url: publicBaseUrl, supported_chains: supportedChains, entrypoints, x402: { protected: invokePaths, network, price: x402Price } });
});
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/detect_arbitrage/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Cross DEX Arbitrage Alert',
    tags: ['cross-dex-arbitrage', 'arbitrage', 'dex', 'defi', 'gas-aware'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'detect_arbitrage' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/detect_arbitrage/invoke': protectedRoute,
    'POST /entrypoints/detect-spread/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/detect-spread/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runCrossDexArb(input);
    res.json({ output, usage: { quotes: output.quotes.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`cross-dex-arbitrage-alert listening on ${port}`));
