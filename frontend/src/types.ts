export type SwitchState = 'on' | 'off';
export type DeviceStatus = 'on' | 'off' | 'sleeping' | 'disconnected';
export type TempStatus = 'normal' | 'elevated' | 'fever' | 'low';
export type AlertTier = 0 | 1 | 2 | 3;
export type TelemetryMode = 'ws' | 'poll' | 'mock';

export interface Telemetry {
  ts: number;
  accel: { x: number; y: number; z: number; mag?: number };
  temp_c: number;
  switch: SwitchState;
  sleep?: boolean;
  device_id?: string;
  rssi?: number;
  battery?: number;
}

export interface TemperatureSample {
  ts: number;
  value: number;
}

export interface ActivitySample {
  ts: number;
  movement: boolean;
}
