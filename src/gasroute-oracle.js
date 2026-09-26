const MAX_OBSERVATION_AGE_MS = 30_000;

/**
 * Selects the lowest-cost chain from fresh network observations.
 *
 * A provider is deliberately injected: production code can connect it to a
 * chain RPC/indexer, while callers and tests can supply observations without
 * hidden network calls. Rates are denominated in native tokens per unit/byte.
 */
export function createGasRouteOracle({ getNetworkState, now = () => Date.now(), maxObservationAgeMs = MAX_OBSERVATION_AGE_MS }) {
  if (typeof getNetworkState !== "function") {
    throw new TypeError("getNetworkState must be a function");
  }
  if (!Number.isFinite(maxObservationAgeMs) || maxObservationAgeMs < 0) {
    throw new TypeError("maxObservationAgeMs must be a non-negative number");
  }

  return {
    async estimate(input) {
      const { chain_set: chainSet, calldata_size_bytes: calldataSizeBytes, gas_units_est: gasUnitsEst } = input ?? {};
      validateInput(chainSet, calldataSizeBytes, gasUnitsEst);

      const observations = await Promise.all(chainSet.map(async (chain) => {
        try {
          const observation = await getNetworkState(chain);
          return calculateCandidate(chain, observation, calldataSizeBytes, gasUnitsEst, now(), maxObservationAgeMs);
        } catch (error) {
          return { chain, error: error instanceof Error ? error.message : String(error) };
        }
      }));

      const candidates = observations.filter((observation) => !observation.error);
      if (candidates.length === 0) {
        throw new Error("No chain has a fresh gas observation");
      }

      candidates.sort((left, right) => left.feeNative - right.feeNative || left.chain.localeCompare(right.chain));
      const best = candidates[0];
      return {
        chain: best.chain,
        fee_native: formatNumber(best.feeNative),
        fee_usd: formatNumber(best.feeNative * best.nativeUsd),
        busy_level: best.busyLevel,
        tip_hint: formatNumber(best.priorityFee),
      };
    },
  };
}

function validateInput(chainSet, calldataSizeBytes, gasUnitsEst) {
  if (!Array.isArray(chainSet) || chainSet.length === 0 || chainSet.some((chain) => typeof chain !== "string" || chain.length === 0)) {
    throw new TypeError("chain_set must contain at least one chain name");
  }
  if (!Number.isSafeInteger(calldataSizeBytes) || calldataSizeBytes < 0) {
    throw new TypeError("calldata_size_bytes must be a non-negative integer");
  }
  if (!Number.isSafeInteger(gasUnitsEst) || gasUnitsEst <= 0) {
    throw new TypeError("gas_units_est must be a positive integer");
  }
}

function calculateCandidate(chain, observation, calldataSizeBytes, gasUnitsEst, currentTime, maxAge) {
  const normalized = normalizeObservation(chain, observation, currentTime, maxAge);
  return {
    ...normalized,
    feeNative: gasUnitsEst * normalized.gasPrice + calldataSizeBytes * normalized.calldataPrice,
  };
}

function normalizeObservation(chain, observation, currentTime, maxAge) {
  if (!observation || typeof observation !== "object") {
    throw new Error("missing network observation");
  }
  const {
    gas_price_native_per_unit: gasPrice,
    calldata_price_native_per_byte: calldataPrice,
    native_usd: nativeUsd,
    priority_fee: priorityFee,
    busy_level: busyLevel,
    observed_at: observedAt,
  } = observation;
  for (const [name, value] of [["gas_price_native_per_unit", gasPrice], ["calldata_price_native_per_byte", calldataPrice], ["native_usd", nativeUsd], ["priority_fee", priorityFee]]) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a non-negative number`);
    }
  }
  if (typeof busyLevel !== "string" || busyLevel.length === 0) {
    throw new Error("busy_level must be a non-empty string");
  }
  const observedTime = new Date(observedAt).getTime();
  if (!Number.isFinite(observedTime) || currentTime - observedTime < 0 || currentTime - observedTime > maxAge) {
    throw new Error("network observation is stale or invalid");
  }

  return { chain, gasPrice, calldataPrice, nativeUsd, priorityFee, busyLevel };
}

function formatNumber(value) {
  return Number(value.toFixed(12));
}
