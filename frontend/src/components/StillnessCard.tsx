import type { AlertTier, DeviceStatus } from '../types';
import { formatDuration, formatTime } from '../utils';

interface StillnessCardProps {
  stillnessSeconds: number;
  activeTier: AlertTier;
  currentTier: AlertTier;
  acknowledgedTier: AlertTier;
  isSnoozed: boolean;
  snoozeUntil: number | null;
  deviceStatus: DeviceStatus;
  motionDetected: boolean;
  onReset: () => void;
  onAcknowledge: () => void;
  onSnooze: (minutes: number) => void;
}

const tierLabels: Record<AlertTier, string> = {
  0: 'Monitoring',
  1: 'Tier 1 · Early Notice',
  2: 'Tier 2 · Escalate Soon',
  3: 'Tier 3 · Immediate Attention',
};

const tierDescriptions: Record<AlertTier, string> = {
  0: 'No alerts. Movement will reset the timer.',
  1: 'Patient still for 45 minutes.',
  2: 'Patient still for 60 minutes.',
  3: 'Patient still for 65 minutes.',
};

export function StillnessCard(props: StillnessCardProps) {
  const {
    stillnessSeconds,
    activeTier,
    currentTier,
    acknowledgedTier,
    isSnoozed,
    snoozeUntil,
    deviceStatus,
    motionDetected,
    onReset,
    onAcknowledge,
    onSnooze,
  } = props;

  const acknowledged = activeTier > 0 && acknowledgedTier >= activeTier;

  const snoozeLabel =
    snoozeUntil && snoozeUntil > Date.now()
      ? `Snoozed until ${formatTime(snoozeUntil)}`
      : null;

  let statusMessage = tierDescriptions[activeTier];
  if (isSnoozed) {
    statusMessage = 'Alerts paused during snooze.';
  } else if (deviceStatus !== 'on') {
    statusMessage = `Alerts paused while device is ${deviceStatus}.`;
  } else if (acknowledged) {
    statusMessage = 'Acknowledged. Monitoring for next tier.';
  }

  return (
    <section
      className={`card stillness-card tier-${activeTier}`}
      aria-label="Stillness monitor"
    >
      <header className="card-header">
        <div>
          <h2>Stillness</h2>
          <p className="card-subtitle">{tierLabels[activeTier]}</p>
        </div>
        <div className="tier-indicator">
          <span className="tier-pill">{formatDuration(stillnessSeconds)}</span>
          <span className={`motion-dot ${motionDetected ? 'active' : ''}`}>
            {motionDetected ? 'Movement detected' : 'Quiet'}
          </span>
        </div>
      </header>
      <div className="timer-display" aria-live="polite">
        {formatTimer(stillnessSeconds)}
      </div>
      <p className="status-copy">{statusMessage}</p>
      {snoozeLabel ? <p className="status-copy snooze-copy">{snoozeLabel}</p> : null}
      {currentTier > activeTier && deviceStatus === 'on' && !isSnoozed ? (
        <p className="status-copy muted">
          Upcoming tier: {tierLabels[currentTier]}
        </p>
      ) : null}
      <div className="button-row">
        <button className="btn" onClick={onReset} accessKey="r">
          Reset (R)
        </button>
        <button
          className="btn"
          onClick={() => onSnooze(10)}
          disabled={deviceStatus !== 'on'}
          accessKey="s"
        >
          Snooze 10m (S)
        </button>
        <button
          className="btn"
          onClick={() => onSnooze(20)}
          disabled={deviceStatus !== 'on'}
        >
          Snooze 20m
        </button>
        <button
          className="btn primary"
          onClick={onAcknowledge}
          disabled={activeTier === 0 || acknowledged}
          accessKey="a"
        >
          Acknowledge (A)
        </button>
      </div>
    </section>
  );
}

function formatTimer(seconds: number): string {
  const total = Math.max(0, seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
