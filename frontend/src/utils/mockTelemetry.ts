import type { SwitchState, Telemetry } from '../types';

const jitter = () => (Math.random() - 0.5) * 0.01;
const wobble = () => 0.2 + Math.random() * 0.3;

export function createBaselineSample(
  ts: number,
  switchState: SwitchState,
  sleep: boolean,
  temp: number
): Telemetry {
  return {
    ts,
    accel: {
      x: jitter(),
      y: jitter(),
      z: 1 + jitter(),
    },
    temp_c: Number(temp.toFixed(2)),
    switch: switchState,
    sleep,
  };
}

export function createMovementSample(
  ts: number,
  switchState: SwitchState,
  sleep: boolean,
  temp: number
): Telemetry {
  return {
    ts,
    accel: {
      x: wobble(),
      y: wobble(),
      z: 0.6 + Math.random() * 0.3,
    },
    temp_c: Number(temp.toFixed(2)),
    switch: switchState,
    sleep,
  };
}
