import { API_BASE_URL } from '../config';
import type { AlertTier, SwitchState, Telemetry } from '../types';

async function request(
  path: string,
  options: RequestInit & { expectJson?: boolean } = {}
): Promise<Response | undefined> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error(`[api] ${options.method ?? 'GET'} ${path} failed`, error);
    return undefined;
  }
}

export async function fetchLatestTelemetry(): Promise<Telemetry | null> {
  const response = await request('/telemetry/latest');
  if (!response) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  try {
    const payload = (await response.json()) as Telemetry;
    return payload;
  } catch (error) {
    console.error('[api] Failed to parse telemetry payload', error);
    return null;
  }
}

async function postJson(path: string, body: unknown) {
  await request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function sendSleepState(deviceId: string, sleep: boolean) {
  await postJson(`/device/${encodeURIComponent(deviceId)}/sleep`, { sleep });
}

export async function sendPowerState(deviceId: string, state: SwitchState) {
  await postJson(`/device/${encodeURIComponent(deviceId)}/power`, {
    switch: state,
  });
}

export async function acknowledgeTier(deviceId: string, tier: AlertTier) {
  await postJson(`/device/${encodeURIComponent(deviceId)}/acknowledge`, {
    tier,
  });
}
