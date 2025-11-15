// Device state types
export type DeviceState = 'active' | 'sleeping';
export type Activity = 'sitting' | 'walking' | '...';

// Sensor statistics (for sleep mode)
export interface SensorStats {
  avg: number;
  min: number;
  max: number;
  last: number;
}

// State update event from backend
export interface StateUpdate {
  state: DeviceState;
  meter: number;
  activity?: string;
  patient: string;
  threshold: number;
}

// Activity update event from backend
export interface ActivityUpdate {
  activity: Activity;
  meter: number;
}

// Sleep data update event from backend
export interface SleepDataUpdate {
  temp: SensorStats;
  light: SensorStats;
  sound: SensorStats;
}

// Recording status event from backend
export interface RecordingStatus {
  recording: boolean;
  activity?: string;
}

// Training status event from backend
export interface TrainingStatus {
  message: string;
}

// Status update event from backend
export interface StatusUpdate {
  alert: 'inactive';
}

// Threshold update event from backend
export interface ThresholdUpdate {
  threshold: number;
}

// Live data event from backend
export interface LiveDataEvent {
  data: string;
}
