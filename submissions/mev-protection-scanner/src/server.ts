import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runMevScanner } from './agent.js';
import { dexes, supportedChains } from './types.js';

const port = Number(process.env.PORT || 8807);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = ['/entrypoints/scan_transaction/invoke', '/entrypoints/scan-mev/invoke', '/invoke'];
const inputSchema = {
  type: 'object',
  required: ['token_in', 'token_out', 'amount_in'],
  properties: {
    token_in: { type: 'string' },
    token_out: { type: 'string' },
    amount_in: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    dex: { enum: dexes, default: 'uniswap-v2' },
    chain: { enum: supportedChains, default: 'eth' },
    transaction_hash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
    max_pending_txs: { type: 'integer', minimum: 1, maximum: 200, default: 20 }
  }
};
const entrypoints = [
  { key: 'scan_transaction', method: 'POST', path: '/entrypoints/scan_transaction/invoke', description: 'Scan a trade or pending transaction for MEV risk.', input_schema: inputSchema },
  { key: 'scan-mev', method: 'POST', path: '/entrypoints/scan-mev/invoke', description: 'Alias for MEV risk scan.', input_schema: inputSchema },
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
    resource: `${publicBaseUrl}/entrypoints/scan_transaction/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'MEV Protection Scanner',
    tags: ['mev', 'sandwich', 'front-run', 'mempool', 'defi', 'security'],
    unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'Payment required', service: agentMetadata.name, entrypoint: 'scan_transaction' } })
  };
  app.use(paymentMiddleware({
    'POST /entrypoints/scan_transaction/invoke': protectedRoute,
    'POST /entrypoints/scan-mev/invoke': { ...protectedRoute, resource: `${publicBaseUrl}/entrypoints/scan-mev/invoke` },
    'POST /invoke': { ...protectedRoute, resource: `${publicBaseUrl}/invoke` }
  }, resourceServer, undefined, undefined, syncFacilitatorOnStart));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const input = req.body?.input ?? req.body;
    const output = await runMevScanner(input);
    res.json({ output, usage: { pending_sample_size: output.signals.pending_sample_size } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`mev-protection-scanner listening on ${port}`));
