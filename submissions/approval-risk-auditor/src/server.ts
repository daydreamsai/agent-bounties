import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { auditApprovalRisk, agentMetadata } from './agent.js';
import { supportedChains } from './types.js';

const port = Number(process.env.PORT || 8787);

export type ApprovalRiskAuditorAppOptions = {
  payTo?: string;
  x402Price?: string;
  network?: string;
  facilitatorUrl?: string;
  publicBaseUrl?: string;
  syncFacilitatorOnStart?: boolean;
};

export const invokePaths = [
  '/entrypoints/audit_approvals/invoke',
  '/entrypoints/audit-approvals/invoke',
  '/entrypoints/audit/invoke',
  '/invoke'
];

export const auditInputJsonSchema = {
  type: 'object',
  required: ['wallet', 'chains'],
  properties: {
    wallet: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    chains: { type: 'array', items: { enum: supportedChains } },
    stale_days: { type: 'integer', default: 90 },
    from_block: { type: 'object', additionalProperties: { type: 'integer' } },
    token_addresses: { type: 'array', items: { type: 'string' } }
  }
};

export const agentEntrypoints = [
  {
    key: 'audit_approvals',
    method: 'POST',
    path: '/entrypoints/audit_approvals/invoke',
    description: 'Audit wallet token/NFT approvals and return revoke calldata.',
    input_schema: auditInputJsonSchema
  },
  {
    key: 'audit-approvals',
    method: 'POST',
    path: '/entrypoints/audit-approvals/invoke',
    description: 'Alias for audit_approvals, useful for clients that prefer hyphenated entrypoint names.',
    input_schema: auditInputJsonSchema
  },
  {
    key: 'audit',
    method: 'POST',
    path: '/entrypoints/audit/invoke',
    description: 'Short alias for approval risk audits.',
    input_schema: auditInputJsonSchema
  },
  {
    key: 'legacy_invoke',
    method: 'POST',
    path: '/invoke',
    description: 'Legacy invoke alias for simple x402 clients.',
    input_schema: auditInputJsonSchema
  }
];

export function createApprovalRiskAuditorApp(options: ApprovalRiskAuditorAppOptions = {}): Express {
  const payTo = options.payTo ?? process.env.X402_PAY_TO ?? '';
  const x402Price = options.x402Price ?? process.env.X402_PRICE ?? '$0.01';
  const network = options.network ?? process.env.X402_NETWORK ?? 'eip155:8453';
  const facilitatorUrl = options.facilitatorUrl ?? process.env.X402_FACILITATOR_URL ?? 'https://facilitator.openx402.ai';
  const publicBaseUrl = options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;
  const syncFacilitatorOnStart = options.syncFacilitatorOnStart ?? process.env.X402_SYNC_FACILITATOR_ON_START !== 'false';

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ...agentMetadata });
  });

  app.get('/.well-known/agent.json', (_req, res) => {
    res.json({
      ...agentMetadata,
      url: publicBaseUrl,
      supported_chains: supportedChains,
      entrypoints: agentEntrypoints,
      x402: {
        protected: invokePaths,
        network,
        price: x402Price
      }
    });
  });

  app.get('/entrypoints', (_req, res) => {
    res.json({
      entrypoints: agentEntrypoints.map(({ key, method, path }) => ({ key, method, path }))
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
      resource: `${publicBaseUrl}/entrypoints/audit_approvals/invoke`,
      description: agentMetadata.description,
      mimeType: 'application/json',
      serviceName: 'Approval Risk Auditor',
      tags: ['approval', 'revoke', 'evm', 'risk'],
      unpaidResponseBody: () => ({
        contentType: 'application/json',
        body: {
          error: 'Payment required',
          service: agentMetadata.name,
          entrypoint: 'audit_approvals'
        }
      })
    };

    app.use(paymentMiddleware(
      {
        'POST /entrypoints/audit_approvals/invoke': protectedRoute,
        'POST /entrypoints/audit-approvals/invoke': {
          ...protectedRoute,
          resource: `${publicBaseUrl}/entrypoints/audit-approvals/invoke`
        },
        'POST /entrypoints/audit/invoke': {
          ...protectedRoute,
          resource: `${publicBaseUrl}/entrypoints/audit/invoke`
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
      const output = await auditApprovalRisk(req.body);
      res.json({ output, usage: { approvals_scanned: output.approvals.length } });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createApprovalRiskAuditorApp();
  app.listen(port, () => {
    console.log(`approval-risk-auditor listening on ${port}`);
  });
}
