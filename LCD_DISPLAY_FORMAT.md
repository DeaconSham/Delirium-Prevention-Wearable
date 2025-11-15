# LCD Display Format Reference

## LCD Specifications
- **Size:** 16x2 (16 characters per line, 2 lines)
- **Type:** RGB backlight LCD with I2C interface
- **Model:** Grove RGB LCD

---

## Display Modes

### 1. Active Mode - Activity Monitoring

When the device is in active mode and detecting activity:

#### Normal Activity Display
```
┌────────────────┐
│ S:sitting      │  Line 1: Activity type (S=Sitting, W=Walking)
│ [=====-----] 50%│  Line 2: Progress bar + percentage
└────────────────┘
```

**Format:**
- Line 1: `{activity_char}:{activity_name}`
  - `S:sitting` or `W:walking`
- Line 2: `[{bar}] {percentage}%`
  - Bar is 10 characters wide
  - `=` characters show filled portion
  - `-` characters show empty portion
  - Percentage shows meter level (0-100%)

**Example displays at different meter levels:**

**100% Full (High Activity):**
```
┌────────────────┐
│ W:walking      │
│ [==========] 100%│
└────────────────┘
```
RGB Color: Green (0, 255, 0)

**80% (Good Activity):**
```
┌────────────────┐
│ W:walking      │
│ [========--] 80%│
└────────────────┘
```
RGB Color: Green (0, 255, 0)

**50% (Moderate):**
```
┌────────────────┐
│ S:sitting      │
│ [=====-----] 50%│
└────────────────┘
```
RGB Color: Blue (0, 100, 255)

**25% (Low Activity):**
```
┌────────────────┐
│ S:sitting      │
│ [==--------] 25%│
└────────────────┘
```
RGB Color: Orange (255, 165, 0)

**0% Alert (Critical - No Activity):**
```
┌────────────────┐
│ !! MOVE NOW !! │
│ [----------] 0%│
└────────────────┘
```
RGB Color: Red (255, 0, 0)

---

### 2. Sleep Mode - Environmental Monitoring

When the device is in sleep mode (monitoring temperature, light, sound):

```
┌────────────────┐
│ Device Sleeping│
│ Temp. Monitor  │
└────────────────┘
```
RGB Color: Dim Blue (0, 0, 50)

---

### 3. Recording Mode

When recording training data:

**Starting:**
```
┌────────────────┐
│ REC: Starting..│
│ SITTING        │
└────────────────┘
```
RGB Color: Yellow (255, 255, 0)

**Stopped:**
```
┌────────────────┐
│ REC: Stopped.  │
│                │
└────────────────┘
```
RGB Color: Back to active color

---

### 4. Training Mode

When training ML model:

```
┌────────────────┐
│ Training Model.│
│ Please wait.   │
└────────────────┘
```

**Success:**
```
┌────────────────┐
│ Training Done! │
│ Ready.         │
└────────────────┘
```
RGB Color: Green (0, 255, 0)

**Failed:**
```
┌────────────────┐
│ Training FAILED│
│ See console.   │
└────────────────┘
```
RGB Color: Red (255, 0, 0)

---

### 5. Initialization

On Arduino boot:

```
┌────────────────┐
│ System Online! │
│ Waiting for PC.│
└────────────────┘
```
RGB Color: Blue (0, 100, 255)

When backend connects:

```
┌────────────────┐
│ Device Active  │
│ Activity Mode  │
└────────────────┘
```
RGB Color: Blue (0, 100, 255)

---

## RGB Color Legend

| State | RGB Value | Color | Usage |
|-------|-----------|-------|-------|
| Active (Normal) | (0, 100, 255) | Blue | Default active state |
| Active (Walking) | (0, 255, 0) | Green | Good activity detected |
| Alert (Critical) | (255, 0, 0) | Red | Meter at 0%, need movement |
| Sleep Mode | (0, 0, 50) | Dim Blue | Nighttime environmental monitoring |
| Recording | (255, 255, 0) | Yellow | Recording training data |
| Training Success | (0, 255, 0) | Green | Model trained successfully |
| Training Failed | (255, 0, 0) | Red | Training error |

---

## Progress Bar Calculation

The activity meter progress bar is calculated as follows:

```python
# Bar width (fits on 16-char display with text)
bar_width = 10

# Calculate percentage
progress_percent = activity_meter / MAX_ACTIVITY_METER

# Calculate filled portion
filled = int(progress_percent * bar_width)

# Create bar string
bar = "[" + ("=" * filled) + ("-" * (bar_width - filled)) + "]"

# Add percentage text
percentage_text = f"{int(progress_percent * 100)}%"

# Final line 2 format
line2 = f"{bar} {percentage_text}"
```

**Example calculations:**

| Meter | Max | % | Filled | Bar Display |
|-------|-----|---|--------|-------------|
| 100 | 100 | 100% | 10 | `[==========] 100%` |
| 80 | 100 | 80% | 8 | `[========--] 80%` |
| 50 | 100 | 50% | 5 | `[=====-----] 50%` |
| 25 | 100 | 25% | 2 | `[==--------] 25%` |
| 0 | 100 | 0% | 0 | `[----------] 0%` |

---

## Character Count Reference

**Line 1 Examples:**
- `S:sitting` = 9 characters (7 chars remaining)
- `W:walking` = 9 characters (7 chars remaining)
- `!! MOVE NOW !!` = 14 characters (2 chars remaining)
- `Device Sleeping` = 15 characters (1 char remaining)

**Line 2 Examples:**
- `[==========] 100%` = 17 characters (needs to fit in 16!)
- `[=====-----] 50%` = 16 characters (PERFECT FIT!)
- `Temp. Monitor` = 13 characters (3 chars remaining)

**Note:** The percentage text with 3 digits (100%) makes the total 17 chars. This will be truncated to 16 chars on the LCD, so it will show:
```
[==========] 100
```
This is acceptable. For 0-99%, it fits perfectly:
```
[=====-----] 50%
```

---

## Testing Commands

You can manually test these displays using the Serial Monitor or test_lcd.py:

**Activity displays:**
```
L:S:sitting|[==========] 100%
L:W:walking|[========--] 80%
L:S:sitting|[=====-----] 50%
L:!! MOVE NOW !!|[----------] 0%
```

**With RGB commands:**
```
RGB:0,255,0
L:W:walking|[========--] 80%
```

**Sleep mode:**
```
RGB:0,0,50
L:Device Sleeping|Temp. Monitor
```

---

## Implementation Notes

1. **Bar uses ASCII characters** (`=` and `-`) for maximum compatibility
2. **Unicode block characters** (`█`) were considered but avoided for LCD compatibility
3. **Progress bar is 10 chars wide** to leave room for brackets and percentage
4. **Total line 2 length** is exactly 16 characters for 0-99%
5. **Activity character** (S/W) on line 1 saves space while still being clear
6. **Color changes** provide visual feedback for different states

---

## Future Enhancements

Possible improvements:
- Custom LCD characters for smoother progress bar
- Animated transitions between states
- Additional symbols for different activity types
- Sound alerts (if piezo buzzer added)
