BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS watchers (
    watcher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_address TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'disabled')),
    polling_interval_ms INTEGER,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watchers_status_active
    ON watchers (status)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS watcher_configs (
    config_id BIGSERIAL PRIMARY KEY,
    watcher_id UUID NOT NULL REFERENCES watchers (watcher_id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version > 0),
    config JSONB NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watcher_configs_unique
    ON watcher_configs (watcher_id, version);

CREATE TABLE IF NOT EXISTS watcher_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    watcher_id UUID NOT NULL REFERENCES watchers (watcher_id) ON DELETE CASCADE,
    protocol_id TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT,
    metric_timestamp TIMESTAMPTZ NOT NULL,
    metric_timestamp_ms BIGINT NOT NULL,
    apy DOUBLE PRECISION,
    tvl DOUBLE PRECISION,
    raw JSONB,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watcher_metrics_block
    ON watcher_metrics (watcher_id, protocol_id, pool_id, block_number);

CREATE INDEX IF NOT EXISTS idx_watcher_metrics_recent
    ON watcher_metrics (watcher_id, protocol_id, pool_id, metric_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_watcher_metrics_chain
    ON watcher_metrics (chain_id, metric_timestamp DESC);

CREATE TABLE IF NOT EXISTS watcher_deltas (
    delta_id BIGSERIAL PRIMARY KEY,
    watcher_id UUID NOT NULL REFERENCES watchers (watcher_id) ON DELETE CASCADE,
    protocol_id TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('tvl', 'apy')),
    previous_value DOUBLE PRECISION,
    current_value DOUBLE PRECISION,
    absolute_change DOUBLE PRECISION,
    percent_change DOUBLE PRECISION,
    block_number BIGINT,
    delta_timestamp TIMESTAMPTZ NOT NULL,
    delta_timestamp_ms BIGINT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watcher_deltas_recent
    ON watcher_deltas (watcher_id, protocol_id, pool_id, delta_timestamp DESC);

CREATE TABLE IF NOT EXISTS watcher_alerts (
    alert_id TEXT PRIMARY KEY,
    watcher_id UUID NOT NULL REFERENCES watchers (watcher_id) ON DELETE CASCADE,
    protocol_id TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('tvl', 'apy')),
    rule_id TEXT NOT NULL,
    change_direction TEXT NOT NULL CHECK (change_direction IN ('increase', 'decrease')),
    change_amount DOUBLE PRECISION,
    percent_change DOUBLE PRECISION,
    block_number BIGINT,
    triggered_at TIMESTAMPTZ NOT NULL,
    triggered_at_ms BIGINT NOT NULL,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watcher_alerts_recent
    ON watcher_alerts (watcher_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_watcher_alerts_rule
    ON watcher_alerts (watcher_id, rule_id, triggered_at DESC);

COMMIT;
