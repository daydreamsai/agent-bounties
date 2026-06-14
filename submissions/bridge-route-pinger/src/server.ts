import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runBridgeRoutePinger } from './agent.js';

const port = Number(process.env.PORT || 8801);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/ping_bridge_routes/invoke', '/entrypoints/bridge-routes/invoke', '/entrypoints/bridge/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', default: 'USDC' },
    amount: { oneOf: [{ type: 'string' }, { type: 'number' }], default: '1' },
    from_chain: { type: 'string', default: 'base' },
    to_chain: { type: 'string', default: 'optimism' },
    from_address: { type: 'string', default: '0x0000000000000000000000000000000000000001' },
    slippage: { type: 'number', default: 0.005 }
  }
};
const entrypoints = [
  { key: 'ping_bridge_routes', method: 'POST', path: '/entrypoints/ping_bridge_routes/invoke', description: 'Return live bridge route, ETA, fee, and requirements from LI.FI and Across.', input_schema: inputSchema },
  { key: 'bridge-routes', method: 'POST', path: '/entrypoints/bridge-routes/invoke', description: 'Hyphenated alias for bridge route pinger.', input_schema: inputSchema },
  { key: 'bridge', method: 'POST', path: '/entrypoints/bridge/invoke', description: 'Short alias for bridge route pinger.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => res.json({ ...agentMetadata, url: publicBaseUrl, supported_chains: Object.keys({ ethereum: 1, optimism: 10, polygon: 137, arbitrum: 42161, base: 8453 }), entrypoints, x402: { protected: invokePaths, network, price: x402Price } }));
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/ping_bridge_routes/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Bridge Route Pinger',
    tags: ['bridge', 'cross-chain', 'lifi', 'fees', 'eta'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'ping_bridge_routes' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/ping_bridge_routes/invoke': protectedRoute,
    'POST /entrypoints/bridge-routes/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/bridge-routes/invoke` },
    'POST /entrypoints/bridge/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/bridge/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runBridgeRoutePinger(input);
    res.json({ output, usage: { routes_returned: output.routes.length, warnings: output.warnings.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`bridge-route-pinger listening on ${port}`));
