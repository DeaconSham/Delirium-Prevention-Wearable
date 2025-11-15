import { useState, useEffect } from 'react';
import './App.css';
import { socketService } from './services/socketService';
import { ActivityMonitor } from './components/ActivityMonitor';
import { SleepMonitor } from './components/SleepMonitor';
import { DataRecorder } from './components/DataRecorder';
import { ModelTrainer } from './components/ModelTrainer';
import type {
  DeviceState,
  Activity,
  SensorStats,
  StateUpdate,
  ActivityUpdate,
  SleepDataUpdate,
  RecordingStatus,
  TrainingStatus,
  StatusUpdate,
  ThresholdUpdate,
} from './types';

function App() {
  // Connection state
  const [connected, setConnected] = useState(false);

  // Device state
  const [deviceState, setDeviceState] = useState<DeviceState>('sleeping');
  const [patientId, setPatientId] = useState('test');
  const [threshold, setThreshold] = useState(100);

  // Activity monitoring state
  const [activity, setActivity] = useState<Activity>('...');
  const [meter, setMeter] = useState(100);
  const [alert, setAlert] = useState(false);

  // Sleep monitoring state
  const [tempStats, setTempStats] = useState<SensorStats | null>(null);
  const [lightStats, setLightStats] = useState<SensorStats | null>(null);
  const [soundStats, setSoundStats] = useState<SensorStats | null>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingActivity, setRecordingActivity] = useState('');
  const [liveDataCount, setLiveDataCount] = useState(0);

  // Training state
  const [trainingMessages, setTrainingMessages] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  // Threshold input
  const [thresholdInput, setThresholdInput] = useState('100');

  useEffect(() => {
    socketService.connect({
      onConnect: () => {
        console.log('Connected to backend');
        setConnected(true);
      },
      onDisconnect: () => {
        console.log('Disconnected from backend');
        setConnected(false);
      },
      onStateUpdate: (data: StateUpdate) => {
        console.log('State update:', data);
        setDeviceState(data.state);
        setMeter(data.meter);
        if (data.activity) setActivity(data.activity as Activity);
        setPatientId(data.patient);
        setThreshold(data.threshold);
        setThresholdInput(data.threshold.toString());
      },
      onActivityUpdate: (data: ActivityUpdate) => {
        console.log('Activity update:', data);
        setActivity(data.activity);
        setMeter(data.meter);
        setAlert(data.meter === 0);
      },
      onSleepDataUpdate: (data: SleepDataUpdate) => {
        console.log('Sleep data update:', data);
        setTempStats(data.temp);
        setLightStats(data.light);
        setSoundStats(data.sound);
      },
      onRecordingStatus: (data: RecordingStatus) => {
        console.log('Recording status:', data);
        setRecording(data.recording);
        if (data.activity) {
          setRecordingActivity(data.activity);
        }
        if (!data.recording) {
          setLiveDataCount(0);
        }
      },
      onTrainingStatus: (data: TrainingStatus) => {
        console.log('Training status:', data);
        setTrainingMessages((prev) => [...prev, data.message]);

        // Check if training is complete or failed
        if (data.message.includes('Done!') || data.message.includes('failed')) {
          setIsTraining(false);
        }
      },
      onStatusUpdate: (data: StatusUpdate) => {
        console.log('Status update:', data);
        if (data.alert === 'inactive') {
          setAlert(true);
        }
      },
      onThresholdUpdate: (data: ThresholdUpdate) => {
        console.log('Threshold update:', data);
        setThreshold(data.threshold);
        setThresholdInput(data.threshold.toString());
      },
      onLiveData: () => {
        setLiveDataCount((prev) => prev + 1);
      },
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleStateChange = (newState: DeviceState) => {
    socketService.setState(newState);
    setDeviceState(newState);
    setAlert(false);
  };

  const handleThresholdChange = () => {
    const value = parseInt(thresholdInput, 10);
    if (!isNaN(value) && value > 0) {
      socketService.setInactivityThreshold(value);
    }
  };

  const handleStartRecording = (pid: string, act: string) => {
    socketService.startRecording(pid, act);
  };

  const handleStopRecording = () => {
    socketService.stopRecording();
  };

  const handleTrainModel = (pid: string) => {
    setTrainingMessages([]);
    setIsTraining(true);
    socketService.trainModel(pid);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Delirium Prevention Monitor</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <main className="app-main">
        {/* Control Panel */}
        <div className="card control-panel">
          <h2>Control Panel</h2>

          <div className="control-section">
            <h3>Device Mode</h3>
            <div className="button-group">
              <button
                className={`btn ${deviceState === 'active' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => handleStateChange('active')}
                disabled={!connected || recording}
              >
                🏃 Active Mode
              </button>
              <button
                className={`btn ${deviceState === 'sleeping' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => handleStateChange('sleeping')}
                disabled={!connected || recording}
              >
                😴 Sleep Mode
              </button>
            </div>
          </div>

          <div className="control-section">
            <h3>Patient ID</h3>
            <div className="patient-info">
              Current: <strong>{patientId}</strong>
            </div>
          </div>

          {deviceState === 'active' && (
            <div className="control-section">
              <h3>Inactivity Threshold</h3>
              <div className="threshold-control">
                <input
                  type="number"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  min="1"
                  disabled={!connected}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleThresholdChange}
                  disabled={!connected}
                >
                  Update
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Activity or Sleep Monitor */}
        {deviceState === 'active' ? (
          <ActivityMonitor
            activity={activity}
            meter={meter}
            threshold={threshold}
            alert={alert}
          />
        ) : (
          <SleepMonitor
            temp={tempStats}
            light={lightStats}
            sound={soundStats}
          />
        )}

        {/* Data Recorder */}
        <DataRecorder
          recording={recording}
          currentActivity={recordingActivity}
          patientId={patientId}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onPatientIdChange={setPatientId}
          liveDataCount={liveDataCount}
        />

        {/* Model Trainer */}
        <ModelTrainer
          patientId={patientId}
          trainingMessages={trainingMessages}
          onTrainModel={handleTrainModel}
          isTraining={isTraining}
        />
      </main>

      <footer className="app-footer">
        <p>Delirium Prevention Wearable System - ECE 198 Project</p>
      </footer>
    </div>
  );
}

export default App;
