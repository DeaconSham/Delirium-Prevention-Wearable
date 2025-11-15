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

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- 1. Improved Model Architecture with Motion Detection ---
class HARModel(nn.Module):
    def __init__(self, num_classes):
        super(HARModel, self).__init__()
        # Input: 6 channels (X, Y, Z, deltaX, deltaY, deltaZ)
        self.conv1 = nn.Conv1d(in_channels=6, out_channels=64, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(64)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2)

        self.conv2 = nn.Conv1d(in_channels=64, out_channels=128, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(128)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(kernel_size=2)

        self.adaptive_pool = nn.AdaptiveAvgPool1d(1)
        self.flatten = nn.Flatten()

        # Additional dense layers for better classification
        self.fc1 = nn.Linear(128, 64)
        self.relu3 = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, num_classes)

    def forward(self, x):
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = self.adaptive_pool(x)
        x = self.flatten(x)
        x = self.dropout(self.relu3(self.fc1(x)))
        x = self.fc2(x)
        return x


def compute_motion_features(data):
    """
    Compute velocity (delta) features from raw accelerometer data.

    Args:
        data: numpy array of shape (num_samples, 3) with [X, Y, Z] values

    Returns:
        features: numpy array of shape (num_samples, 6) with [X, Y, Z, deltaX, deltaY, deltaZ]
    """
    # Compute velocities (differences between consecutive samples)
    deltas = np.zeros_like(data)
    deltas[1:] = np.diff(data, axis=0)  # First derivative
    deltas[0] = deltas[1]  # Copy second row to first to maintain size

    # Combine raw data with velocity features
    features = np.concatenate([data, deltas], axis=1)

    return features


# --- 2. Main Training Function ---
def train_model(patient_id="test", status_callback=None):
    """
    Loads CSV data, computes motion features, trains a model, and saves the model and scaler.
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

        temp_data = []
        with open(filename, 'r') as f:
            for line in f:
                parsed_dict = parse_full_packet(line)

                if parsed_dict and 'X' in parsed_dict and 'Y' in parsed_dict and 'Z' in parsed_dict:
                    temp_data.append([parsed_dict['X'], parsed_dict['Y'], parsed_dict['Z']])

        if temp_data:
            # Compute motion features (velocity) for this activity
            temp_data = np.array(temp_data, dtype=np.float32)
            temp_features = compute_motion_features(temp_data)

            for features in temp_features:
                all_data.append(features)
                all_labels.append(activity_label)

            status_callback(f"  -> Loaded {len(temp_data)} samples with motion features")

    if not all_data:
        status_callback(f"Error: No data found for patient '{patient_id}'. Training aborted.")
        return False

    status_callback(f"Total samples loaded: {len(all_data)}")
    status_callback("Creating sliding windows...")

    X, y = [], []
    for i in range(0, len(all_data) - WINDOW_SIZE, STEP_SIZE):
        window = all_data[i : i + WINDOW_SIZE]
        X.append(window)
        y.append(all_labels[i + WINDOW_SIZE - 1])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int64)

    status_callback(f"Created {len(X)} windows of size {WINDOW_SIZE}")

    # Check class balance
    unique, counts = np.unique(y, return_counts=True)
    status_callback("Class distribution:")
    for label_idx, count in zip(unique, counts):
        status_callback(f"  {ACTIVITIES[label_idx]}: {count} windows ({100*count/len(y):.1f}%)")

    status_callback("Normalizing data...")
    scaler = StandardScaler()
    X_flat = X.reshape(-1, 6)  # Now 6 features instead of 3
    X_flat_scaled = scaler.fit_transform(X_flat)
    X_scaled = X_flat_scaled.reshape(X.shape)

    scaler_filename = f"{patient_id}_scaler.joblib"
    joblib.dump(scaler, scaler_filename)
    status_callback(f"Scaler saved: {scaler_filename}")

    # Split data with stratification to maintain class balance
    X_train, X_val, y_train, y_val = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )

    status_callback(f"Training samples: {len(X_train)}, Validation samples: {len(X_val)}")

    train_tensor = TensorDataset(
        torch.from_numpy(X_train).permute(0, 2, 1),  # Shape: (batch, 6, window_size)
        torch.from_numpy(y_train)
    )
    val_tensor = TensorDataset(
        torch.from_numpy(X_val).permute(0, 2, 1),
        torch.from_numpy(y_val)
    )

    pin_memory = torch.cuda.is_available()
    train_loader = DataLoader(train_tensor, batch_size=32, shuffle=True, pin_memory=pin_memory)
    val_loader = DataLoader(val_tensor, batch_size=32, shuffle=False, pin_memory=pin_memory)

    model = HARModel(num_classes=NUM_CLASSES).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)

    # Learning rate scheduler for better convergence
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=3, verbose=False)

    num_epochs = 30

    status_callback(f"Starting model training ({num_epochs} epochs)...")
    status_callback(f"Using device: {DEVICE}")
    best_acc = 0.0

    for epoch in range(num_epochs):
        # Training phase
        model.train()
        train_loss = 0.0
        for inputs, labels in train_loader:
            inputs = inputs.to(DEVICE, non_blocking=True)
            labels = labels.to(DEVICE, non_blocking=True)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        # Validation phase
        model.eval()
        correct, total = 0, 0
        val_loss = 0.0
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs = inputs.to(DEVICE, non_blocking=True)
                labels = labels.to(DEVICE, non_blocking=True)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                val_loss += loss.item()

                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()

        acc = 100 * correct / total
        avg_train_loss = train_loss / len(train_loader)
        avg_val_loss = val_loss / len(val_loader)

        # Update learning rate based on validation accuracy
        scheduler.step(acc)

        if acc > best_acc:
            best_acc = acc
            status_callback(f"Epoch {epoch+1}/{num_epochs} - Val Acc: {acc:.2f}% ⭐ (NEW BEST)")
        else:
            status_callback(f"Epoch {epoch+1}/{num_epochs} - Val Acc: {acc:.2f}%")

    status_callback(f"Best validation accuracy: {best_acc:.2f}%")

    model_filename = f"{patient_id}_model.pth"
    torch.save(model.state_dict(), model_filename)
    status_callback(f"Training complete. Model saved: {model_filename}")

    # Final evaluation - show per-class accuracy
    status_callback("\nFinal Model Evaluation:")
    model.eval()
    class_correct = [0] * NUM_CLASSES
    class_total = [0] * NUM_CLASSES

    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(DEVICE, non_blocking=True)
            labels = labels.to(DEVICE, non_blocking=True)
            outputs = model(inputs)
            _, predicted = torch.max(outputs, 1)

            for label, prediction in zip(labels, predicted):
                class_total[label] += 1
                if label == prediction:
                    class_correct[label] += 1

    for i, activity in enumerate(ACTIVITIES):
        if class_total[i] > 0:
            acc = 100 * class_correct[i] / class_total[i]
            status_callback(f"  {activity}: {acc:.1f}% ({class_correct[i]}/{class_total[i]})")

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
