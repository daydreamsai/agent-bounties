import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runTokenHolderMonitor } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8796);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = process.env.X402_NETWORK || 'eip155:8453';
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/monitor_token/invoke', '/entrypoints/monitor-token/invoke', '/entrypoints/holders/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['contract_address', 'chain'],
  properties: {
    contract_address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    chain: { enum: supportedChains },
    min_holders: { type: 'integer', default: 100 },
    lookback_blocks: { type: 'integer', default: 120000 },
    top_n: { type: 'integer', default: 25 }
  }
};
const entrypoints = [
  { key: 'monitor_token', method: 'POST', path: '/entrypoints/monitor_token/invoke', description: 'Analyze ERC20 holder distribution, whales, concentration, and large transfers.', input_schema: inputSchema },
  { key: 'monitor-token', method: 'POST', path: '/entrypoints/monitor-token/invoke', description: 'Hyphenated alias for token holder monitoring.', input_schema: inputSchema },
  { key: 'holders', method: 'POST', path: '/entrypoints/holders/invoke', description: 'Short alias for token holder monitoring.', input_schema: inputSchema },
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
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network as `eip155:${number}`, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact', price: x402Price, network: network as `eip155:${number}`, payTo: payTo as `0x${string}`, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/monitor_token/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Token Holder Monitor',
    tags: ['token-holder', 'whale', 'distribution', 'concentration', 'erc20'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'monitor_token' } })
  };

  app.use(paymentMiddleware({
    'POST /entrypoints/monitor_token/invoke': protectedRoute,
    'POST /entrypoints/monitor-token/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/monitor-token/invoke` },
    'POST /entrypoints/holders/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/holders/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const output = await runTokenHolderMonitor(req.body);
    res.json({ output, usage: { holders_observed: output.holder_count, transfer_events: output.external_checks[0]?.evidence?.logs } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`token-holder-monitor listening on ${port}`));
