# ML Model Improvements - Walking vs Sitting Detection

## Changes Made

### 1. Reduced to 2 Classes
- **Old**: 3 classes (sitting, walking, waving)
- **New**: 2 classes (sitting, walking)
- **Reason**: Waving was causing false positives when the device was still

### 2. Added Motion Features (Velocity/Acceleration)
- **Old**: Raw X, Y, Z accelerometer values only (3 features)
- **New**: Raw X, Y, Z + Velocity (deltaX, deltaY, deltaZ) = 6 features
- **Benefit**: Model can now detect **rate of change** over time, not just absolute position

```python
# Compute velocity features
deltas = np.diff(data, axis=0)  # First derivative
features = np.concatenate([data, deltas], axis=1)  # 6 total features
```

### 3. Improved Model Architecture
- **Added**: BatchNormalization layers for better training stability
- **Added**: Dropout (30%) to prevent overfitting
- **Increased**: Model capacity (64→128 filters in conv layers)
- **Added**: Extra dense layer (128→64→2) for better feature learning

**Old Model**:
```
Conv1d(3→32) → Pool → Conv1d(32→64) → Pool → Linear(64→3)
```

**New Model**:
```
Conv1d(6→64) → BatchNorm → Pool →
Conv1d(64→128) → BatchNorm → Pool →
Linear(128→64) → Dropout → Linear(64→2)
```

### 4. Enhanced Training Process
- **Epochs**: Increased from 20 to 30
- **Batch Size**: Increased from 16 to 32 for better gradient estimates
- **Learning Rate Scheduler**: Automatically reduces LR when validation accuracy plateaus
- **Stratified Splitting**: Ensures balanced class distribution in train/val sets
- **Per-Class Accuracy**: Reports accuracy for each activity separately

### 5. Better Metrics & Logging
- Shows class distribution (how many samples of each activity)
- Displays best validation accuracy during training
- Final per-class accuracy breakdown

## How It Works

### Motion Detection
The key improvement is using **velocity** (rate of change):

- **Sitting**: Low or no change in accelerometer values over time
  - deltaX ≈ 0, deltaY ≈ 0, deltaZ ≈ 0

- **Walking**: Consistent periodic changes in accelerometer values
  - deltaX, deltaY, deltaZ show rhythmic patterns

### Training Example Output
```
Starting training for patient: test
Loading 'test_sitting.csv'...
  -> Loaded 500 samples with motion features
Loading 'test_walking.csv'...
  -> Loaded 800 samples with motion features
Total samples loaded: 1300
Created 128 windows of size 20

Class distribution:
  sitting: 60 windows (46.9%)
  walking: 68 windows (53.1%)

Epoch 1/30 - Val Acc: 75.00%
Epoch 2/30 - Val Acc: 82.50%
...
Epoch 15/30 - Val Acc: 95.00% ⭐ (NEW BEST)
...
Best validation accuracy: 95.00%

Final Model Evaluation:
  sitting: 93.3% (14/15)
  walking: 96.4% (27/28)
```

## Usage

### Recording Training Data
1. In the frontend, record **at least 30 seconds** of each activity:
   - **Sitting**: Stay completely still
   - **Walking**: Walk naturally around the room

2. Train the model using the "Train Model" button

### Expected Behavior
- **When Still**: Should consistently detect "sitting"
- **When Walking**: Should detect "walking" with periodic acceleration changes
- **No More False "Waving"**: The 3rd class has been removed

## Files Modified

1. `shared_config.py` - Updated ACTIVITIES to 2 classes
2. `train_model.py` - Complete rewrite with motion features
3. `main.py` - Updated inference to compute motion features
4. Frontend types and components - Removed "waving" references

## Technical Details

### Feature Engineering
Each window now contains:
- **Raw Position**: X, Y, Z values (tells where the device is oriented)
- **Velocity**: deltaX, deltaY, deltaZ (tells how fast it's moving/changing)

This combination allows the model to distinguish between:
- **Static** (sitting): Position may vary, but velocity is near zero
- **Dynamic** (walking): Position changes rhythmically with non-zero velocity

### Window Size
- **20 samples** at 10Hz = 2 seconds of data per prediction
- **50% overlap** (step size = 10) for smoother predictions
- Provides enough temporal context to detect walking patterns

## Performance Expectations

With good training data (30+ seconds each):
- **Overall Accuracy**: 90-95%
- **Sitting Detection**: 90-95% (low false positives)
- **Walking Detection**: 92-97% (catches most walking activity)

## Troubleshooting

### Model Still Detects Walking When Still
- Record more sitting data (60+ seconds completely still)
- Ensure Arduino is on a stable surface during sitting recording
- Retrain the model

### Model Doesn't Detect Walking
- Record more walking data with varied speeds
- Make sure you're actually walking during recording (not just moving device)
- Check that accelerometer is working (values should change during walking)

### Low Accuracy After Training
- Need more training data (try 60+ seconds per activity)
- Ensure activities are clearly different (sitting = still, walking = moving)
- Check class balance (should be roughly 50/50 sitting/walking samples)
