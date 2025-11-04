import type { WatcherConfig } from "../config";
import type { AlertEvent, DeltaSnapshot, PoolMetrics } from "../types";
import { getDb } from "../services/db";
import { normaliseJson } from "../utils/json";

export interface WatcherRow {
  watcher_id: string;
  payer_address: string;
  status: "active" | "paused" | "disabled";
  polling_interval_ms: number | null;
  last_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WatcherWithConfig {
  watcher: WatcherRow;
  config: WatcherConfig | null;
  configVersion: number | null;
}

const DEFAULT_MAX_ROWS = 256;

function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

function metricKey(protocolId: string, poolId: string): string {
  return `${protocolId.toLowerCase()}::${poolId.toLowerCase()}`;
}

export class PostgresWatcherRepository {
  private readonly sql = getDb();

  async ensureWatcher(
    payerAddress: string,
    pollingIntervalMs: number | null | undefined
  ): Promise<WatcherRow> {
    const address = normaliseAddress(payerAddress);
    const existing =
      await this.sql<WatcherRow[]>`SELECT * FROM watchers WHERE payer_address = ${address}`;
    if (existing.length > 0) {
      if (
        pollingIntervalMs &&
        existing[0].polling_interval_ms !== pollingIntervalMs
      ) {
        const updated =
          await this.sql<WatcherRow[]>`UPDATE watchers SET polling_interval_ms = ${pollingIntervalMs}, updated_at = now() WHERE watcher_id = ${existing[0].watcher_id} RETURNING *`;
        return updated[0];
      }
      return existing[0];
    }

    const inserted =
      await this.sql<WatcherRow[]>`INSERT INTO watchers (payer_address, polling_interval_ms) VALUES (${address}, ${pollingIntervalMs ?? null}) RETURNING *`;
    return inserted[0];
  }

  async getWatcherByAddress(address: string): Promise<WatcherRow | null> {
    const normalised = normaliseAddress(address);
    const rows =
      await this.sql<WatcherRow[]>`SELECT * FROM watchers WHERE payer_address = ${normalised}`;
    return rows[0] ?? null;
  }

  async saveWatcherConfig(
    watcherId: string,
    config: WatcherConfig
  ): Promise<{ version: number }> {
    const [{ next_version }] = await this.sql<
      { next_version: number }[]
    >`SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM watcher_configs WHERE watcher_id = ${watcherId}`;

    const serialisedConfig = normaliseJson(config) as any;

    await this.sql`INSERT INTO watcher_configs (watcher_id, version, config) VALUES (${watcherId}, ${next_version}, ${this.sql.json(serialisedConfig)})`;

    return { version: next_version };
  }

  async getLatestConfig(
    watcherId: string
  ): Promise<{ config: WatcherConfig; version: number } | null> {
    const rows =
      await this.sql<
        { config: WatcherConfig; version: number }[]
      >`SELECT config, version FROM watcher_configs WHERE watcher_id = ${watcherId} ORDER BY version DESC LIMIT 1`;
    if (!rows.length) {
      return null;
    }
    return rows[0];
  }

  async resetWatcherState(watcherId: string): Promise<void> {
    await this.sql.begin(async (sql) => {
      await sql`DELETE FROM watcher_metrics WHERE watcher_id = ${watcherId}`;
      await sql`DELETE FROM watcher_deltas WHERE watcher_id = ${watcherId}`;
      await sql`DELETE FROM watcher_alerts WHERE watcher_id = ${watcherId}`;
      await sql`UPDATE watchers SET last_run_at = NULL, updated_at = now() WHERE watcher_id = ${watcherId}`;
    });
  }

  async listActiveWatchersWithConfig(): Promise<WatcherWithConfig[]> {
    const rows = await this.sql<
      (WatcherRow & { config: WatcherConfig | null; version: number | null })[]
    >`SELECT w.*, wc.config, wc.version
      FROM watchers w
      LEFT JOIN LATERAL (
        SELECT config, version
        FROM watcher_configs
        WHERE watcher_id = w.watcher_id
        ORDER BY version DESC
        LIMIT 1
      ) AS wc ON TRUE
      WHERE w.status = 'active'`;

    return rows.map((row) => ({
      watcher: {
        watcher_id: row.watcher_id,
        payer_address: row.payer_address,
        status: row.status,
        polling_interval_ms: row.polling_interval_ms,
        last_run_at: row.last_run_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      config: row.config,
      configVersion: row.version,
    }));
  }

  async updateWatcherRunState(
    watcherId: string,
    runAt: Date
  ): Promise<void> {
    await this.sql`UPDATE watchers SET last_run_at = ${runAt}, updated_at = now() WHERE watcher_id = ${watcherId}`;
  }

  async getLatestMetricsMap(
    watcherId: string,
    protocolId?: string,
    poolId?: string
  ): Promise<Map<string, PoolMetrics>> {
    const rows = await this.sql<
      {
        protocol_id: string;
        pool_id: string;
        chain_id: number;
        block_number: string | null;
        metric_timestamp_ms: number;
        apy: number | null;
        tvl: number | null;
        raw: Record<string, unknown> | null;
      }[]
    >`SELECT DISTINCT ON (protocol_id, pool_id)
        protocol_id,
        pool_id,
        chain_id,
        block_number,
        metric_timestamp_ms,
        apy,
        tvl,
        raw
      FROM watcher_metrics
      WHERE watcher_id = ${watcherId}
        ${protocolId ? this.sql`AND protocol_id = ${protocolId}` : this.sql``}
        ${poolId ? this.sql`AND pool_id = ${poolId}` : this.sql``}
      ORDER BY protocol_id, pool_id, metric_timestamp_ms DESC`;

    const map = new Map<string, PoolMetrics>();
    for (const row of rows) {
      const key = metricKey(row.protocol_id, row.pool_id);
      map.set(key, {
        protocolId: row.protocol_id,
        poolId: row.pool_id,
        chainId: row.chain_id,
        address:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        blockNumber: row.block_number
          ? BigInt(row.block_number)
          : undefined,
        timestamp: row.metric_timestamp_ms,
        apy: row.apy ?? null,
        tvl: row.tvl ?? null,
        raw: row.raw ?? undefined,
      } as PoolMetrics);
    }

    return map;
  }

  async insertMetrics(
    watcher: WatcherRow,
    metrics: PoolMetrics[]
  ): Promise<void> {
    if (!metrics.length) return;
    await this.sql.begin(async (sql) => {
      for (const metric of metrics) {
        await sql`INSERT INTO watcher_metrics (
            watcher_id,
            protocol_id,
            pool_id,
            chain_id,
            block_number,
            metric_timestamp,
            metric_timestamp_ms,
            apy,
            tvl,
            raw
          ) VALUES (
            ${watcher.watcher_id},
            ${metric.protocolId},
            ${metric.poolId},
            ${metric.chainId},
            ${
              metric.blockNumber !== undefined && metric.blockNumber !== null
                ? String(metric.blockNumber)
                : null
            },
            ${new Date(metric.timestamp)},
            ${metric.timestamp},
            ${metric.apy ?? null},
            ${metric.tvl ?? null},
            ${metric.raw
              ? sql.json(normaliseJson(metric.raw) as any)
              : null}
          )
          ON CONFLICT (watcher_id, protocol_id, pool_id, block_number)
          DO UPDATE SET
            metric_timestamp = excluded.metric_timestamp,
            metric_timestamp_ms = excluded.metric_timestamp_ms,
            apy = excluded.apy,
            tvl = excluded.tvl,
            raw = excluded.raw,
            collected_at = now()`;
      }
    });
  }

  async insertDeltas(
    watcher: WatcherRow,
    deltas: DeltaSnapshot[]
  ): Promise<void> {
    if (!deltas.length) return;
    await this.sql.begin(async (sql) => {
      for (const delta of deltas) {
        await sql`INSERT INTO watcher_deltas (
            watcher_id,
            protocol_id,
            pool_id,
            metric,
            previous_value,
            current_value,
            absolute_change,
            percent_change,
            block_number,
            delta_timestamp,
            delta_timestamp_ms
          ) VALUES (
            ${watcher.watcher_id},
            ${delta.protocolId},
            ${delta.poolId},
            ${delta.metric},
            ${
              delta.previous !== undefined && delta.previous !== null
                ? Number(delta.previous)
                : null
            },
            ${
              delta.current !== undefined && delta.current !== null
                ? Number(delta.current)
                : null
            },
            ${
              delta.absoluteChange !== undefined &&
              delta.absoluteChange !== null
                ? Number(delta.absoluteChange)
                : null
            },
            ${
              delta.percentChange !== undefined && delta.percentChange !== null
                ? Number(delta.percentChange)
                : null
            },
            ${
              delta.blockNumber !== undefined && delta.blockNumber !== null
                ? String(delta.blockNumber)
                : null
            },
            ${new Date(delta.timestamp)},
            ${delta.timestamp}
          )`;
      }
    });
  }

  async insertAlerts(
    watcher: WatcherRow,
    alerts: AlertEvent[]
  ): Promise<void> {
    if (!alerts.length) return;
    await this.sql.begin(async (sql) => {
      for (const alert of alerts) {
        await sql`INSERT INTO watcher_alerts (
            alert_id,
            watcher_id,
            protocol_id,
            pool_id,
            metric,
            rule_id,
            change_direction,
            change_amount,
            percent_change,
            block_number,
            triggered_at,
            triggered_at_ms,
            message,
            metadata
          ) VALUES (
            ${alert.id},
            ${watcher.watcher_id},
            ${alert.protocolId},
            ${alert.poolId},
            ${alert.metric},
            ${alert.ruleId},
            ${alert.changeDirection},
            ${
              alert.changeAmount !== undefined && alert.changeAmount !== null
                ? Number(alert.changeAmount)
                : null
            },
            ${
              alert.percentChange !== undefined && alert.percentChange !== null
                ? Number(alert.percentChange)
                : null
            },
            ${
              alert.blockNumber !== undefined && alert.blockNumber !== null
                ? String(alert.blockNumber)
                : null
            },
            ${new Date(alert.triggeredAt)},
            ${alert.triggeredAt},
            ${alert.message},
            ${alert.metadata
              ? sql.json(normaliseJson(alert.metadata) as any)
              : null}
          )
          ON CONFLICT (alert_id)
          DO UPDATE SET
            percent_change = excluded.percent_change,
            change_amount = excluded.change_amount,
            message = excluded.message,
            metadata = excluded.metadata,
            triggered_at = excluded.triggered_at,
            triggered_at_ms = excluded.triggered_at_ms,
            block_number = excluded.block_number`;
      }
    });
  }

  async getLatestMetrics(
    watcherId: string,
    filter?: { protocolId?: string; poolId?: string }
  ): Promise<PoolMetrics[]> {
    const map = await this.getLatestMetricsMap(
      watcherId,
      filter?.protocolId,
      filter?.poolId
    );
    return Array.from(map.values());
  }

  async getDeltas(
    watcherId: string,
    filter?: { protocolId?: string; poolId?: string }
  ): Promise<DeltaSnapshot[]> {
    const rows = await this.sql<
      {
        protocol_id: string;
        pool_id: string;
        metric: "tvl" | "apy";
        previous_value: number | null;
        current_value: number | null;
        absolute_change: number | null;
        percent_change: number | null;
        block_number: string | null;
        delta_timestamp_ms: number;
      }[]
    >`SELECT protocol_id,
              pool_id,
              metric,
              previous_value,
              current_value,
              absolute_change,
              percent_change,
              block_number,
              delta_timestamp_ms
        FROM watcher_deltas
        WHERE watcher_id = ${watcherId}
        ${filter?.protocolId ? this.sql`AND protocol_id = ${filter.protocolId}` : this.sql``}
        ${filter?.poolId ? this.sql`AND pool_id = ${filter.poolId}` : this.sql``}
        ORDER BY delta_timestamp_ms DESC
        LIMIT ${DEFAULT_MAX_ROWS}`;

    return rows.map((row) => ({
      protocolId: row.protocol_id,
      poolId: row.pool_id,
      metric: row.metric,
      previous: row.previous_value ?? null,
      current: row.current_value ?? null,
      absoluteChange: row.absolute_change ?? null,
      percentChange: row.percent_change ?? null,
      timestamp: row.delta_timestamp_ms,
      blockNumber: row.block_number ? BigInt(row.block_number) : undefined,
    }));
  }

  async getAlerts(
    watcherId: string,
    filter?: { protocolId?: string; poolId?: string; limit?: number }
  ): Promise<AlertEvent[]> {
    const limit = Math.min(filter?.limit ?? DEFAULT_MAX_ROWS, DEFAULT_MAX_ROWS);
    const rows = await this.sql<
      {
        alert_id: string;
        protocol_id: string;
        pool_id: string;
        metric: "tvl" | "apy";
        rule_id: string;
        change_direction: "increase" | "decrease";
        change_amount: number | null;
        percent_change: number | null;
        block_number: string | null;
        triggered_at_ms: number;
        message: string;
        metadata: Record<string, unknown> | null;
      }[]
    >`SELECT alert_id,
              protocol_id,
              pool_id,
              metric,
              rule_id,
              change_direction,
              change_amount,
              percent_change,
              block_number,
              triggered_at_ms,
              message,
              metadata
        FROM watcher_alerts
        WHERE watcher_id = ${watcherId}
        ${filter?.protocolId ? this.sql`AND protocol_id = ${filter.protocolId}` : this.sql``}
        ${filter?.poolId ? this.sql`AND pool_id = ${filter.poolId}` : this.sql``}
        ORDER BY triggered_at_ms DESC
        LIMIT ${limit}`;

    return rows.map((row) => ({
      id: row.alert_id,
      protocolId: row.protocol_id,
      poolId: row.pool_id,
      metric: row.metric,
      ruleId: row.rule_id,
      triggeredAt: row.triggered_at_ms,
      changeDirection: row.change_direction,
      changeAmount: row.change_amount ?? null,
      percentChange: row.percent_change ?? null,
      message: row.message,
      metadata: row.metadata ?? undefined,
      blockNumber: row.block_number ? BigInt(row.block_number) : undefined,
    }));
  }
}
