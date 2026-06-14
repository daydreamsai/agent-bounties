import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApprovalRiskAuditorApp, invokePaths } from '../src/server.js';

async function withServer<T>(app: ReturnType<typeof createApprovalRiskAuditorApp>, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('manifest advertises supported chains, entrypoints, and x402 metadata', async () => {
  const app = createApprovalRiskAuditorApp({
    publicBaseUrl: 'https://example.test/approval-risk-auditor',
    network: 'eip155:8453',
    x402Price: '$0.01'
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/agent.json`);
    assert.equal(response.status, 200);
    const manifest = await response.json() as Record<string, any>;
    assert.equal(manifest.name, 'approval-risk-auditor');
    assert.equal(manifest.url, 'https://example.test/approval-risk-auditor');
    assert.deepEqual(manifest.x402.protected, invokePaths);
    assert.equal(manifest.x402.network, 'eip155:8453');
    assert.equal(manifest.x402.price, '$0.01');
    assert.ok(manifest.supported_chains.includes('ethereum'));
    assert.ok(manifest.supported_chains.includes('base'));
    assert.ok(manifest.entrypoints.some((entrypoint: Record<string, unknown>) => entrypoint.path === '/entrypoints/audit_approvals/invoke'));
  });
});

test('entrypoints endpoint exposes all protected invoke aliases', async () => {
  const app = createApprovalRiskAuditorApp({
    publicBaseUrl: 'https://example.test/approval-risk-auditor'
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/entrypoints`);
    assert.equal(response.status, 200);
    const body = await response.json() as { entrypoints: Array<{ path: string }> };
    const paths = body.entrypoints.map((entrypoint) => entrypoint.path);
    assert.deepEqual(paths, invokePaths);
  });
});
