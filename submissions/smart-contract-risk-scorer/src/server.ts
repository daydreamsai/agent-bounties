import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { agentMetadata, runSmartContractRiskScore } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8795);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const payTo = process.env.X402_PAY_TO || '';
const x402Price = process.env.X402_PRICE || '$0.01';
const network = process.env.X402_NETWORK || 'eip155:8453';
const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.openx402.ai';
const syncFacilitatorOnStart = process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const invokePaths = [
  '/entrypoints/score_contract/invoke',
  '/entrypoints/score-contract/invoke',
  '/entrypoints/score/invoke',
  '/invoke'
];

const inputSchema = {
  type: 'object',
  required: ['contract_address', 'chain'],
  properties: {
    contract_address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    chain: { enum: supportedChains },
    scan_depth: { enum: ['quick', 'deep'], default: 'quick' }
  }
};

const entrypoints = [
  {
    key: 'score_contract',
    method: 'POST',
    path: '/entrypoints/score_contract/invoke',
    description: 'Score an EVM smart contract for scam, ownership, source-code, bytecode, and external security risks.',
    input_schema: inputSchema
  },
  {
    key: 'score-contract',
    method: 'POST',
    path: '/entrypoints/score-contract/invoke',
    description: 'Hyphenated alias for smart contract risk scoring.',
    input_schema: inputSchema
  },
  {
    key: 'score',
    method: 'POST',
    path: '/entrypoints/score/invoke',
    description: 'Short alias for smart contract risk scoring.',
    input_schema: inputSchema
  },
  {
    key: 'legacy_invoke',
    method: 'POST',
    path: '/invoke',
    description: 'Legacy invoke alias for simple x402 clients.',
    input_schema: inputSchema
  }
];

app.get('/health', (_req, res) => {
  res.json({ ok: true, ...agentMetadata });
});

app.get('/.well-known/agent.json', (_req, res) => {
  res.json({
    ...agentMetadata,
    url: publicBaseUrl,
    supported_chains: supportedChains,
    entrypoints,
    x402: {
      protected: invokePaths,
      network,
      price: x402Price
    }
  });
});

app.get('/entrypoints', (_req, res) => {
  res.json({
    entrypoints: entrypoints.map(({ key, method, path }) => ({ key, method, path }))
  });
});

if (payTo) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(network as `eip155:${number}`, new ExactEvmScheme());
  const protectedRoute = {
    accepts: {
      scheme: 'exact',
      price: x402Price,
      network: network as `eip155:${number}`,
      payTo: payTo as `0x${string}`,
      maxTimeoutSeconds: 300
    },
    resource: `${publicBaseUrl}/entrypoints/score_contract/invoke`,
    description: agentMetadata.description,
    mimeType: 'application/json',
    serviceName: 'Smart Contract Risk Scorer',
    tags: ['smart-contract', 'risk', 'goplus', 'etherscan', 'honeypot'],
    unpaidResponseBody: () => ({
      contentType: 'application/json',
      body: {
        error: 'Payment required',
        service: agentMetadata.name,
        entrypoint: 'score_contract'
      }
    })
  };

  app.use(paymentMiddleware(
    {
      'POST /entrypoints/score_contract/invoke': protectedRoute,
      'POST /entrypoints/score-contract/invoke': {
        ...protectedRoute,
        resource: `${publicBaseUrl}/entrypoints/score-contract/invoke`
      },
      'POST /entrypoints/score/invoke': {
        ...protectedRoute,
        resource: `${publicBaseUrl}/entrypoints/score/invoke`
      },
      'POST /invoke': {
        ...protectedRoute,
        resource: `${publicBaseUrl}/invoke`
      }
    },
    resourceServer,
    undefined,
    undefined,
    syncFacilitatorOnStart
  ));
}

app.post(invokePaths, async (req, res, next) => {
  try {
    const output = await runSmartContractRiskScore(req.body);
    res.json({ output, usage: { vulnerabilities: output.vulnerabilities.length, data_sources: output.data_sources } });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

app.listen(port, () => {
  console.log(`smart-contract-risk-scorer listening on ${port}`);
});
