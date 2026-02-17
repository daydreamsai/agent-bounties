/**
 * LI.FI API client for fetching bridge routes and quotes.
 * Docs: https://docs.li.fi/li.fi-api/li.fi-api
 * No API key required for quotes.
 */

const LIFI_BASE = "https://li.quest/v1";
// Dummy address used for quote requests (we don't execute txs)
const DUMMY_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

/** Default request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Fetch advanced routes from LI.FI.
 */
export async function fetchRoutes({ fromChainId, toChainId, fromToken, toToken, fromAmount }) {
  const body = {
    fromChainId,
    toChainId,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    fromAmount,
    fromAddress: DUMMY_ADDRESS,
    options: {
      order: "RECOMMENDED",
      slippage: 0.005,
      maxPriceImpact: 0.4,
    },
  };

  const res = await fetch(`${LIFI_BASE}/advanced/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LI.FI routes error: ${err.message || res.statusText}`);
  }

  return res.json();
}

/**
 * Resolve a token symbol to its address on a given chain using LI.FI tokens endpoint.
 */
export async function resolveToken(chainId, symbolOrAddress) {
  // If it looks like an address, return as-is
  if (symbolOrAddress.startsWith("0x") && symbolOrAddress.length === 42) {
    return symbolOrAddress;
  }

  const res = await fetch(
    `${LIFI_BASE}/token?chain=${chainId}&token=${encodeURIComponent(symbolOrAddress)}`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!res.ok) {
    throw new Error(`Could not resolve token "${symbolOrAddress}" on chain ${chainId}`);
  }
  const data = await res.json();
  if (!data.address) {
    throw new Error(`Token "${symbolOrAddress}" on chain ${chainId} resolved but has no address`);
  }
  return data.address;
}

/**
 * Parse a route from LI.FI into a clean summary.
 */
export function parseRoute(route) {
  const steps = route.steps || [];
  const bridges = steps.map((s) => s.toolDetails?.name || s.tool).join(" → ");

  // Sum up fee costs and gas costs
  let totalFeeUsd = 0;
  let totalGasUsd = 0;
  let totalExecutionSeconds = 0;

  for (const step of steps) {
    const est = step.estimate || {};
    if (est.feeCosts) {
      for (const fee of est.feeCosts) {
        totalFeeUsd += parseFloat(fee.amountUSD || "0");
      }
    }
    if (est.gasCosts) {
      for (const gas of est.gasCosts) {
        totalGasUsd += parseFloat(gas.amountUSD || "0");
      }
    }
    totalExecutionSeconds += est.executionDuration || 0;
  }

  const fromToken = route.fromToken || {};
  const toToken = route.toToken || {};
  const fromDecimals = fromToken.decimals || 18;
  const toDecimals = toToken.decimals || 18;

  return {
    bridge: bridges,
    from_token: fromToken.symbol || "?",
    to_token: toToken.symbol || "?",
    from_amount: parseFloat(route.fromAmount) / 10 ** fromDecimals,
    to_amount: parseFloat(route.toAmount) / 10 ** toDecimals,
    to_amount_min: parseFloat(route.toAmountMin) / 10 ** toDecimals,
    to_amount_usd: route.toAmountUSD,
    fee_usd: parseFloat((totalFeeUsd + totalGasUsd).toFixed(4)),
    gas_usd: parseFloat(totalGasUsd.toFixed(4)),
    eta_minutes: parseFloat((totalExecutionSeconds / 60).toFixed(2)),
    eta_seconds: totalExecutionSeconds,
    steps_count: steps.length,
  };
}

/**
 * Fetch and parse all routes.
 */
export async function getBridgeRoutes({ fromChainId, toChainId, fromToken, toToken, fromAmount }) {
  const [fromAddr, toAddr] = await Promise.all([
    resolveToken(fromChainId, fromToken),
    resolveToken(toChainId, toToken),
  ]);

  const data = await fetchRoutes({
    fromChainId,
    toChainId,
    fromToken: fromAddr,
    toToken: toAddr,
    fromAmount,
  });

  const routes = (data.routes || []).map(parseRoute);
  return routes;
}
