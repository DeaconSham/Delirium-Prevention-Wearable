import { useEffect, useState } from 'react';
import type { SwitchState } from '../types';

interface ManualPanelProps {
  open: boolean;
  onClose: () => void;
  currentTemp: number;
  currentStillnessSeconds: number;
  switchState: SwitchState;
  sleep: boolean;
  movementMode: 'still' | 'moving';
  onSendSample: (input: {
    temperature: number;
    switchState: SwitchState;
    sleep: boolean;
    movementMode: 'still' | 'moving';
  }) => void;
  onMovementModeChange: (mode: 'still' | 'moving') => void;
  onSetTargetTemp: (value: number) => void;
  onSetStillnessSeconds: (seconds: number) => void;
  onSimulateMovementBurst: () => void;
  onSimulateDisconnect: (seconds: number) => void;
}

export function ManualPanel(props: ManualPanelProps) {
  const {
    open,
    onClose,
    currentTemp,
    currentStillnessSeconds,
    switchState,
    sleep,
    movementMode,
    onSendSample,
    onMovementModeChange,
    onSetTargetTemp,
    onSetStillnessSeconds,
    onSimulateMovementBurst,
    onSimulateDisconnect,
  } = props;

  const [temp, setTemp] = useState(currentTemp);
  const [switchValue, setSwitchValue] = useState<SwitchState>(switchState);
  const [sleepValue, setSleepValue] = useState<boolean>(sleep);
  const [movementValue, setMovementValue] = useState<'still' | 'moving'>(
    movementMode
  );
  const [stillnessMinutes, setStillnessMinutes] = useState<number>(
    Math.round(currentStillnessSeconds / 60)
  );

  useEffect(() => {
    setTemp(currentTemp);
  }, [currentTemp]);

  useEffect(() => {
    setSwitchValue(switchState);
  }, [switchState]);

  useEffect(() => {
    setSleepValue(sleep);
  }, [sleep]);

  useEffect(() => {
    setMovementValue(movementMode);
  }, [movementMode]);

  useEffect(() => {
    setStillnessMinutes(Math.round(currentStillnessSeconds / 60));
  }, [currentStillnessSeconds]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const tempC = Number(temp);

    onSetTargetTemp(tempC);
    onMovementModeChange(movementValue);
    onSendSample({
      temperature: tempC,
      switchState: switchValue,
      sleep: sleepValue,
      movementMode: movementValue,
    });
  };

  const applyStillness = (minutes: number) => {
    const sanitized = Math.max(0, Math.round(minutes));
    setStillnessMinutes(sanitized);
    onSetStillnessSeconds(sanitized * 60);
  };

  const handleApplyStillness = () => {
    applyStillness(stillnessMinutes);
  };

  return (
    <section className="card manual-panel" aria-label="Manual telemetry tester">
      <header className="card-header">
        <div>
          <h2>Manual Telemetry Tester</h2>
          <p className="card-subtitle">
            Adjust values and send a sample to the UI. The mock device continues
            to stream every second.
          </p>
        </div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </header>
      <form className="manual-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Temperature (°C)</span>
          <input
            type="number"
            min={32}
            max={40}
            step={0.1}
            value={temp}
            onChange={(event) => setTemp(Number(event.target.value))}
          />
        </label>
        <div className="field">
          <span>Stillness Timer (minutes)</span>
          <input
            type="number"
            min={0}
            max={240}
            step={1}
            value={stillnessMinutes}
            onChange={(event) => setStillnessMinutes(Number(event.target.value))}
          />
          <div className="field-actions">
            <button
              type="button"
              className="btn"
              onClick={handleApplyStillness}
            >
              Apply Timer
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => applyStillness(45)}
            >
              Jump to 45m
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => applyStillness(60)}
            >
              Jump to 60m
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => applyStillness(65)}
            >
              Jump to 65m
            </button>
          </div>
        </div>
        <fieldset className="field">
          <legend>Movement</legend>
          <label>
            <input
              type="radio"
              name="movement"
              value="still"
              checked={movementValue === 'still'}
              onChange={() => setMovementValue('still')}
            />
            Still
          </label>
          <label>
            <input
              type="radio"
              name="movement"
              value="moving"
              checked={movementValue === 'moving'}
              onChange={() => setMovementValue('moving')}
            />
            Moving
          </label>
        </fieldset>
        <fieldset className="field">
          <legend>Power switch</legend>
          <label>
            <input
              type="radio"
              name="switch"
              value="on"
              checked={switchValue === 'on'}
              onChange={() => setSwitchValue('on')}
            />
            On
          </label>
          <label>
            <input
              type="radio"
              name="switch"
              value="off"
              checked={switchValue === 'off'}
              onChange={() => setSwitchValue('off')}
            />
            Off
          </label>
        </fieldset>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={sleepValue}
            onChange={() => setSleepValue((prev) => !prev)}
          />
          Sleep mode
        </label>
        <div className="manual-actions">
          <button type="submit" className="btn primary">
            Send Sample
          </button>
          <button
            type="button"
            className="btn"
            onClick={onSimulateMovementBurst}
          >
            Movement Burst (10s)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onSimulateDisconnect(8)}
          >
            Disconnect 8s
          </button>
        </div>
      </form>
      <p className="manual-hint">
        Tip: Use keyboard shortcuts R (Reset), A (Acknowledge), S (Snooze) and M
        (mute toggle) while testing.
      </p>
    </section>
  );
}



