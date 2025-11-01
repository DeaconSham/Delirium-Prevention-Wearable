import { useEffect, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { StillnessCard } from './components/StillnessCard';
import { TemperatureCard } from './components/TemperatureCard';
import { ActivityCard } from './components/ActivityCard';
import { ManualPanel } from './components/ManualPanel';
import { Footer } from './components/Footer';
import { AudioEngine } from './components/AudioEngine';
import { useTelemetryController } from './hooks/useTelemetryController';
import { formatDuration } from './utils';

const DEFAULT_TARGET_TEMP = 36.7;

function App() {
  const {
    state,
    acknowledge,
    snooze,
    resetStillness,
    toggleMute,
    setVolume,
    toggleSleep,
    togglePower,
    setManualPanelOpen,
    setMovementMode: setMovementModeAction,
    setStillnessSeconds,
    setTargetTemperature,
    simulateMovementBurst,
    simulateDisconnect,
    sendManualSample,
  } = useTelemetryController();

  const [targetTemp, setTargetTemp] = useState(DEFAULT_TARGET_TEMP);
  const [movementMode, setMovementMode] = useState<'still' | 'moving'>('still');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault();
          acknowledge();
          break;
        case 's':
          event.preventDefault();
          snooze(10);
          break;
        case 'r':
          event.preventDefault();
          resetStillness();
          break;
        case 'm':
          event.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [acknowledge, snooze, resetStillness, toggleMute]);

  const snoozeUntil =
    state.snoozeUntil && state.snoozeUntil > state.now ? state.snoozeUntil : null;

  const acked =
    state.activeTier > 0 && state.acknowledgedTier >= state.activeTier;

  const connectionBanner =
    !state.connected && state.deviceStatus === 'disconnected' ? (
      <div className="banner warning" role="alert">
        Connection lost for more than {formatDuration(5)}. Alerts stopped until telemetry resumes.
      </div>
    ) : null;

  const openMovementGraph = () => {
    const entries = state.activityHistory.slice(-30);
    const graphWindow = window.open('', '_blank', 'width=720,height=420');
    if (!graphWindow) {
      window.alert('Please allow pop-ups to open the movement graph.');
      return;
    }
    const doc = graphWindow.document;
    const bars =
      entries.length > 0
        ? entries
            .map((sample) => {
              const label = new Date(sample.ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const height = sample.movement ? 100 : 12;
              const statusText = sample.movement ? 'Movement' : 'Still';
              return `<div class="bar ${
                sample.movement ? 'active' : ''
              }" style="height:${height}%">
                  <span class="bar-status">${statusText}</span>
                  <span class="bar-label">${label}</span>
                </div>`;
            })
            .join('')
        : '<p class="empty">No activity samples yet. Keep the monitor running to build a timeline.</p>';

    doc.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Movement Activity Graph</title>
          <style>
            body {
              margin: 0;
              padding: 1.5rem;
              background: #0f172a;
              color: #f8fafc;
              font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
            }
            h1 {
              margin: 0 0 1rem;
              font-size: 1.5rem;
              font-weight: 600;
            }
            p.meta {
              margin: 0 0 1.5rem;
              color: #94a3b8;
            }
            .chart {
              display: flex;
              align-items: flex-end;
              gap: 0.75rem;
              width: 100%;
              min-height: 240px;
              padding: 1.5rem;
              border-radius: 1rem;
              border: 1px solid rgba(148, 163, 184, 0.3);
              background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
              box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
            }
            .bar {
              flex: 1;
              position: relative;
              border-radius: 0.75rem 0.75rem 0.5rem 0.5rem;
              background: rgba(148, 163, 184, 0.2);
              display: flex;
              align-items: flex-end;
              justify-content: center;
              transition: transform 0.2s ease;
              min-height: 12%;
            }
            .bar.active {
              background: linear-gradient(180deg, rgba(34, 197, 94, 0.85), rgba(21, 128, 61, 0.9));
            }
            .bar-status {
              position: absolute;
              top: -1.5rem;
              font-size: 0.75rem;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              color: rgba(148, 163, 184, 0.9);
            }
            .bar.active .bar-status {
              color: rgba(34, 197, 94, 0.92);
            }
            .bar-label {
              margin-top: 0.75rem;
              font-size: 0.8rem;
              color: rgba(148, 163, 184, 0.9);
            }
            .empty {
              margin: 0;
              font-size: 1rem;
              color: rgba(148, 163, 184, 0.9);
            }
          </style>
        </head>
        <body>
          <h1>Movement Activity</h1>
          <p class="meta">Showing the most recent ${
            entries.length
          } minutes of movement samples.</p>
          <div class="chart">${bars}</div>
        </body>
      </html>`);
    doc.close();
    graphWindow.focus();
  };

  return (
    <div className="app-shell">
      {connectionBanner}
      <Header
        deviceStatus={state.deviceStatus}
        connected={state.connected}
        switchState={state.switchState}
        sleep={state.sleep}
        lastUpdate={state.lastUpdate}
        muted={state.muted}
        volume={state.volume}
        onTogglePower={togglePower}
        onToggleSleep={toggleSleep}
        onToggleMute={toggleMute}
        onVolumeChange={setVolume}
      />
      <main className="main-grid">
        <StillnessCard
          stillnessSeconds={state.stillnessSeconds}
          activeTier={state.activeTier}
          currentTier={state.currentTier}
          acknowledgedTier={state.acknowledgedTier}
          isSnoozed={state.isSnoozed}
          snoozeUntil={snoozeUntil}
          deviceStatus={state.deviceStatus}
          motionDetected={state.motionDetected}
          onReset={resetStillness}
          onAcknowledge={acknowledge}
          onSnooze={snooze}
        />
        <TemperatureCard
          tempC={state.tempC}
          status={state.tempStatus}
          history={state.temperatureHistory}
        />
        <ActivityCard
          history={state.activityHistory}
          onOpenGraph={openMovementGraph}
        />
      </main>
      <Footer
        connected={state.connected}
        deviceStatus={state.deviceStatus}
        lastUpdate={state.lastUpdate}
        manualPanelOpen={state.manualPanelOpen}
        onToggleManual={() =>
          setManualPanelOpen(!state.manualPanelOpen)
        }
      />
      <ManualPanel
        open={state.manualPanelOpen}
        onClose={() => setManualPanelOpen(false)}
        currentTemp={targetTemp}
        currentStillnessSeconds={state.stillnessSeconds}
        switchState={state.switchState}
        sleep={state.sleep}
        movementMode={movementMode}
        onSendSample={(input) => {
          setTargetTemp(input.temperature);
          setMovementMode(input.movementMode);
          sendManualSample(input);
        }}
        onMovementModeChange={(mode) => {
          setMovementMode(mode);
          setMovementModeAction(mode);
        }}
        onSetTargetTemp={(value) => {
          setTargetTemp(value);
          setTargetTemperature(value);
        }}
        onSetStillnessSeconds={setStillnessSeconds}
        onSimulateMovementBurst={simulateMovementBurst}
        onSimulateDisconnect={simulateDisconnect}
      />
      <AudioEngine
        tier={state.activeTier}
        acknowledgedTier={state.acknowledgedTier}
        muted={state.muted}
        volume={state.volume}
      />
      <div className="sr-only" aria-live="assertive">
        {state.activeTier > state.acknowledgedTier && !acked
          ? `Alert tier ${state.activeTier}`
          : ''}
      </div>
    </div>
  );
}

export default App;
