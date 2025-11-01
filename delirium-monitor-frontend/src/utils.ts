import {
  ALERT_TIER1_MINUTES,
  ALERT_TIER2_MINUTES,
  ALERT_TIER3_MINUTES,
} from './constants';
import type { AlertTier, TempStatus, Telemetry } from './types';

export const ALERT_TIER1_SECONDS = ALERT_TIER1_MINUTES * 60;
export const ALERT_TIER2_SECONDS = ALERT_TIER2_MINUTES * 60;
export const ALERT_TIER3_SECONDS = ALERT_TIER3_MINUTES * 60;

export function calculateTempStatus(tempC: number | null | undefined): TempStatus {
  if (tempC == null || Number.isNaN(tempC)) {
    return 'normal';
  }
  if (tempC < 35) {
    return 'low';
  }
  if (tempC >= 37.6 && tempC < 38.5) {
    return 'elevated';
  }
  if (tempC >= 38.5) {
    return 'fever';
  }
  return 'normal';
}

export function deriveTier(secondsStill: number): AlertTier {
  if (secondsStill >= ALERT_TIER3_SECONDS) return 3;
  if (secondsStill >= ALERT_TIER2_SECONDS) return 2;
  if (secondsStill >= ALERT_TIER1_SECONDS) return 1;
  return 0;
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  parts.push(`${mins.toString().padStart(2, '0')}m`);
  parts.push(`${secs.toString().padStart(2, '0')}s`);
  return parts.join(' ');
}

export function computeMagnitude(sample: Telemetry): number {
  if (typeof sample.accel.mag === 'number') return sample.accel.mag;
  const { x, y, z } = sample.accel;
  return Math.sqrt(x * x + y * y + z * z);
}

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts);
}
