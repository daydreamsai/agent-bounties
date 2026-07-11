/**
 * Yield Pool Watcher - Cloudflare Worker
 * Monitors top DeFi yield pools across Aave V3 and Uniswap V3
 * Triggers alerts on APY/TVL threshold breaches
 */

// ── Helper: percentage change calculation ───────────────
function percentChange(a, b) {
  if (b === 0 || b === null || b === undefined) return 0;
  return (a - b) / Math.abs(b) * 100;
}

// ── Subgraph Queries ───────────────────────────────────
const AAVE_POOLS_QUERY = `
{
  pools(first: 100, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    name
    symbol
    totalValueLockedUSD
    inputTokenBalances
    outputTokenSupply
    cumulativeSupplySideRevenueUSD
    cumulativeProtocolSideRevenueUSD
    cumulativeTotalRevenueUSD
    _liquidityRate
    _variableBorrowRate
    _stableBorrowRate
  }
}`;

const UNISWAP_POOLS_QUERY = `
{
  pools(first: 100, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    token0 { symbol }
    token1 { symbol }
    feeTier
    liquidity
    sqrtPrice
    token0Price
    token1Price
    volumeUSD
    totalValueLockedUSD
    feesUSD
  }
}`;

// ── Fetch pool data from subgraph ──────────────────────
async function fetchSubgraphData(url, query) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!response.ok) throw new Error(`Subgraph error: ${response.status}`);
  const data = await response.json();
  return data.data;
}

// ── Calculate APY for Aave V3 pools ────────────────────
function calculateAaveAPY(pool) {
  const liquidityRate = parseFloat(pool._liquidityRate || '0');
  // Convert ray (10^27) to percentage
  return (liquidityRate / 1e25) * 100;
}

// ── Calculate APY for Uniswap V3 pools ─────────────────
function calculateUniswapAPY(pool) {
  const tvlUSD = parseFloat(pool.totalValueLockedUSD || '0');
  const feesUSD = parseFloat(pool.feesUSD || '0');
  if (tvlUSD === 0) return 0;
  // Annualized fee APR = (fees / TVL) * 365 * 100
  return (feesUSD / tvlUSD) * 365 * 100;
}

// ── Cron handler: poll subgraphs, detect changes ───────
async function handleCron(env) {
  const errors = [];
  const now = Date.now();

  // 1. Fetch pool data from both subgraphs
  let aavePools = [], uniswapPools = [];
  try {
    const aaveData = await fetchSubgraphData(env.AAVE_SUBGRAPH_URL, AAVE_POOLS_QUERY);
    aavePools = aaveData.pools || [];
  } catch (e) {
    errors.push(`Aave subgraph error: ${e.message}`);
  }
  try {
    const uniData = await fetchSubgraphData(env.UNISWAP_SUBGRAPH_URL, UNISWAP_POOLS_QUERY);
    uniswapPools = uniData.pools || [];
  } catch (e) {
    errors.push(`Uniswap subgraph error: ${e.message}`);
  }

  // 2. Get previous snapshot from KV
  let previousSnapshot = {};
  try {
    const stored = await env.YIELD_KV.get('pool_snapshot', 'json');
    previousSnapshot = stored || {};
  } catch (e) {
    previousSnapshot = {};
  }

  // 3. Process pools and detect changes
  const alerts = [];
  const currentSnapshot = { timestamp: now, pools: {} };

  for (const pool of aavePools) {
    const apy = calculateAaveAPY(pool);
    const tvl = parseFloat(pool.totalValueLockedUSD || '0');
    const poolId = `aave:${pool.id}`;

    currentSnapshot.pools[poolId] = { apy, tvl, protocol: 'aave', name: pool.name || pool.symbol, timestamp: now };

    const prev = previousSnapshot.pools?.[poolId];
    if (prev) {
      const apyDelta = apy - prev.apy;
      const tvlDeltaPct = percentChange(tvl, prev.tvl);
      const threshold = parseFloat(env.DEFAULT_APY_THRESHOLD || '5');

      if (Math.abs(apyDelta) >= threshold) {
        alerts.push({
          poolId,
          protocol: 'aave',
          metric: 'apy',
          oldValue: prev.apy,
          newValue: apy,
          delta: apyDelta,
          severity: Math.abs(apyDelta) >= threshold * 2 ? 'high' : 'medium',
          timestamp: now
        });
      }
      if (tvlDeltaPct <= -parseFloat(env.DEFAULT_TVL_DROP_THRESHOLD || '10')) {
        alerts.push({
          poolId,
          protocol: 'aave',
          metric: 'tvl',
          oldValue: prev.tvl,
          newValue: tvl,
          delta: tvlDeltaPct,
          severity: tvlDeltaPct <= -20 ? 'high' : 'medium',
          timestamp: now
        });
      }
    }
  }

  for (const pool of uniswapPools) {
    const apy = calculateUniswapAPY(pool);
    const tvl = parseFloat(pool.totalValueLockedUSD || '0');
    const name = `${pool.token0?.symbol || '?'}/${pool.token1?.symbol || '?'}`;
    const poolId = `uniswap:${pool.id}`;

    currentSnapshot.pools[poolId] = { apy, tvl, protocol: 'uniswap', name, timestamp: now };

    const prev = previousSnapshot.pools?.[poolId];
    if (prev) {
      const apyDelta = apy - prev.apy;
      const tvlDeltaPct = percentChange(tvl, prev.tvl);
      const threshold = parseFloat(env.DEFAULT_APY_THRESHOLD || '5');

      if (Math.abs(apyDelta) >= threshold) {
        alerts.push({
          poolId, protocol: 'uniswap', metric: 'apy',
          oldValue: prev.apy, newValue: apy, delta: apyDelta,
          severity: Math.abs(apyDelta) >= threshold * 2 ? 'high' : 'medium',
          timestamp: now
        });
      }
      if (tvlDeltaPct <= -parseFloat(env.DEFAULT_TVL_DROP_THRESHOLD || '10')) {
        alerts.push({
          poolId, protocol: 'uniswap', metric: 'tvl',
          oldValue: prev.tvl, newValue: tvl, delta: tvlDeltaPct,
          severity: tvlDeltaPct <= -20 ? 'high' : 'medium',
          timestamp: now
        });
      }
    }
  }

  // 4. Deduplicate alerts with cooldown
  const existingAlerts = [];
  try {
    const stored = await env.YIELD_KV.get('active_alerts', 'json');
    if (stored && Array.isArray(stored)) existingAlerts.push(...stored);
  } catch (e) { /* noop */ }

  const cooldownMs = parseInt(env.ALERT_COOLDOWN_HOURS || '1') * 3600000;
  const newAlerts = alerts.filter(a => {
    const lastAlert = existingAlerts.find(e =>
      e.poolId === a.poolId && e.metric === a.metric
    );
    return !lastAlert || (now - lastAlert.timestamp) >= cooldownMs;
  });

  // 5. Store data
  const allAlerts = [...newAlerts, ...existingAlerts].slice(0, 1000);
  await Promise.all([
    env.YIELD_KV.put('pool_snapshot', JSON.stringify(currentSnapshot), {
      expirationTtl: parseInt(env.SNAPSHOT_TTL_HOURS || '1') * 3600
    }),
    env.YIELD_KV.put('active_alerts', JSON.stringify(allAlerts), {
      expirationTtl: parseInt(env.ALERT_TTL_HOURS || '24') * 3600
    }),
    env.YIELD_KV.put('last_run', JSON.stringify({ timestamp: now, poolCount: aavePools.length + uniswapPools.length, alertCount: newAlerts.length, errors })),
  ]);

  return { poolsTracked: aavePools.length + uniswapPools.length, alertsGenerated: newAlerts.length, errors };
}

// ── API handler: expose metrics and alerts ─────────────
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/metrics') {
    const snapshot = await env.YIELD_KV.get('pool_snapshot', 'json');
    return new Response(JSON.stringify(snapshot || { pools: {}, timestamp: null }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (path === '/alerts') {
    const alerts = await env.YIELD_KV.get('active_alerts', 'json');
    return new Response(JSON.stringify(alerts || []), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (path === '/health') {
    const lastRun = await env.YIELD_KV.get('last_run', 'json');
    return new Response(JSON.stringify({
      status: 'ok',
      lastRun: lastRun?.timestamp || null,
      poolsTracked: lastRun?.poolCount || 0,
      errors: lastRun?.errors || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // x402 payment gate
  if (path.startsWith('/x402/')) {
    return new Response(JSON.stringify({
      name: 'Yield Pool Watcher',
      description: 'Real-time DeFi yield monitoring agent',
      endpoints: {
        metrics: 'GET /metrics',
        alerts: 'GET /alerts',
        health: 'GET /health'
      },
      payment: {
        method: 'x402',
        network: 'solana',
        amount: '0.0001 SOL per request'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// ── Main entry point ───────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/__cron' || request.method === 'POST' && url.pathname === '/cron') {
      const result = await handleCron(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handleApi(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  }
};
