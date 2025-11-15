# Delirium Prevention Wearable System

## Overview

This is a complete delirium prevention monitoring system that consists of:
- **Arduino Firmware**: Collects sensor data from accelerometer, temperature, light, and sound sensors
- **Python Backend**: Processes sensor data, runs ML model for activity recognition, and communicates with frontend
- **React Frontend**: Web interface for monitoring, data recording, and ML model training

## System Architecture

```
Arduino (Sensors) --[Serial]--> Python Backend --[SocketIO]--> React Frontend
                                      |
                                   ML Model
                                (Activity Recognition)
```

## Components

### 1. Arduino Firmware (`arduino_firmware/`)

**File**: `Delirium_Monitor_Firmware.ino`

**Sensors**:
- A0: Temperature (Thermistor)
- A1: Light sensor
- A2: Sound/Audio sensor
- A3-A5: Accelerometer (X, Y, Z axes)
- I2C: RGB LCD Display (16x2)

**Data Format**: `T:temp,X:x_val,Y:y_val,Z:z_val,L:light,S:sound`

**Features**:
- Sends sensor data at 10Hz over serial (9600 baud)
- Receives commands to control LCD display and RGB backlight
- Temperature calculated using Steinhart-Hart equation

### 2. Python Backend (`backend/`)

**Main File**: `main.py`

**Features**:
- Flask-SocketIO server for real-time communication
- Serial communication with Arduino
- PyTorch-based 1D-CNN for human activity recognition
- Two operational modes:
  - **Active Mode**: Monitors activity, detects inactivity
  - **Sleep Mode**: Monitors environmental conditions
- Training data recording and ML model training
- Real-time inference on sensor data

**Dependencies**:
```bash
pip install flask flask-socketio eventlet pyserial torch numpy scikit-learn joblib
```

**Configuration**:
- Edit `shared_config.py` to set the correct serial port:
  ```python
  SERIAL_PORT = '/dev/tty.usbmodem1101'  # Change this to your port
  ```

### 3. React Frontend (`frontend/`)

**Features**:
- Real-time SocketIO connection to backend
- Activity monitoring dashboard (active mode)
- Sleep environment monitoring (sleep mode)
- Training data recorder
- ML model trainer interface
- Responsive design with modern UI

**Components**:
- `ActivityMonitor`: Shows detected activity and inactivity meter
- `SleepMonitor`: Displays temperature, light, and sound statistics
- `DataRecorder`: Interface for recording training data
- `ModelTrainer`: Interface for training ML models

## Getting Started

### 1. Upload Arduino Firmware

1. Open `arduino_firmware/Delirium_Monitor_Firmware.ino` in Arduino IDE
2. Connect your Arduino R4 Minima
3. Select the correct board and port
4. Upload the firmware

### 2. Start the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Update the serial port in `shared_config.py` to match your system

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the backend:
   ```bash
   python main.py
   ```

   The backend will start on http://127.0.0.1:5000

### 3. Start the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to http://localhost:5173

## Usage Workflow

### Training a New Model

1. **Record Training Data**:
   - Enter a patient ID (e.g., "patient1")
   - Select activity: sitting, walking, or waving
   - Click "Start Recording"
   - Perform the activity for 30+ seconds
   - Click "Stop Recording"
   - Repeat for all three activities

2. **Train the Model**:
   - Click "Train Model" button
   - Wait for training to complete (20 epochs)
   - Model will be saved as `{patient_id}_model.pth`

### Monitoring

1. **Active Mode**:
   - Switch to "Active Mode"
   - Monitor detected activity
   - Watch the inactivity meter
   - When meter reaches 0, an alert is triggered

2. **Sleep Mode**:
   - Switch to "Sleep Mode"
   - Monitor temperature, light, and sound levels
   - View real-time statistics (min, max, avg, last)

3. **Adjust Settings**:
   - Change inactivity threshold (default: 100)
   - Higher threshold = longer time before alert

## Machine Learning Model

**Architecture**: 1D Convolutional Neural Network (CNN)

**Input**: 20 timesteps × 3 channels (X, Y, Z acceleration)

**Output**: 3 classes (sitting, walking, waving)

**Layers**:
- Conv1d(3→32, kernel=3) → ReLU → MaxPool(2)
- Conv1d(32→64, kernel=3) → ReLU → MaxPool(2)
- AdaptiveAvgPool1d(1) → Flatten
- Linear(64→3)

**Training**:
- Window size: 20 samples
- Step size: 10 samples (50% overlap)
- Optimizer: Adam (lr=0.001)
- Epochs: 20
- Batch size: 16

## Data Format

### Serial Communication (Arduino → Backend)

Format: `T:25.1,X:2048,Y:2050,Z:2046,L:512,S:123`

Fields:
- `T`: Temperature (°C)
- `X`, `Y`, `Z`: Accelerometer readings (0-4095)
- `L`: Light level (0-4095)
- `S`: Sound level (0-4095)

### SocketIO Events (Backend ↔ Frontend)

**Client → Server**:
- `set_state`: Switch between active/sleeping modes
- `set_inactivity_threshold`: Update threshold value
- `start_recording`: Begin recording training data
- `stop_recording`: Stop recording
- `train_model`: Train ML model on recorded data

**Server → Client**:
- `state_update`: Device state and configuration
- `activity_update`: Current activity and meter value
- `sleep_data_update`: Environmental sensor statistics
- `recording_status`: Recording state
- `training_status`: Training progress messages
- `status_update`: Alert notifications

## Troubleshooting

### Arduino Connection Issues

- Check the serial port in `shared_config.py`
- Ensure Arduino is connected and drivers are installed
- Verify baud rate is 9600

### Frontend Connection Issues

- Ensure backend is running on port 5000
- Check browser console for errors
- Verify CORS is enabled in backend

### Model Training Fails

- Ensure all three activity CSVs exist
- Each file should have at least 30-60 seconds of data
- Check console output for specific error messages

## Hardware Requirements

- Arduino R4 Minima
- 16x2 RGB LCD Display (I2C)
- Thermistor (for temperature)
- Light sensor (analog)
- Sound sensor (analog)
- 3-axis accelerometer (analog)

## Software Requirements

- Arduino IDE (for firmware upload)
- Python 3.8+ (for backend)
- Node.js 16+ (for frontend)
- Modern web browser

## Project Structure

```
ECE 198 - frontend/
├── arduino_firmware/
│   └── Delirium_Monitor_Firmware.ino
├── backend/
│   ├── main.py
│   ├── train_model.py
│   ├── shared_config.py
│   ├── test_model.pth
│   └── test_scaler.joblib
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── App.css
    │   ├── types.ts
    │   ├── services/
    │   │   └── socketService.ts
    │   └── components/
    │       ├── ActivityMonitor.tsx
    │       ├── SleepMonitor.tsx
    │       ├── DataRecorder.tsx
    │       └── ModelTrainer.tsx
    ├── package.json
    └── vite.config.ts
```

## License

ECE 198 Project - Delirium Prevention Wearable System

## Contributors

Built with Arduino, Python (Flask, PyTorch), and React (TypeScript)
