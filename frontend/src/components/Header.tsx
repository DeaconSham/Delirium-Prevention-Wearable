import type { DeviceStatus, SwitchState } from '../types';
import { formatTime } from '../utils';

interface HeaderProps {
  deviceStatus: DeviceStatus;
  connected: boolean;
  switchState: SwitchState;
  sleep: boolean;
  lastUpdate: number | null;
  muted: boolean;
  volume: number;
  onTogglePower: () => void;
  onToggleSleep: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
}

const statusPalette: Record<DeviceStatus, { label: string; color: string }> = {
  on: { label: 'Online', color: '#22c55e' },
  sleeping: { label: 'Sleeping', color: '#38bdf8' },
  off: { label: 'Device Off', color: '#f97316' },
  disconnected: { label: 'Disconnected', color: '#ef4444' },
};

export function Header(props: HeaderProps) {
  const {
    deviceStatus,
    connected,
    switchState,
    sleep,
    lastUpdate,
    muted,
    volume,
    onTogglePower,
    onToggleSleep,
    onToggleMute,
    onVolumeChange,
  } = props;

  const status = statusPalette[deviceStatus];
  return (
    <header className="app-header" aria-label="Delirium monitor header">
      <div className="header-left">
        <h1>Delirium Monitor</h1>
        <div className="status-row">
          <div className="status-pill" style={{ backgroundColor: status.color }}>
            {status.label}
          </div>
          <span className="status-text">
            {connected ? 'Signal active' : 'Awaiting telemetry'}
          </span>
          <span className="status-text">Last update: {formatTime(lastUpdate)}</span>
        </div>
      </div>
      <div className="header-controls">
        <div className="control-group">
          <span className="control-label">Power</span>
          <button
            className={`chip ${switchState === 'on' ? 'chip-active' : ''}`}
            onClick={onTogglePower}
            aria-pressed={switchState === 'on'}
          >
            {switchState === 'on' ? 'On' : 'Off'}
          </button>
        </div>
        <div className="control-group">
          <span className="control-label">Sleep</span>
          <button
            className={`chip ${sleep ? 'chip-active' : ''}`}
            onClick={onToggleSleep}
            aria-pressed={sleep}
          >
            {sleep ? 'Sleeping' : 'Awake'}
          </button>
        </div>
        <div className="control-group">
          <span className="control-label">Audio</span>
          <button
            className={`chip ${muted ? '' : 'chip-active'}`}
            onClick={onToggleMute}
            aria-pressed={!muted}
          >
            {muted ? 'Muted' : 'Audible'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            aria-label="Alert volume"
          />
        </div>
      </div>
    </header>
  );
}
