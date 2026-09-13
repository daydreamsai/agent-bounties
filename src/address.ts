import { getAddress } from "ethers";
import type { PoolId, PoolSnapshot } from "./types";

/**
 * Normalize a hexadecimal contract address to its EIP-55 representation.
 * ethers rejects malformed addresses and mixed-case strings with a bad
 * checksum, so Pool IDs cannot silently become ambiguous KV keys.
 */
export function checksumAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    throw new TypeError("Expected a valid EVM contract address");
  }
}

export function asPoolId(address: string): PoolId {
  return checksumAddress(address) as PoolId;
}

export function assertPoolSnapshot(snapshot: PoolSnapshot, poolId?: string): PoolSnapshot {
  const normalized = asPoolId(snapshot.pool_id);

  if (normalized !== snapshot.pool_id) {
    throw new TypeError("PoolSnapshot.pool_id must be EIP-55 checksummed");
  }

  if (poolId !== undefined && normalized !== asPoolId(poolId)) {
    throw new TypeError("PoolSnapshot.pool_id does not match the requested pool");
  }

  return snapshot;
}
