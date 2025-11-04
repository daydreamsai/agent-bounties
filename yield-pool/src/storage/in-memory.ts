import { WatcherConfig } from "../config";
import { AlertEvent, DeltaSnapshot, PoolMetrics } from "../types";

const DEFAULT_DELTA_LIMIT = 256;
const DEFAULT_ALERT_LIMIT = 256;

export interface WatcherStoreOptions {
  deltaLimit?: number;
  alertLimit?: number;
}

export interface WatcherStore {
  getConfig(): WatcherConfig | null;
  setConfig(config: WatcherConfig): void;
  resetState(): void;

  upsertMetrics(metrics: PoolMetrics[]): void;
  getMetrics(): PoolMetrics[];
  getMetric(protocolId: string, poolId: string): PoolMetrics | null;

  appendDeltas(deltas: DeltaSnapshot[]): void;
  getDeltas(): DeltaSnapshot[];

  appendAlerts(alerts: AlertEvent[]): void;
  getAlerts(): AlertEvent[];
}

const keyFor = (protocolId: string, poolId: string) =>
  `${protocolId.toLowerCase()}::${poolId.toLowerCase()}`;

export class InMemoryWatcherStore implements WatcherStore {
  private config: WatcherConfig | null = null;
  private metrics = new Map<string, PoolMetrics>();
  private deltas: DeltaSnapshot[] = [];
  private alerts: AlertEvent[] = [];
  private readonly deltaLimit: number;
  private readonly alertLimit: number;

  constructor(options?: WatcherStoreOptions) {
    this.deltaLimit = options?.deltaLimit ?? DEFAULT_DELTA_LIMIT;
    this.alertLimit = options?.alertLimit ?? DEFAULT_ALERT_LIMIT;
  }

  getConfig(): WatcherConfig | null {
    return this.config;
  }

  setConfig(config: WatcherConfig): void {
    this.config = config;
  }

  resetState(): void {
    this.metrics.clear();
    this.deltas = [];
    this.alerts = [];
  }

  upsertMetrics(metrics: PoolMetrics[]): void {
    for (const metric of metrics) {
      const key = keyFor(metric.protocolId, metric.poolId);
      this.metrics.set(key, metric);
    }
  }

  getMetrics(): PoolMetrics[] {
    return Array.from(this.metrics.values());
  }

  getMetric(protocolId: string, poolId: string): PoolMetrics | null {
    const key = keyFor(protocolId, poolId);
    return this.metrics.get(key) ?? null;
  }

  appendDeltas(deltas: DeltaSnapshot[]): void {
    if (!deltas.length) return;
    this.deltas.push(...deltas);
    if (this.deltas.length > this.deltaLimit) {
      this.deltas = this.deltas.slice(-this.deltaLimit);
    }
  }

  getDeltas(): DeltaSnapshot[] {
    return [...this.deltas];
  }

  appendAlerts(alerts: AlertEvent[]): void {
    if (!alerts.length) return;
    this.alerts.push(...alerts);
    if (this.alerts.length > this.alertLimit) {
      this.alerts = this.alerts.slice(-this.alertLimit);
    }
  }

  getAlerts(): AlertEvent[] {
    return [...this.alerts];
  }
}
