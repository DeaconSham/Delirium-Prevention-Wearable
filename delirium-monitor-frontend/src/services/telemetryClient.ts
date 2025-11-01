import { POLL_INTERVAL_MS, TELEMETRY_MODE, WS_URL } from '../config';
import type { Telemetry } from '../types';
import { fetchLatestTelemetry } from './api';

interface TelemetryStreamOptions {
  onTelemetry: (sample: Telemetry) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function startTelemetryStream({
  onTelemetry,
  onConnectionChange,
}: TelemetryStreamOptions): () => void {
  if (TELEMETRY_MODE === 'mock') {
    return () => {};
  }

  if (TELEMETRY_MODE === 'poll') {
    return startPolling({ onTelemetry, onConnectionChange });
  }

  return startWebSocketWithFallback({ onTelemetry, onConnectionChange });
}

function startWebSocketWithFallback(options: TelemetryStreamOptions): () => void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return startPolling(options);
  }

  let socket: WebSocket | null = null;
  let manualClose = false;
  let retryCount = 0;
  let reconnectTimer: number | null = null;
  let pollCleanup: (() => void) | null = null;

  const cleanup = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
    }
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }
    if (pollCleanup) {
      pollCleanup();
      pollCleanup = null;
    }
  };

  const connect = () => {
    cleanup();
    if (manualClose) return;

    try {
      socket = new WebSocket(WS_URL);
    } catch (error) {
      console.error('[telemetry] Failed to open WebSocket, falling back to polling', error);
      pollCleanup = startPolling(options);
      return;
    }

    socket.onopen = () => {
      retryCount = 0;
      options.onConnectionChange?.(true);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Telemetry;
        options.onTelemetry(payload);
      } catch (error) {
        console.error('[telemetry] Failed to parse WebSocket payload', error);
      }
    };

    socket.onerror = (event) => {
      console.error('[telemetry] WebSocket error', event);
      socket?.close();
    };

    socket.onclose = () => {
      options.onConnectionChange?.(false);
      if (manualClose) {
        return;
      }
      retryCount += 1;
      if (retryCount >= 3) {
        pollCleanup = startPolling(options);
        return;
      }
      const delay = Math.min(5000, 1000 * retryCount);
      reconnectTimer = window.setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    manualClose = true;
    cleanup();
  };
}

function startPolling({
  onTelemetry,
  onConnectionChange,
}: TelemetryStreamOptions): () => void {
  let intervalId: number | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const sample = await fetchLatestTelemetry();
      if (sample) {
        onTelemetry(sample);
        onConnectionChange?.(true);
      }
    } catch (error) {
      console.error('[telemetry] Polling failed', error);
      onConnectionChange?.(false);
    }
  };

  poll();
  intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  };
}
