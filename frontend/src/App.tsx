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
  MaxSecondsUpdate,
} from './types';

function App() {
  // Connection state
  const [connected, setConnected] = useState(false);

  // Device state
  const [deviceState, setDeviceState] = useState<DeviceState>('sleeping');
  const [patientId, setPatientId] = useState('test');
  const [maxSeconds, setMaxSeconds] = useState(300);

  // Activity monitoring state
  const [activity, setActivity] = useState<Activity>('...');
  const [seconds, setSeconds] = useState(300);
  const [alert, setAlert] = useState(false);
  const [warning, setWarning] = useState('');

  // Sleep monitoring state
  const [tempStats, setTempStats] = useState<SensorStats | null>(null);
  const [sleepDuration, setSleepDuration] = useState(0);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingActivity, setRecordingActivity] = useState('');
  const [liveDataCount, setLiveDataCount] = useState(0);

  // Training state
  const [trainingMessages, setTrainingMessages] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  // Max seconds input
  const [maxSecondsInput, setMaxSecondsInput] = useState('300');

  // Tab state
  const [activeTab, setActiveTab] = useState<'monitor' | 'training'>('monitor');

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
        setSeconds(data.seconds);
        if (data.activity) setActivity(data.activity as Activity);
        setPatientId(data.patient);
        setMaxSeconds(data.maxSeconds);
        setMaxSecondsInput(data.maxSeconds.toString());
      },
      onActivityUpdate: (data: ActivityUpdate) => {
        console.log('Activity update:', data);
        setActivity(data.activity);
        setSeconds(data.seconds);
        setAlert(data.seconds === 0);
        setWarning(data.warning || '');
      },
      onSleepDataUpdate: (data: SleepDataUpdate) => {
        console.log('Sleep data update:', data);
        setTempStats(data.temp);
        setSleepDuration(data.sleepDuration);
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
      onMaxSecondsUpdate: (data: MaxSecondsUpdate) => {
        console.log('Max seconds update:', data);
        setMaxSeconds(data.maxSeconds);
        setMaxSecondsInput(data.maxSeconds.toString());
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

  const handleMaxSecondsChange = () => {
    const value = parseInt(maxSecondsInput, 10);
    if (!isNaN(value) && value > 0) {
      socketService.setMaxSeconds(value);
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

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          📊 Monitor
        </button>
        <button
          className={`tab-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          🤖 Training & Data
        </button>
      </div>

      <main className="app-main">
        {activeTab === 'monitor' ? (
          <>
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
                  <h3>Max Activity Time (seconds)</h3>
                  <div className="threshold-control">
                    <input
                      type="number"
                      value={maxSecondsInput}
                      onChange={(e) => setMaxSecondsInput(e.target.value)}
                      min="1"
                      disabled={!connected}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={handleMaxSecondsChange}
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
                seconds={seconds}
                maxSeconds={maxSeconds}
                alert={alert}
                warning={warning}
              />
            ) : (
              <SleepMonitor
                temp={tempStats}
                sleepDuration={sleepDuration}
              />
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Delirium Prevention Wearable System - ECE 198 Project</p>
      </footer>
    </div>
  );
}

export default App;
