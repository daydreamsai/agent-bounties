import { z } from 'zod';
import { Hono } from 'hono';

// Simple RPC client for Ethereum
async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest']
    })
  });
  const result = await response.json();
  return result.result;
}

// Protocol addresses
const PROTOCOLS: Record<string, Record<string, { pool: string; rpc: string }>> = {
  'aave-v3': {
    ethereum: {
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      rpc: 'https://eth.llamarpc.com'
    },
    arbitrum: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      rpc: 'https://arbitrum.llamarpc.com'
    },
    polygon: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      rpc: 'https://polygon.llamarpc.com'
    },
    optimism: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      rpc: 'https://optimism.llamarpc.com'
    },
    base: {
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
      rpc: 'https://base.llamarpc.com'
    }
  }
};

// Aave getUserAccountData function selector
const GET_USER_ACCOUNT_DATA_SELECTOR = '0x35ea6e75';

// Decode uint256 from hex
function decodeUint256(hex: string, index: number): bigint {
  const start = 2 + index * 64;
  return BigInt('0x' + hex.slice(start, start + 64));
}

// Create agent app
const app = new Hono();

// Health endpoint
app.get('/health', (c) => {
  return c.json({ ok: true, version: '1.0.0', name: 'lending-liquidation-sentinel-v2' });
});

// Entrypoints list
app.get('/entrypoints', (c) => {
  return c.json({
    items: [
      { key: 'check_position', description: 'Check lending position health factor', streaming: false },
      { key: 'simulate_liquidation', description: 'Simulate liquidation scenarios', streaming: false },
      { key: 'supported_protocols', description: 'List supported protocols', streaming: false },
      { key: 'echo', description: 'Health check', streaming: false }
    ]
  });
});

// Agent card
app.get('/.well-known/agent.json', (c) => {
  return c.json({
    name: 'lending-liquidation-sentinel-v2',
    version: '1.0.0',
    description: 'Watch borrow positions and warn before liquidation risk',
    skills: [
      {
        id: 'check_position',
        name: 'check_position',
        description: 'Check lending position health factor and get alerts',
        inputSchema: {
          type: 'object',
          properties: {
            wallet: { type: 'string', description: 'Wallet address to monitor' },
            protocol_ids: { type: 'array', items: { type: 'string' }, description: 'Protocols: aave-v3, compound-v3, morpho' },
            chain: { type: 'string', description: 'Chain: ethereum, arbitrum, polygon, optimism, base' },
            alert_threshold: { type: 'number', description: 'HF threshold for alerts (default 1.3)' }
          }
        }
      }
    ]
  });
});

// Check position endpoint
app.post('/entrypoints/check_position/invoke', async (c) => {
  const body = await c.req.json();
  const wallet = body.wallet || body.input?.wallet;
  const protocolIds = body.protocol_ids || body.input?.protocol_ids || ['aave-v3'];
  const chain = body.chain || body.input?.chain || 'ethereum';
  const alertThreshold = body.alert_threshold || body.input?.alert_threshold || 1.3;

  if (!wallet) {
    return c.json({ error: 'wallet is required' }, 400);
  }

  const positions: any[] = [];

  for (const protocol of protocolIds) {
    const protocolConfig = PROTOCOLS[protocol]?.[chain];
    if (!protocolConfig) continue;

    try {
      // Encode getUserAccountData call
      const paddedAddress = wallet.slice(2).toLowerCase().padStart(64, '0');
      const data = GET_USER_ACCOUNT_DATA_SELECTOR + paddedAddress;

      const result = await ethCall(protocolConfig.rpc, protocolConfig.pool, data);

      // Decode results (6 uint256s)
      const totalCollateralBase = decodeUint256(result, 0);
      const totalDebtBase = decodeUint256(result, 1);
      const availableBorrowsBase = decodeUint256(result, 2);
      const currentLiquidationThreshold = decodeUint256(result, 3);
      const ltv = decodeUint256(result, 4);
      const healthFactor = decodeUint256(result, 5);

      // Convert to human readable (Aave uses 8 decimals for USD, 18 for HF)
      const RAY = BigInt(10) ** BigInt(27);
      const hf = healthFactor > 0n ? Number(healthFactor) / 1e18 : Infinity;
      const collateralUSD = Number(totalCollateralBase) / 1e8;
      const debtUSD = Number(totalDebtBase) / 1e8;
      const bufferPercent = hf > 1 ? ((1 - 1/hf) * 100) : 0;

      // Determine alert level
      let alertLevel: string;
      if (hf >= 2.0) alertLevel = 'safe';
      else if (hf >= 1.5) alertLevel = 'warning';
      else if (hf >= 1.1) alertLevel = 'danger';
      else alertLevel = 'critical';

      positions.push({
        health_factor: Math.round(hf * 10000) / 10000,
        liq_price_threshold: Math.round(bufferPercent * 100) / 100,
        buffer_percent: Math.round(bufferPercent * 100) / 100,
        alert_threshold_hit: hf < alertThreshold,
        alert_level: alertLevel,
        collateral_usd: Math.round(collateralUSD * 100) / 100,
        debt_usd: Math.round(debtUSD * 100) / 100,
        protocol,
        chain
      });
    } catch (error) {
      console.error(`Error fetching ${protocol} position:`, error);
    }
  }

  const totalCollateral = positions.reduce((sum, p) => sum + p.collateral_usd, 0);
  const totalDebt = positions.reduce((sum, p) => sum + p.debt_usd, 0);
  const lowestHF = Math.min(...positions.map(p => p.health_factor));
  const anyAlert = positions.some(p => p.alert_threshold_hit);

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      positions,
      summary: {
        total_collateral_usd: Math.round(totalCollateral * 100) / 100,
        total_debt_usd: Math.round(totalDebt * 100) / 100,
        lowest_health_factor: Math.round(lowestHF * 10000) / 10000,
        any_alert_triggered: anyAlert
      }
    },
    usage: { total_tokens: JSON.stringify(positions).length }
  });
});

// Simulate liquidation endpoint
app.post('/entrypoints/simulate_liquidation/invoke', async (c) => {
  const body = await c.req.json();
  const currentHF = body.current_health_factor || body.input?.current_health_factor;
  const priceDrops = body.price_drops || body.input?.price_drops || [5, 10, 15, 20, 25, 30, 40, 50];

  if (!currentHF) {
    return c.json({ error: 'current_health_factor is required' }, 400);
  }

  const simulations = priceDrops.map((drop: number) => {
    const projectedHF = currentHF * (1 - drop / 100);
    return {
      price_drop_percent: drop,
      projected_health_factor: Math.round(projectedHF * 10000) / 10000,
      would_liquidate: projectedHF < 1.0
    };
  });

  const safeDrop = currentHF > 1 ? Math.round((1 - 1/currentHF) * 100 * 100) / 100 : 0;

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      simulations,
      safe_drop_percent: safeDrop,
      warning: currentHF < 1.2 ? 'Current health factor is in danger zone!' : undefined
    },
    usage: { total_tokens: JSON.stringify(simulations).length }
  });
});

// Supported protocols endpoint
app.post('/entrypoints/supported_protocols/invoke', async (c) => {
  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      protocols: Object.entries(PROTOCOLS).map(([name, chains]) => ({
        name,
        chains: Object.keys(chains)
      }))
    },
    usage: { total_tokens: 100 }
  });
});

// Echo endpoint
app.post('/entrypoints/echo/invoke', async (c) => {
  const body = await c.req.json();
  const text = body.text || body.input?.text || 'Lending Liquidation Sentinel v2 is operational';

  return c.json({
    run_id: crypto.randomUUID(),
    status: 'completed',
    output: {
      text,
      timestamp: new Date().toISOString(),
      supported_protocols: ['aave-v3'],
      supported_chains: ['ethereum', 'arbitrum', 'polygon', 'optimism', 'base']
    },
    usage: { total_tokens: text.length }
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head><title>Lending Liquidation Sentinel v2</title></head>
    <body>
      <h1>Lending Liquidation Sentinel v2</h1>
      <p>Watch borrow positions and warn before liquidation risk.</p>
      <h2>Entrypoints</h2>
      <ul>
        <li><code>POST /entrypoints/check_position/invoke</code> - Check position health</li>
        <li><code>POST /entrypoints/simulate_liquidation/invoke</code> - Simulate scenarios</li>
        <li><code>POST /entrypoints/supported_protocols/invoke</code> - List protocols</li>
        <li><code>POST /entrypoints/echo/invoke</code> - Health check</li>
      </ul>
      <h2>Supported Protocols</h2>
      <ul>
        <li>Aave v3 (Ethereum, Arbitrum, Polygon, Optimism, Base)</li>
      </ul>
    </body>
    </html>
  `);
});

export default app;