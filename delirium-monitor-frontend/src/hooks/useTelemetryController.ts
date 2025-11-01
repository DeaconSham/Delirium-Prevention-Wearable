import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  ACTIVITY_HISTORY_MINUTES,
  DISCONNECT_THRESHOLD_MS,
  MOVEMENT_DELTA_THRESHOLD,
  MOVEMENT_SUSTAIN_SECONDS,
  QUIET_DEBOUNCE_MS,
  TEMPERATURE_HISTORY_MINUTES,
} from '../constants';
import { DEFAULT_DEVICE_ID, TELEMETRY_MODE } from '../config';
import { acknowledgeTier, sendPowerState, sendSleepState } from '../services/api';
import { startTelemetryStream } from '../services/telemetryClient';
import {
  calculateTempStatus,
  computeMagnitude,
  deriveTier,
} from '../utils';
import { createBaselineSample, createMovementSample } from '../utils/mockTelemetry';
import type {
  ActivitySample,
  AlertTier,
  DeviceStatus,
  SwitchState,
  Telemetry,
  TemperatureSample,
  TempStatus,
} from '../types';

const MOTION_INDICATOR_MS = 3000;

type MovementMode = 'still' | 'moving';

interface ControllerState {
  now: number;
  stillnessSeconds: number;
  currentTier: AlertTier;
  activeTier: AlertTier;
  acknowledgedTier: AlertTier;
  snoozeUntil: number | null;
  isSnoozed: boolean;
  muted: boolean;
  volume: number;
  deviceStatus: DeviceStatus;
  switchState: SwitchState;
  sleep: boolean;
  connected: boolean;
  lastUpdate: number | null;
  tempC: number | null;
  tempStatus: TempStatus;
  temperatureHistory: TemperatureSample[];
  activityHistory: ActivitySample[];
  motionDetected: boolean;
  manualPanelOpen: boolean;
  lastTelemetry?: Telemetry;
}

type Action =
  | {
      type: 'TELEMETRY';
      payload: {
        now: number;
        sample: Telemetry;
        movementEvent: boolean;
        activitySample: ActivitySample | null;
        recordTemperature: boolean;
      };
    }
  | {
      type: 'TICK';
      payload: {
        now: number;
        connected: boolean;
        deviceStatus: DeviceStatus;
        stillnessSeconds: number;
        currentTier: AlertTier;
        isSnoozed: boolean;
        motionDetected: boolean;
      };
    }
  | { type: 'ACK'; payload: { tier: AlertTier } }
  | { type: 'SNOOZE'; payload: { until: number } }
  | { type: 'CLEAR_SNOOZE' }
  | { type: 'RESET'; payload: { now: number } }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_SLEEP'; payload: boolean }
  | { type: 'SET_SWITCH'; payload: SwitchState }
  | { type: 'SET_MANUAL_PANEL'; payload: boolean }
  | { type: 'SET_STILLNESS'; payload: { seconds: number; now: number } };

const initialState: ControllerState = {
  now: Date.now(),
  stillnessSeconds: 0,
  currentTier: 0,
  activeTier: 0,
  acknowledgedTier: 0,
  snoozeUntil: null,
  isSnoozed: false,
  muted: false,
  volume: 0.7,
  deviceStatus: 'disconnected',
  switchState: 'on',
  sleep: false,
  connected: false,
  lastUpdate: null,
  tempC: null,
  tempStatus: 'normal',
  temperatureHistory: [],
  activityHistory: [],
  motionDetected: false,
  manualPanelOpen: false,
  lastTelemetry: undefined,
};

function clampVolume(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function reducer(state: ControllerState, action: Action): ControllerState {
  switch (action.type) {
    case 'TELEMETRY': {
      const { now, sample, movementEvent, activitySample, recordTemperature } =
        action.payload;
      const tempC = Number.isFinite(sample.temp_c) ? sample.temp_c : null;
      const tempStatus = calculateTempStatus(tempC);
      const nextSwitchState = sample.switch ?? state.switchState;
      const nextSleep =
        typeof sample.sleep === 'boolean' ? sample.sleep : state.sleep;
      const wokeFromSleep = state.sleep && !nextSleep;

      const temperatureHistory =
        tempC != null && recordTemperature
          ? [
              ...state.temperatureHistory,
              { ts: now, value: Number(tempC.toFixed(2)) },
            ].slice(-TEMPERATURE_HISTORY_MINUTES)
          : state.temperatureHistory;

      const activityHistory = activitySample
        ? [...state.activityHistory, activitySample].slice(-ACTIVITY_HISTORY_MINUTES)
        : state.activityHistory;

      const acknowledgedTier =
        movementEvent || wokeFromSleep ? 0 : state.acknowledgedTier;

      return {
        ...state,
        lastTelemetry: sample,
        lastUpdate: now,
        tempC,
        tempStatus,
        switchState: nextSwitchState,
        sleep: nextSleep,
        temperatureHistory,
        activityHistory,
        stillnessSeconds:
          movementEvent || wokeFromSleep ? 0 : state.stillnessSeconds,
        currentTier: movementEvent || wokeFromSleep ? 0 : state.currentTier,
        activeTier: movementEvent || wokeFromSleep ? 0 : state.activeTier,
        acknowledgedTier,
        snoozeUntil: wokeFromSleep ? null : state.snoozeUntil,
        isSnoozed: wokeFromSleep ? false : state.isSnoozed,
      };
    }
    case 'TICK': {
      const {
        now,
        connected,
        deviceStatus,
        stillnessSeconds,
        currentTier,
        isSnoozed,
        motionDetected,
      } = action.payload;

      let acknowledgedTier = state.acknowledgedTier;
      if (currentTier === 0 || currentTier < acknowledgedTier) {
        acknowledgedTier = currentTier;
      }

      const activeTier =
        deviceStatus === 'on' && !isSnoozed ? currentTier : 0;

      return {
        ...state,
        now,
        connected,
        deviceStatus,
        stillnessSeconds,
        currentTier,
        activeTier,
        isSnoozed,
        motionDetected,
        acknowledgedTier,
      };
    }
    case 'ACK': {
      const tier = action.payload.tier;
      if (tier === 0) return state;
      if (state.activeTier === 0) return state;
      return {
        ...state,
        acknowledgedTier: Math.max(state.acknowledgedTier, tier) as AlertTier,
      };
    }
    case 'SNOOZE':
      return {
        ...state,
        snoozeUntil: action.payload.until,
        isSnoozed: true,
        activeTier: 0,
      };
    case 'CLEAR_SNOOZE':
      return {
        ...state,
        snoozeUntil: null,
        isSnoozed: false,
      };
    case 'RESET':
      return {
        ...state,
        stillnessSeconds: 0,
        currentTier: 0,
        activeTier: 0,
        acknowledgedTier: 0,
        snoozeUntil: null,
        isSnoozed: false,
        now: action.payload.now,
      };
    case 'TOGGLE_MUTE':
      return {
        ...state,
        muted: !state.muted,
      };
    case 'SET_VOLUME':
      return {
        ...state,
        volume: clampVolume(action.payload),
        muted: clampVolume(action.payload) === 0 ? true : state.muted,
      };
    case 'SET_SLEEP': {
      const nextSleep = action.payload;
      const waking = state.sleep && !nextSleep;
      return {
        ...state,
        sleep: nextSleep,
        stillnessSeconds: waking ? 0 : state.stillnessSeconds,
        currentTier: waking ? 0 : state.currentTier,
        activeTier: waking ? 0 : state.activeTier,
        acknowledgedTier: waking ? 0 : state.acknowledgedTier,
        snoozeUntil: waking ? null : state.snoozeUntil,
        isSnoozed: waking ? false : state.isSnoozed,
      };
    }
    case 'SET_SWITCH':
      return {
        ...state,
        switchState: action.payload,
      };
    case 'SET_MANUAL_PANEL':
      return {
        ...state,
        manualPanelOpen: action.payload,
      };
    case 'SET_STILLNESS': {
      const { seconds, now } = action.payload;
      const tier = deriveTier(seconds);
      const activeTier =
        state.deviceStatus === 'on' && !state.isSnoozed ? tier : 0;
      return {
        ...state,
        stillnessSeconds: seconds,
        currentTier: tier,
        activeTier,
        acknowledgedTier: 0,
        snoozeUntil: null,
        isSnoozed: false,
        now,
      };
    }
    default:
      return state;
  }
}

interface ManualSampleInput {
  temperature: number;
  switchState: SwitchState;
  sleep: boolean;
  movementMode: MovementMode;
}

interface TelemetryController {
  state: ControllerState;
  acknowledge: () => void;
  snooze: (minutes: number) => void;
  resetStillness: () => void;
  toggleMute: () => void;
  setVolume: (value: number) => void;
  toggleSleep: () => void;
  togglePower: () => void;
  setManualPanelOpen: (open: boolean) => void;
  setTargetTemperature: (value: number) => void;
  setMovementMode: (mode: MovementMode) => void;
  setStillnessSeconds: (seconds: number) => void;
  simulateMovementBurst: () => void;
  simulateDisconnect: (seconds: number) => void;
  sendManualSample: (input: ManualSampleInput) => void;
}

export function useTelemetryController(): TelemetryController {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const lastMovementAtRef = useRef<number>(Date.now());
  const quietUntilRef = useRef<number>(Date.now());
  const lastMagRef = useRef<number | null>(null);
  const movementStreakRef = useRef<number>(0);
  const motionUntilRef = useRef<number>(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const minuteBucketRef = useRef<number | null>(null);
  const minuteMovementRef = useRef<boolean>(false);
  const disconnectUntilRef = useRef<number>(0);
  const movementModeRef = useRef<MovementMode>('still');
  const targetTempRef = useRef<number>(36.7);
  const switchStateRef = useRef<SwitchState>('on');
  const sleepRef = useRef<boolean>(false);
  const movementBurstTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    switchStateRef.current = state.switchState;
    sleepRef.current = state.sleep;
  }, [state.switchState, state.sleep]);

  const processTelemetry = useCallback(
    (sample: Telemetry) => {
      const now = sample.ts ?? Date.now();

      lastFrameAtRef.current = now;

      const previousSleep = stateRef.current.sleep;
      const nextSleep =
        typeof sample.sleep === 'boolean' ? sample.sleep : previousSleep;
      if (previousSleep && !nextSleep) {
        lastMovementAtRef.current = now;
        quietUntilRef.current = now + QUIET_DEBOUNCE_MS;
        movementStreakRef.current = 0;
      }

      const magnitude = computeMagnitude(sample);
      const lastMag = lastMagRef.current;

      let movementEvent = false;
      if (lastMag != null) {
        const delta = Math.abs(magnitude - lastMag);
        if (delta > MOVEMENT_DELTA_THRESHOLD) {
          movementStreakRef.current += 1;
        } else {
          movementStreakRef.current = 0;
        }

        if (movementStreakRef.current >= MOVEMENT_SUSTAIN_SECONDS) {
          movementEvent = true;
          movementStreakRef.current = 0;
        }
      }

      lastMagRef.current = magnitude;

      const currentBucket = Math.floor(now / 60000);
      let activitySample: ActivitySample | null = null;
      let recordTemperature = false;
      if (minuteBucketRef.current == null) {
        minuteBucketRef.current = currentBucket;
        recordTemperature = true;
      } else if (currentBucket !== minuteBucketRef.current) {
        activitySample = {
          ts: now,
          movement: minuteMovementRef.current,
        };
        minuteMovementRef.current = false;
        minuteBucketRef.current = currentBucket;
        recordTemperature = true;
      }

      if (movementEvent) {
        lastMovementAtRef.current = now;
        quietUntilRef.current = now + QUIET_DEBOUNCE_MS;
        minuteMovementRef.current = true;
        motionUntilRef.current = now + MOTION_INDICATOR_MS;
      }

      if (movementEvent) {
        recordTemperature = true;
      }

      dispatch({
        type: 'TELEMETRY',
        payload: {
          now,
          sample,
          movementEvent,
          activitySample,
          recordTemperature,
        },
      });
    },
    []
  );

  useEffect(() => {
    if (TELEMETRY_MODE !== 'mock') {
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      if (disconnectUntilRef.current && disconnectUntilRef.current > now) {
        return;
      }

      const movementMode = movementModeRef.current;
      const sleep = sleepRef.current;
      const switchState = switchStateRef.current;
      const temp = targetTempRef.current + (Math.random() - 0.5) * 0.2;
      const baseTs = now;

      const sample =
        movementMode === 'moving'
          ? createMovementSample(baseTs, switchState, sleep, temp)
          : createBaselineSample(baseTs, switchState, sleep, temp);

      processTelemetry(sample);
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [processTelemetry]);

  useEffect(() => {
    if (TELEMETRY_MODE === 'mock') {
      return;
    }
    const stop = startTelemetryStream({
      onTelemetry: (sample) => {
        processTelemetry(sample);
      },
      onConnectionChange: (connected) => {
        if (!connected) {
          const now = Date.now();
          lastFrameAtRef.current =
            now - (DISCONNECT_THRESHOLD_MS + 1000);
        }
      },
    });

    return () => {
      stop();
    };
  }, [processTelemetry]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const lastFrameAt = lastFrameAtRef.current;
      const connected =
        lastFrameAt != null && now - lastFrameAt <= DISCONNECT_THRESHOLD_MS;

      const switchState = switchStateRef.current;
      const sleep = sleepRef.current;

      const deviceStatus: DeviceStatus = connected
        ? switchState === 'off'
          ? 'off'
          : sleep
          ? 'sleeping'
          : 'on'
        : 'disconnected';

      let stillnessSeconds = stateRef.current.stillnessSeconds;

      if (deviceStatus === 'on') {
        if (now <= quietUntilRef.current) {
          stillnessSeconds = 0;
        } else {
          stillnessSeconds = Math.max(
            0,
            Math.floor((now - lastMovementAtRef.current) / 1000)
          );
        }
      } else {
        stillnessSeconds = 0;
      }

      const currentTier = deriveTier(stillnessSeconds);

      const snoozeUntil = stateRef.current.snoozeUntil;
      const isSnoozed =
        snoozeUntil != null && snoozeUntil > now && deviceStatus === 'on';

      const motionDetected = motionUntilRef.current > now;

      if (
        snoozeUntil != null &&
        snoozeUntil <= now &&
        stateRef.current.isSnoozed
      ) {
        dispatch({ type: 'CLEAR_SNOOZE' });
      }

      dispatch({
        type: 'TICK',
        payload: {
          now,
          connected,
          deviceStatus,
          stillnessSeconds,
          currentTier,
          isSnoozed,
          motionDetected,
        },
      });
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (movementBurstTimeoutRef.current) {
        window.clearTimeout(movementBurstTimeoutRef.current);
      }
    };
  }, []);

  const getDeviceId = useCallback(
    () => stateRef.current.lastTelemetry?.device_id ?? DEFAULT_DEVICE_ID,
    []
  );

  const acknowledge = useCallback(() => {
    const tier = stateRef.current.activeTier;
    if (tier > 0) {
      dispatch({ type: 'ACK', payload: { tier } });
      const deviceId = getDeviceId();
      void acknowledgeTier(deviceId, tier).catch((error) => {
        console.error('[controller] Failed to notify backend of acknowledgement', error);
      });
    }
  }, [getDeviceId]);

  const snooze = useCallback((minutes: number) => {
    const now = Date.now();
    const until = now + minutes * 60 * 1000;
    dispatch({ type: 'SNOOZE', payload: { until } });
  }, []);

  const resetStillness = useCallback(() => {
    const now = Date.now();
    lastMovementAtRef.current = now;
    quietUntilRef.current = now + QUIET_DEBOUNCE_MS;
    movementStreakRef.current = 0;
    dispatch({ type: 'RESET', payload: { now } });
  }, []);

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  const setVolume = useCallback((value: number) => {
    dispatch({ type: 'SET_VOLUME', payload: value });
  }, []);

  const toggleSleep = useCallback(() => {
    const next = !sleepRef.current;
    sleepRef.current = next;
    dispatch({ type: 'SET_SLEEP', payload: next });
    const deviceId = getDeviceId();
    void sendSleepState(deviceId, next).catch((error) => {
      console.error('[controller] Failed to update sleep state', error);
    });
    if (!next) {
      const now = Date.now();
      lastMovementAtRef.current = now;
      quietUntilRef.current = now + QUIET_DEBOUNCE_MS;
      movementStreakRef.current = 0;
    }
  }, [getDeviceId]);

  const togglePower = useCallback(() => {
    const next = switchStateRef.current === 'on' ? 'off' : 'on';
    switchStateRef.current = next;
    dispatch({ type: 'SET_SWITCH', payload: next });
    const deviceId = getDeviceId();
    void sendPowerState(deviceId, next).catch((error) => {
      console.error('[controller] Failed to update power state', error);
    });
    if (next === 'on') {
      const now = Date.now();
      lastMovementAtRef.current = now;
      quietUntilRef.current = now + QUIET_DEBOUNCE_MS;
      movementStreakRef.current = 0;
    }
  }, [getDeviceId]);

  const setManualPanelOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_MANUAL_PANEL', payload: open });
  }, []);

  const setTargetTemperature = useCallback((value: number) => {
    targetTempRef.current = value;
  }, []);

  const setMovementMode = useCallback((mode: MovementMode) => {
    movementModeRef.current = mode;
  }, []);

  const simulateMovementBurst = useCallback(() => {
    setMovementMode('moving');
    if (movementBurstTimeoutRef.current) {
      window.clearTimeout(movementBurstTimeoutRef.current);
    }
    movementBurstTimeoutRef.current = window.setTimeout(() => {
      movementModeRef.current = 'still';
      movementBurstTimeoutRef.current = null;
    }, 10000);
  }, [setMovementMode]);

  const simulateDisconnect = useCallback((seconds: number) => {
    const now = Date.now();
    disconnectUntilRef.current = now + seconds * 1000;
    if (seconds <= 0) return;
    lastFrameAtRef.current = now - (DISCONNECT_THRESHOLD_MS + 1000);
  }, []);


  const setStillnessSeconds = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.round(seconds));
    const now = Date.now();
    lastMovementAtRef.current = now - clamped * 1000;
    quietUntilRef.current = now - 1;
    movementStreakRef.current = 0;
    dispatch({
      type: 'SET_STILLNESS',
      payload: { seconds: clamped, now },
    });
    disconnectUntilRef.current = 0;
  }, []);

  const sendManualSample = useCallback(
    (input: ManualSampleInput) => {
      const now = Date.now();
      targetTempRef.current = input.temperature;
      movementModeRef.current = input.movementMode;
      switchStateRef.current = input.switchState;
      sleepRef.current = input.sleep;

      const sample =
        input.movementMode === 'moving'
          ? createMovementSample(now, input.switchState, input.sleep, input.temperature)
          : createBaselineSample(now, input.switchState, input.sleep, input.temperature);

      processTelemetry(sample);
    },
    [processTelemetry]
  );

  return {
    state: {
      ...state,
    },
    acknowledge,
    snooze,
    resetStillness,
    toggleMute,
    setVolume,
    toggleSleep,
    togglePower,
    setManualPanelOpen,
    setTargetTemperature,
    setMovementMode,
    setStillnessSeconds,
    simulateMovementBurst,
    simulateDisconnect,
    sendManualSample,
  };
}


