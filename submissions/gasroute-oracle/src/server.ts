import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runGasRouteOracle } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8798);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/estimate_gas_route/invoke', '/entrypoints/gasroute/invoke', '/entrypoints/gas-route/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['chain_set', 'calldata_size_bytes', 'gas_units_est'],
  properties: {
    chain_set: { type: 'array', items: { enum: supportedChains } },
    calldata_size_bytes: { type: 'integer', minimum: 0 },
    gas_units_est: { type: 'integer', minimum: 21000 }
  }
};
const entrypoints = [
  { key: 'estimate_gas_route', method: 'POST', path: '/entrypoints/estimate_gas_route/invoke', description: 'Estimate gas costs across chains and return the cheapest route.', input_schema: inputSchema },
  { key: 'gasroute', method: 'POST', path: '/entrypoints/gasroute/invoke', description: 'Short alias for gas route estimation.', input_schema: inputSchema },
  { key: 'gas-route', method: 'POST', path: '/entrypoints/gas-route/invoke', description: 'Hyphenated alias for gas route estimation.', input_schema: inputSchema },
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
    resource: `${publicBaseUrl}/entrypoints/estimate_gas_route/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'GasRoute Oracle',
    tags: ['gas', 'oracle', 'routing', 'evm', 'x402'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'estimate_gas_route' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/estimate_gas_route/invoke': protectedRoute,
    'POST /entrypoints/gasroute/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/gasroute/invoke` },
    'POST /entrypoints/gas-route/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/gas-route/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runGasRouteOracle(input);
    res.json({ output, usage: { chains_quoted: output.quotes.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`gasroute-oracle listening on ${port}`));