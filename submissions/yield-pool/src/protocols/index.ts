import { aaveV3Adapter } from "./aave-v3";
import { curveAdapter } from "./curve";
import type { ProtocolAdapter } from "./types";

const adapterRegistry = new Map<string, ProtocolAdapter>();
const protocolLookup = new Map<string, ProtocolAdapter>();

function registerProtocolAdapter(adapter: ProtocolAdapter): void {
  adapterRegistry.set(adapter.id, adapter);
  for (const protocolId of adapter.supports.protocolIds) {
    protocolLookup.set(protocolId.toLowerCase(), adapter);
  }
}

function unregisterProtocolAdapter(id: string): void {
  const adapter = adapterRegistry.get(id);
  if (!adapter) return;
  adapterRegistry.delete(id);
  for (const protocolId of adapter.supports.protocolIds) {
    const lowered = protocolId.toLowerCase();
    const current = protocolLookup.get(lowered);
    if (current?.id === adapter.id) {
      protocolLookup.delete(lowered);
    }
  }
}

export function clearProtocolAdapters(): void {
  adapterRegistry.clear();
  protocolLookup.clear();
}

export function setProtocolAdapters(adapters: ProtocolAdapter[]): void {
  clearProtocolAdapters();
  for (const adapter of adapters) {
    registerProtocolAdapter(adapter);
  }
}

// Register built-in adapters on module load.
registerProtocolAdapter(aaveV3Adapter);
registerProtocolAdapter(curveAdapter);

/**
 * Return all registered protocol adapters.
 */
export function listProtocolAdapters(): ProtocolAdapter[] {
  return Array.from(adapterRegistry.values());
}

/**
 * Resolve an adapter by protocol id.
 */
export function getProtocolAdapter(protocolId: string): ProtocolAdapter | null {
  return protocolLookup.get(protocolId.toLowerCase()) ?? null;
}

export { registerProtocolAdapter, unregisterProtocolAdapter };
export type { ProtocolAdapter } from "./types";
