import { asPoolId, assertPoolSnapshot } from "./address";
import type { PoolId, PoolSnapshot } from "./types";

export const SNAPSHOT_TTL_SECONDS = 60 * 60;
export const SNAPSHOT_PREFIX = "pool:snapshot:";
export const PREVIOUS_SNAPSHOT_PREFIX = "pool:previous:";

export interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KvListResult>;
}

export interface KvListResult {
  keys: Array<{ name: string }>;
  list_complete: boolean;
  cursor?: string;
}

export interface RetryOptions {
  /**
   * Total attempts, including the initial operation. The default is three:
   * one initial attempt plus two retries after 100ms and 500ms.
   */
  maxAttempts?: number;
  backoffMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface SnapshotWriteOptions {
  ttlSeconds?: number;
  retry?: RetryOptions;
}

export interface SnapshotReadOptions {
  version?: "latest" | "previous";
  retry?: RetryOptions;
}

export interface SnapshotListOptions {
  retry?: RetryOptions;
  limit?: number;
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, "sleep">> = {
  maxAttempts: 3,
  backoffMs: [100, 500],
};

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryConfig(options?: RetryOptions) {
  const maxAttempts = Math.max(
    1,
    Math.floor(options?.maxAttempts ?? DEFAULT_RETRY.maxAttempts),
  );
  const backoffMs =
    options?.backoffMs && options.backoffMs.length > 0
      ? options.backoffMs
      : DEFAULT_RETRY.backoffMs;

  return {
    maxAttempts,
    backoffMs,
    sleep: options?.sleep ?? defaultSleep,
  };
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const config = retryConfig(options);
  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === config.maxAttempts - 1) {
        throw error;
      }

      const delay =
        config.backoffMs[attempt] ??
        config.backoffMs[config.backoffMs.length - 1] ??
        0;
      await config.sleep(delay);
    }
  }

  throw lastError;
}

function latestKey(poolId: string): string {
  return SNAPSHOT_PREFIX + asPoolId(poolId);
}

function previousKey(poolId: string): string {
  return PREVIOUS_SNAPSHOT_PREFIX + asPoolId(poolId);
}

function parseSnapshot(value: string, poolId: string): PoolSnapshot {
  const parsed = JSON.parse(value) as PoolSnapshot;
  return assertPoolSnapshot(parsed, poolId);
}

function isSnapshot(value: PoolSnapshot | string): value is PoolSnapshot {
  return typeof value !== "string";
}

export function writeSnapshot(
  kv: KvNamespaceLike,
  snapshot: PoolSnapshot,
  options?: SnapshotWriteOptions,
): Promise<void>;
export function writeSnapshot(
  kv: KvNamespaceLike,
  poolId: string,
  snapshot: PoolSnapshot,
  options?: SnapshotWriteOptions,
): Promise<void>;
export async function writeSnapshot(
  kv: KvNamespaceLike,
  poolOrSnapshot: string | PoolSnapshot,
  snapshotOrOptions?: PoolSnapshot | SnapshotWriteOptions,
  maybeOptions?: SnapshotWriteOptions,
): Promise<void> {
  const snapshot = isSnapshot(poolOrSnapshot)
    ? poolOrSnapshot
    : (snapshotOrOptions as PoolSnapshot);
  const options = isSnapshot(poolOrSnapshot)
    ? (snapshotOrOptions as SnapshotWriteOptions | undefined)
    : maybeOptions;

  if (!snapshot) {
    throw new TypeError("A PoolSnapshot is required");
  }

  const requestedPoolId = isSnapshot(poolOrSnapshot)
    ? snapshot.pool_id
    : poolOrSnapshot;
  const poolId = asPoolId(requestedPoolId);
  assertPoolSnapshot(snapshot, poolId);

  const ttlSeconds = options?.ttlSeconds ?? SNAPSHOT_TTL_SECONDS;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError("ttlSeconds must be a positive integer");
  }

  const retry = options?.retry;
  const current = await withRetry(
    () => kv.get(latestKey(poolId)),
    retry,
  );

  // KV has no transaction primitive. Copy the current value first so that a
  // successful write always leaves the immediately preceding snapshot
  // available to delta calculators.
  if (current !== null) {
    await withRetry(
      () =>
        kv.put(previousKey(poolId), current, {
          expirationTtl: ttlSeconds,
        }),
      retry,
    );
  }

  await withRetry(
    () =>
      kv.put(latestKey(poolId), JSON.stringify(snapshot), {
        expirationTtl: ttlSeconds,
      }),
    retry,
  );
}

export async function readSnapshot(
  kv: KvNamespaceLike,
  poolId: string,
  options?: SnapshotReadOptions,
): Promise<PoolSnapshot | null> {
  const normalized = asPoolId(poolId);
  const key =
    options?.version === "previous"
      ? previousKey(normalized)
      : latestKey(normalized);
  const value = await withRetry(() => kv.get(key), options?.retry);
  return value === null ? null : parseSnapshot(value, normalized);
}

export async function hasSnapshot(
  kv: KvNamespaceLike,
  poolId: string,
  options?: { retry?: RetryOptions },
): Promise<boolean> {
  const value = await withRetry(
    () => kv.get(latestKey(poolId)),
    options?.retry,
  );
  return value !== null;
}

export async function listSnapshots(
  kv: KvNamespaceLike,
  options?: SnapshotListOptions,
): Promise<PoolSnapshot[]> {
  const snapshots: PoolSnapshot[] = [];
  let cursor: string | undefined;

  do {
    const page = await withRetry(
      () =>
        kv.list({
          prefix: SNAPSHOT_PREFIX,
          ...(cursor ? { cursor } : {}),
          ...(options?.limit ? { limit: options.limit } : {}),
        }),
      options?.retry,
    );

    for (const key of page.keys) {
      const value = await withRetry(() => kv.get(key.name), options?.retry);
      if (value === null) {
        continue;
      }

      const poolId = key.name.slice(SNAPSHOT_PREFIX.length);
      snapshots.push(parseSnapshot(value, poolId));
    }

    const nextCursor = page.list_complete ? undefined : page.cursor;
    if (!nextCursor || nextCursor === cursor) {
      cursor = undefined;
    } else {
      cursor = nextCursor;
    }
  } while (cursor !== undefined);

  return snapshots.sort(
    (left, right) =>
      Date.parse(right.captured_at) - Date.parse(left.captured_at),
  );
}
