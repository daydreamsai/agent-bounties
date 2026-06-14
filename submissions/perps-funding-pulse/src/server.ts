import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runPerpsFundingPulse } from './agent.js';

const port = Number(process.env.PORT || 8800);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/get_funding_pulse/invoke', '/entrypoints/funding-pulse/invoke', '/entrypoints/perps/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  properties: {
    venue_ids: { type: 'array', items: { enum: ['hyperliquid', 'binance', 'bybit', 'okx'] }, default: ['hyperliquid'] },
    markets: { type: 'array', items: { type: 'string' }, default: ['BTC', 'ETH'] },
    include_raw: { type: 'boolean', default: false }
  }
};
const entrypoints = [
  { key: 'get_funding_pulse', method: 'POST', path: '/entrypoints/get_funding_pulse/invoke', description: 'Return live funding, next tick, open interest, and available skew for perps markets.', input_schema: inputSchema },
  { key: 'funding-pulse', method: 'POST', path: '/entrypoints/funding-pulse/invoke', description: 'Hyphenated alias for perps funding pulse.', input_schema: inputSchema },
  { key: 'perps', method: 'POST', path: '/entrypoints/perps/invoke', description: 'Short alias for perps funding pulse.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => {
  res.json({ ...agentMetadata, url: publicBaseUrl, supported_venues: ['hyperliquid', 'binance', 'bybit', 'okx'], entrypoints, x402: { protected: invokePaths, network, price: x402Price } });
});
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/get_funding_pulse/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Perps Funding Pulse',
    tags: ['perps', 'funding', 'open-interest', 'trading', 'defi'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'get_funding_pulse' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/get_funding_pulse/invoke': protectedRoute,
    'POST /entrypoints/funding-pulse/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/funding-pulse/invoke` },
    'POST /entrypoints/perps/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/perps/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runPerpsFundingPulse(input);
    res.json({ output, usage: { markets_returned: output.metrics.length, warnings: output.warnings.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`perps-funding-pulse listening on ${port}`));
