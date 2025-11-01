import type { DeviceStatus } from '../types';
import { formatTime } from '../utils';

interface FooterProps {
  connected: boolean;
  deviceStatus: DeviceStatus;
  lastUpdate: number | null;
  manualPanelOpen: boolean;
  onToggleManual: () => void;
}

export function Footer({
  connected,
  deviceStatus,
  lastUpdate,
  manualPanelOpen,
  onToggleManual,
}: FooterProps) {
  return (
    <footer className="app-footer">
      <span>
        Connection: {connected ? 'Active' : 'Inactive'} · Status: {deviceStatus}
      </span>
      <span>Last sample: {formatTime(lastUpdate)}</span>
      <button className="btn link" onClick={onToggleManual}>
        {manualPanelOpen ? 'Hide manual tester' : 'Show manual tester'}
      </button>
    </footer>
  );
}
