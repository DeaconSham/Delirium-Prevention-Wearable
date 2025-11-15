import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os
from shared_config import WINDOW_SIZE, STEP_SIZE, ACTIVITIES, NUM_CLASSES, parse_full_packet


# --- 1. Define the 1D-CNN Model Architecture ---
class HARModel(nn.Module):
    def __init__(self, num_classes):
        super(HARModel, self).__init__()
        self.conv1 = nn.Conv1d(in_channels=3, out_channels=32, kernel_size=3, padding=1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.conv2 = nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(kernel_size=2)
        self.adaptive_pool = nn.AdaptiveAvgPool1d(1)
        self.flatten = nn.Flatten()
        self.fc1 = nn.Linear(in_features=64, out_features=num_classes)

    def forward(self, x):
        x = self.pool1(self.relu1(self.conv1(x)))
        x = self.pool2(self.relu2(self.conv2(x)))
        x = self.adaptive_pool(x)
        x = self.flatten(x) 
        x = self.fc1(x)
        return x


# --- 3. Main Training Function ---
def train_model(patient_id="test", status_callback=None):
    """
    Loads CSV data, trains a model, and saves the model and scaler.
    """
    if status_callback is None:
        status_callback = print 

    status_callback(f"Starting training for patient: {patient_id}")
    
    all_data, all_labels = [], []
    activity_map = {name: i for i, name in enumerate(ACTIVITIES)}
    
    for activity_name in ACTIVITIES:
        filename = f"{patient_id}_{activity_name}.csv"
        if not os.path.exists(filename):
            status_callback(f"Warning: File not found, skipping: {filename}")
            continue
            
        activity_label = activity_map[activity_name]
        status_callback(f"Loading '{filename}'...")
        
        with open(filename, 'r') as f:
            for line in f:
                parsed_dict = parse_full_packet(line)
                
                if parsed_dict and 'X' in parsed_dict and 'Y' in parsed_dict and 'Z' in parsed_dict:
                    all_data.append([parsed_dict['X'], parsed_dict['Y'], parsed_dict['Z']])
                    all_labels.append(activity_label)

    if not all_data:
        status_callback(f"Error: No data found for patient '{patient_id}'. Training aborted.")
        return False

    status_callback("Creating data windows...")
    X, y = [], []
    for i in range(0, len(all_data) - WINDOW_SIZE, STEP_SIZE):
        X.append(all_data[i : i + WINDOW_SIZE])
        y.append(all_labels[i + WINDOW_SIZE - 1])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int64)

    status_callback("Normalizing data...")
    scaler = StandardScaler()
    X_flat = X.reshape(-1, 3)
    X_flat_scaled = scaler.fit_transform(X_flat)
    X_scaled = X_flat_scaled.reshape(X.shape)

    scaler_filename = f"{patient_id}_scaler.joblib"
    joblib.dump(scaler, scaler_filename)
    status_callback(f"Scaler saved: {scaler_filename}")

    X_train, X_val, y_train, y_val = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    train_tensor = TensorDataset(torch.from_numpy(X_train).permute(0, 2, 1), torch.from_numpy(y_train))
    val_tensor = TensorDataset(torch.from_numpy(X_val).permute(0, 2, 1), torch.from_numpy(y_val))
    train_loader = DataLoader(train_tensor, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_tensor, batch_size=16, shuffle=False)

    model = HARModel(num_classes=NUM_CLASSES)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    num_epochs = 20

    status_callback("Starting model training (20 epochs)...")
    for epoch in range(num_epochs):
        model.train()
        for inputs, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
        
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for inputs, labels in val_loader:
                outputs = model(inputs)
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        
        acc = 100 * correct / total
        status_callback(f"Epoch {epoch+1}/{num_epochs}, Val Accuracy: {acc:.2f}%")

    model_filename = f"{patient_id}_model.pth"
    torch.save(model.state_dict(), model_filename)
    status_callback(f"Training complete. Model saved: {model_filename}")
    return True

if __name__ == "__main__":
    print("Running in standalone training mode for 'test' user...")
    
    # This block is for standalone testing.
    # It ensures that if you have files named "sitting.csv",
    # they are renamed to "test_sitting.csv" to match the test ID.
    for activity in ACTIVITIES:
        if os.path.exists(f"{activity}.csv"):
            print(f"Renaming '{activity}.csv' to 'test_{activity}.csv'")
            if os.path.exists(f"test_{activity}.csv"):
                os.remove(f"test_{activity}.csv")
            os.rename(f"{activity}.csv", f"test_{activity}.csv")
            
    train_model(patient_id="test")