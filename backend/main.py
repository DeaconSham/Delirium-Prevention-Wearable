import serial
import time
import torch
import numpy as np
import joblib
from flask import Flask
from flask_socketio import SocketIO, emit
import eventlet
import os 

from train_model import HARModel, WINDOW_SIZE, STEP_SIZE, ACTIVITIES, NUM_CLASSES, parse_full_packet, train_model
from shared_config import SERIAL_PORT, BAUD_RATE

# --- Configuration ---
MAX_ACTIVITY_METER = 100 

# --- Define Our Colours ---
COLOUR_ACTIVE = "RGB:0,100,255\n"  # Blue
COLOUR_ALERT  = "RGB:255,0,0\n"    # Red
COLOUR_SLEEP  = "RGB:0,0,50\n"     # Dim Blue
COLOUR_RECORDING = "RGB:0,255,0\n" # Green

# --- Global Variables ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
ser = None 

# Application state
device_state = "sleeping" 
activity_meter = MAX_ACTIVITY_METER
current_activity = "..."
current_patient_id = "test" # Default patient is now "test"
model = None
scaler = None

temp_readings = []
light_readings = []
sound_readings = []

is_recording = False
current_recording_file = None

# --- Serial Communication Helpers ---
def send_serial_command(command_str):
    if ser and ser.is_open:
        try:
            print(f"Sending to Arduino: {command_str.strip()}")
            bytes_written = ser.write(command_str.encode('ascii'))
            print(f"  -> Wrote {bytes_written} bytes")
            ser.flush()  # Force immediate write without buffering
            print(f"  -> Flushed successfully")
        except serial.SerialTimeoutException:
            print(f"  -> ERROR: Write timeout - Arduino not responding")
        except Exception as e:
            print(f"  -> ERROR writing to serial: {e}")

def format_lcd(line1, line2=""):
    return f"L:{line1}|{line2}\n"

# --- ML Model Loader ---
def load_model(patient_id):
    """Loads a specific patient's model and scaler into memory."""
    global model, scaler, current_patient_id
    try:
        model_path = f'{patient_id}_model.pth'
        scaler_path = f'{patient_id}_scaler.joblib'

        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            print(f"Model for '{patient_id}' not found.")
            if patient_id != "test":
                print("Trying to load 'test' model as fallback...")
                patient_id = "test"
                model_path = 'test_model.pth'
                scaler_path = 'test_scaler.joblib'

            # Check again for test model
            if not os.path.exists(model_path) or not os.path.exists(scaler_path):
                print("--- No trained model found ---")
                print("The system will run in RECORDING MODE only.")
                print("Please:")
                print("  1. Use the frontend to record training data")
                print("  2. Train a model using the 'Train Model' button")
                print("  3. The model will be loaded automatically after training")
                model = None
                scaler = None
                return False

        model = HARModel(num_classes=NUM_CLASSES)
        model.load_state_dict(torch.load(model_path))
        model.eval()
        scaler = joblib.load(scaler_path)
        current_patient_id = patient_id
        print(f"Successfully loaded model and scaler for patient: {patient_id}")
        return True
    except Exception as e:
        print(f"--- ERROR loading model: {e} ---")
        print("The system will run in RECORDING MODE only.")
        model = None
        scaler = None
        return False

# --- Web API (Socket.IO) ---
@socketio.on('connect')
def handle_connect():
    """Called when React frontend connects."""
    print("React frontend connected.")
    emit('state_update', {
        'state': device_state, 
        'meter': activity_meter, 
        'activity': current_activity, 
        'patient': current_patient_id,
        'threshold': MAX_ACTIVITY_METER 
    })
    
    if device_state == 'sleeping' and temp_readings:
        emit('sleep_data_update', {
            'temp': {'avg': round(np.mean(temp_readings), 2), 'min': min(temp_readings), 'max': max(temp_readings), 'last': temp_readings[-1]},
            'light': {'avg': round(np.mean(light_readings), 2), 'min': min(light_readings), 'max': max(light_readings), 'last': light_readings[-1]},
            'sound': {'avg': round(np.mean(sound_readings), 2), 'min': min(sound_readings), 'max': max(sound_readings), 'last': sound_readings[-1]}
        })

@socketio.on('set_state')
def handle_set_state(data):
    """Called when React sends a new state."""
    global device_state, activity_meter, temp_readings, light_readings, sound_readings
    
    new_state = data.get('state')
    if new_state == 'active':
        device_state = 'active'
        activity_meter = MAX_ACTIVITY_METER 
        temp_readings, light_readings, sound_readings = [], [], []
        print("STATE CHANGE: ACTIVE")
        send_serial_command(format_lcd("Device Active", "Activity Mode"))
        send_serial_command(COLOUR_ACTIVE) 
        
    elif new_state == 'sleeping':
        device_state = 'sleeping'
        print("STATE CHANGE: SLEEPING")
        send_serial_command(format_lcd("Device Sleeping", "Temp. Monitor"))
        send_serial_command(COLOUR_SLEEP) 

    emit('state_update', {
        'state': device_state, 
        'meter': activity_meter, 
        'patient': current_patient_id,
        'threshold': MAX_ACTIVITY_METER
    })

@socketio.on('set_inactivity_threshold')
def handle_set_threshold(data):
    """Called when React sends a new inactivity threshold."""
    global MAX_ACTIVITY_METER, activity_meter, current_activity
    
    try:
        new_threshold = int(data.get('threshold'))
        if new_threshold > 0:
            old_threshold = float(MAX_ACTIVITY_METER) 
            MAX_ACTIVITY_METER = new_threshold
            
            if old_threshold > 0:
                 activity_meter = int((activity_meter / old_threshold) * new_threshold)
            else:
                 activity_meter = new_threshold 
            
            activity_meter = min(activity_meter, MAX_ACTIVITY_METER) 

            print(f"--- Inactivity threshold updated to: {MAX_ACTIVITY_METER} ---")
            
            emit('threshold_update', {'threshold': MAX_ACTIVITY_METER}, broadcast=True)
            emit('activity_update', {'activity': current_activity, 'meter': activity_meter}, broadcast=True)
        else:
            print("Ignoring invalid threshold (must be > 0)")
    except Exception as e:
        print(f"Error setting new threshold: {e}")

# --- Frontend Training API ---

@socketio.on('start_recording')
def handle_start_recording(data):
    global is_recording, current_recording_file
    patient_id = data.get('patient_id', 'test')
    activity = data.get('activity')
    if is_recording or not activity: return
    filename = f"{patient_id}_{activity}.csv"
    try:
        current_recording_file = open(filename, 'w')
        is_recording = True
        print(f"--- START RECORDING: Saving to {filename} ---")
        send_serial_command(format_lcd("REC: Starting...", f"{activity.upper()}"))
        send_serial_command(COLOUR_RECORDING) 
        emit('recording_status', {'recording': True, 'activity': activity})
    except Exception as e:
        print(f"Error opening file: {e}")

@socketio.on('stop_recording')
def handle_stop_recording():
    global is_recording, current_recording_file
    if not is_recording: return
    is_recording = False
    if current_recording_file:
        current_recording_file.close()
        current_recording_file = None
    print(f"--- STOP RECORDING ---")
    send_serial_command(format_lcd("REC: Stopped.", ""))
    send_serial_command(COLOUR_ACTIVE)
    emit('recording_status', {'recording': False})

@socketio.on('train_model')
def handle_train_model(data):
    patient_id = data.get('patient_id', 'test')
    print(f"Received request to train model for: {patient_id}")
    send_serial_command(format_lcd("Training Model...", "Please wait."))
    
    def training_status_callback(message):
        print(f"[Train Status] {message}")
        socketio.emit('training_status', {'message': message})
    
    socketio.start_background_task(train_model_wrapper, patient_id, training_status_callback)
    
def train_model_wrapper(patient_id, callback):
    if train_model(patient_id, callback):
        load_model(patient_id)
        socketio.emit('state_update', {
            'patient': current_patient_id, 
            'threshold': MAX_ACTIVITY_METER 
        })
        send_serial_command(format_lcd("Training Done!", "Ready."))
        send_serial_command(COLOUR_ACTIVE)
    else:
        callback(f"Training failed for {patient_id}.")
        send_serial_command(format_lcd("Training FAILED", "See console."))
        send_serial_command(COLOUR_ALERT)

# --- Main Hardware & ML Thread ---
def hardware_loop():
    """
    The main background thread that reads from serial, runs the model,
    and manages the application logic.
    """
    global device_state, activity_meter, current_activity, temp_readings, light_readings, sound_readings, ser
    global is_recording, current_recording_file
    
    data_window = []
    
    while True:
        try:
            if ser is None or not ser.is_open:
                print("Attempting to connect to serial port...")
                ser = serial.Serial(
                    SERIAL_PORT,
                    BAUD_RATE,
                    timeout=1,
                    write_timeout=2,  # Increased write timeout
                    dsrdtr=False,     # Disable DTR (prevents Arduino reset)
                    rtscts=False      # Disable RTS/CTS flow control
                )
                print("Serial port opened. Waiting for Arduino to be ready...")
                time.sleep(3)  # Give Arduino time to initialize

                # Clear any stale data in buffers
                ser.reset_input_buffer()
                ser.reset_output_buffer()
                print("Buffers cleared.")

                print("Serial connection established.")
                if device_state == "sleeping":
                    send_serial_command(format_lcd("Device Sleeping", "Temp. Monitor"))
                    time.sleep(0.2)  # Increased delay between commands
                    send_serial_command(COLOUR_SLEEP)
                else:
                    send_serial_command(format_lcd("Device Active", "Activity Mode"))
                    time.sleep(0.2)  # Increased delay between commands
                    send_serial_command(COLOUR_ACTIVE)
            
            if ser.in_waiting > 0:
                line_bytes = ser.readline()
                data_str = line_bytes.decode('ascii', errors='ignore').strip()
                if not data_str or not data_str.startswith("T:"):
                    continue
                
                # --- A. Data Recording Logic ---
                if is_recording and current_recording_file:
                    current_recording_file.write(data_str + '\n')
                    socketio.emit('live_data', {'data': data_str}) 

                # --- B. State-Based Logic (only if not recording) ---
                if not is_recording:
                    parsed_dict = parse_full_packet(data_str)
                    if not parsed_dict: 
                        continue
                    
                    if device_state == "active":
                        # --- ACTIVE STATE LOGIC ---
                        if 'X' not in parsed_dict or 'Y' not in parsed_dict or 'Z' not in parsed_dict:
                            continue

                        data_window.append([parsed_dict['X'], parsed_dict['Y'], parsed_dict['Z']])

                        if len(data_window) == WINDOW_SIZE:
                            if model is None or scaler is None:
                                print("Model or scaler not loaded, skipping prediction.")
                                data_window = data_window[STEP_SIZE:]
                                continue

                            # Convert to numpy array
                            window_np = np.array(data_window, dtype=np.float32)

                            # Compute motion features (velocity/deltas)
                            deltas = np.zeros_like(window_np)
                            deltas[1:] = np.diff(window_np, axis=0)
                            deltas[0] = deltas[1]

                            # Combine raw data with velocity features (6 channels total)
                            window_features = np.concatenate([window_np, deltas], axis=1)

                            # Scale and prepare for model
                            window_scaled = scaler.transform(window_features)
                            window_tensor = torch.from_numpy(window_scaled).unsqueeze(0).permute(0, 2, 1)

                            with torch.no_grad():
                                outputs = model(window_tensor)
                                _, predicted_idx = torch.max(outputs, 1)

                            current_activity = ACTIVITIES[predicted_idx.item()]

                            if current_activity == 'sitting':
                                activity_meter = max(0, activity_meter - 1)
                            else:  # walking
                                activity_meter = min(MAX_ACTIVITY_METER, activity_meter + 5)

                            # Calculate progress percentage
                            progress_percent = 0
                            if MAX_ACTIVITY_METER > 0:
                                progress_percent = activity_meter / MAX_ACTIVITY_METER

                            # Create visual progress bar (10 chars wide to fit on 16-char LCD)
                            bar_width = 10
                            filled = int(progress_percent * bar_width)
                            bar = "[" + ("=" * filled) + ("-" * (bar_width - filled)) + "]"

                            # Format: "sitting" (7) or "walking" (7) + space + bar (12) = 20 chars
                            # Need to shorten: use first char + bar
                            activity_char = current_activity[0].upper()  # 'S' or 'W'

                            if activity_meter <= 0:
                                send_serial_command(COLOUR_ALERT)
                                send_serial_command(format_lcd("!! MOVE NOW !!", bar))
                                socketio.emit('status_update', {'alert': 'inactive'})
                            else:
                                send_serial_command(COLOUR_ACTIVE)
                                # Line 1: Activity name (full word)
                                # Line 2: Progress bar with percentage
                                percentage_text = f"{int(progress_percent * 100)}%"
                                send_serial_command(format_lcd(f"{activity_char}:{current_activity}", f"{bar} {percentage_text}"))

                            socketio.emit('activity_update', {'activity': current_activity, 'meter': activity_meter})
                            data_window = data_window[STEP_SIZE:]

                    elif device_state == "sleeping":
                        # --- SLEEPING STATE LOGIC ---
                        temp = parsed_dict.get('T', 0)
                        light = parsed_dict.get('L', 0)
                        sound = parsed_dict.get('S', 0)
                        
                        temp_readings.append(temp)
                        light_readings.append(light)
                        sound_readings.append(sound)
                        
                        if len(temp_readings) > 100: temp_readings.pop(0)
                        if len(light_readings) > 100: light_readings.pop(0)
                        if len(sound_readings) > 100: sound_readings.pop(0)
                        
                        socketio.emit('sleep_data_update', {
                            'temp':  {'avg': round(np.mean(temp_readings), 2),  'min': min(temp_readings),  'max': max(temp_readings),  'last': temp},
                            'light': {'avg': round(np.mean(light_readings), 2), 'min': min(light_readings), 'max': max(light_readings), 'last': light},
                            'sound': {'avg': round(np.mean(sound_readings), 2), 'min': min(sound_readings), 'max': max(sound_readings), 'last': sound}
                        })

            eventlet.sleep(0.01) 

        except serial.SerialException:
            if ser: ser.close()
            ser = None
            print("Serial port disconnected. Retrying in 5 seconds...")
            eventlet.sleep(5)
        except Exception as e:
            print(f"An error occurred in hardware_loop: {e}")
            eventlet.sleep(1)

# --- Start Everything ---
if __name__ == '__main__':
    load_model(current_patient_id) # Load the default ("test") model
    
    print("Starting hardware background thread...")
    socketio.start_background_task(hardware_loop)
    
    print("Starting Flask-SocketIO server at http://127.0.0.1:5000 ...")
    socketio.run(app, host='0.0.0.0', port=5000)