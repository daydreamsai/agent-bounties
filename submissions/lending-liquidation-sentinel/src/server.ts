import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runLendingLiquidationSentinel } from './agent.js';

const port = Number(process.env.PORT || 8803);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/monitor_liquidation/invoke', '/entrypoints/liquidation/invoke', '/entrypoints/monitor/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['wallet'],
  properties: {
    wallet: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    protocol_ids: { type: 'array', items: { enum: ['aave-v3-base', 'aave-v3-arbitrum'] }, default: ['aave-v3-base'] },
    positions: { type: 'array', items: { type: 'object' }, default: [] },
    alert_threshold: { type: 'number', default: 1.2 }
  }
};
const entrypoints = [
  { key: 'monitor_liquidation', method: 'POST', path: '/entrypoints/monitor_liquidation/invoke', description: 'Read Aave V3 account health and return liquidation risk alerts.', input_schema: inputSchema },
  { key: 'liquidation', method: 'POST', path: '/entrypoints/liquidation/invoke', description: 'Short liquidation monitor alias.', input_schema: inputSchema },
  { key: 'monitor', method: 'POST', path: '/entrypoints/monitor/invoke', description: 'Generic monitor alias.', input_schema: inputSchema },
  { key: 'legacy_invoke', method: 'POST', path: '/invoke', description: 'Legacy invoke alias for simple x402 clients.', input_schema: inputSchema }
];

app.get('/health', (_req, res) => res.json({ ok: true, ...agentMetadata }));
app.get('/.well-known/agent.json', (_req, res) => res.json({ ...agentMetadata, url: publicBaseUrl, supported_protocols: ['aave-v3-base', 'aave-v3-arbitrum'], entrypoints, x402: { protected: invokePaths, network, price: x402Price } }));
app.get('/entrypoints', (_req, res) => res.json({ entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path })) }));

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
  const protectedRoute = {
    accepts: { scheme: 'exact' as const, price: x402Price, network, payTo, maxTimeoutSeconds: 300 },
    resource: `${publicBaseUrl}/entrypoints/monitor_liquidation/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Lending Liquidation Sentinel',
    tags: ['lending', 'liquidation', 'aave', 'health-factor', 'risk'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'monitor_liquidation' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/monitor_liquidation/invoke': protectedRoute,
    'POST /entrypoints/liquidation/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/liquidation/invoke` },
    'POST /entrypoints/monitor/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/monitor/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runLendingLiquidationSentinel(input);
    res.json({ output, usage: { positions_returned: output.positions.length, warnings: output.warnings.length } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`lending-liquidation-sentinel listening on ${port}`));
