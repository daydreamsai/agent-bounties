import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { OhlcvPoint, PoolSnapshot, SupportedNetwork } from './types.js';

const geckoBaseUrl = process.env.GECKOTERMINAL_BASE_URL || 'https://api.geckoterminal.com/api/v2';
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

export async function fetchPoolSnapshot(network: SupportedNetwork, poolAddress: string): Promise<PoolSnapshot> {
  const url = `${geckoBaseUrl}/networks/${network}/pools/${poolAddress}`;
  const response = await requestJson(url);
  if (!response.ok) throw new Error(`GeckoTerminal pool request failed: HTTP ${response.status}`);
  const json = await response.json() as { data?: { attributes?: Record<string, unknown> } };
  const attrs = json.data?.attributes || {};
  return {
    poolName: stringOrUndefined(attrs.name),
    reserveUsd: numberOrNull(attrs.reserve_in_usd),
    volumeWindows: volumeUsd(attrs.volume_usd),
    baseTokenPriceUsd: numberOrNull(attrs.base_token_price_usd),
    quoteTokenPriceUsd: numberOrNull(attrs.quote_token_price_usd),
    feeBps: poolFeeBps(attrs.pool_fee_percentage)
  };
}

export async function fetchPoolOhlcv(network: SupportedNetwork, poolAddress: string, windowHours: number): Promise<OhlcvPoint[]> {
  const limit = Math.min(Math.max(Math.ceil(windowHours) + 1, 2), 1000);
  const url = `${geckoBaseUrl}/networks/${network}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=${limit}`;
  const response = await requestJson(url);
  if (!response.ok) throw new Error(`GeckoTerminal OHLCV request failed: HTTP ${response.status}`);
  const json = await response.json() as { data?: { attributes?: { ohlcv_list?: unknown[] } } };
  const rows = json.data?.attributes?.ohlcv_list;
  if (!Array.isArray(rows)) return [];
  return rows.map(parseOhlcvRow).filter((row): row is OhlcvPoint => row !== null).sort((a, b) => a.timestamp - b.timestamp);
}

export function volumeFromOhlcv(points: OhlcvPoint[], windowHours: number): number | null {
  if (points.length === 0) return null;
  const cutoff = Math.max(...points.map((point) => point.timestamp)) - windowHours * 3600;
  const volume = points.filter((point) => point.timestamp >= cutoff).reduce((sum, point) => sum + point.volumeUsd, 0);
  return volume > 0 ? volume : null;
}

export function priceRelativeFromOhlcv(points: OhlcvPoint[], windowHours: number): { start: number; end: number; relative: number } | null {
  if (points.length < 2) return null;
  const end = points[points.length - 1];
  const cutoff = end.timestamp - windowHours * 3600;
  const start = points.find((point) => point.timestamp >= cutoff) || points[0];
  if (!Number.isFinite(start.close) || !Number.isFinite(end.close) || start.close <= 0 || end.close <= 0) return null;
  return { start: start.close, end: end.close, relative: end.close / start.close };
}

export function volumeFromSnapshot(snapshot: PoolSnapshot, windowHours: number): number | null {
  const windows = [
    { max: 1, key: 'h1', hours: 1 },
    { max: 6, key: 'h6', hours: 6 },
    { max: 24, key: 'h24', hours: 24 }
  ];
  const selected = windows.find((window) => windowHours <= window.max) || windows[2];
  const volume = snapshot.volumeWindows[selected.key];
  if (!volume || volume <= 0) return null;
  return volume * (windowHours / selected.hours);
}

function parseOhlcvRow(row: unknown): OhlcvPoint | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const [timestamp, open, high, low, close, volumeUsd] = row.map(Number);
  if ([timestamp, open, high, low, close, volumeUsd].some((value) => !Number.isFinite(value))) return null;
  return { timestamp, open, high, low, close, volumeUsd };
}

function volumeUsd(raw: unknown): Record<string, number | undefined> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    h1: numberOrUndefined(obj.h1),
    h6: numberOrUndefined(obj.h6),
    h24: numberOrUndefined(obj.h24)
  };
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function poolFeeBps(value: unknown): number | null {
  const percentage = Number(value);
  return Number.isFinite(percentage) ? percentage * 100 : null;
}

function requestJson(url: string) {
  return undiciFetch(url, {
    dispatcher,
    headers: { accept: 'application/json', 'user-agent': 'lp-impermanent-loss-estimator/0.1' }
  });
}
