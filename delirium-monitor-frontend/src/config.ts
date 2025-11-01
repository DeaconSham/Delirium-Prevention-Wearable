import type { TelemetryMode } from './types';

const rawMode = (import.meta.env.VITE_TELEMETRY_MODE ?? 'ws').toString().toLowerCase();

function normalizeMode(value: string): TelemetryMode {
  if (value === 'poll' || value === 'mock') {
    return value;
  }
  return 'ws';
}

export const TELEMETRY_MODE: TelemetryMode = normalizeMode(rawMode);

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? 'ws://localhost:5000/ws/telemetry';

const parsedInterval = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? '1000');
export const POLL_INTERVAL_MS = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1000;

export const DEFAULT_DEVICE_ID: string =
  import.meta.env.VITE_DEVICE_ID ?? 'arduino-01';
