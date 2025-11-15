# LCD Display Troubleshooting Guide

## Problem
The LCD backlight turns blue but no text is displayed on the screen.

## Diagnostic Steps

### Step 1: Hardware Test (No Serial Communication)

Upload the **LCD_Hardware_Test.ino** firmware to your Arduino:

1. Open Arduino IDE
2. Open: `arduino_firmware/LCD_Hardware_Test.ino`
3. Upload to your Arduino R4 Minima
4. Watch the LCD display

**Expected Behavior:**
- LCD should cycle through different colors (Red, Green, Blue, White)
- Text should appear on both lines
- Counter should increment

**If this works:** Your LCD hardware is fine, the issue is with serial communication.

**If this doesn't work:** Your LCD has a hardware issue:
- Check I2C wiring (SDA to A4, SCL to A5)
- Check LCD power (VCC to 5V, GND to GND)
- Try adjusting LCD contrast (if it has a potentiometer on the back)
- Verify LCD I2C address using I2C scanner sketch

---

### Step 2: Serial Communication Test

If hardware test passed, upload **Delirium_Monitor_Firmware_Debug.ino**:

1. Open Arduino IDE
2. Open: `arduino_firmware/Delirium_Monitor_Firmware_Debug.ino`
3. Upload to Arduino
4. Open Serial Monitor (Tools → Serial Monitor, set to 9600 baud)
5. You should see: `DEBUG: Arduino initialized, LCD should show 'System Online!'`

**Check LCD Display:**
- Does it show "System Online!" on line 1?
- Does it show "Waiting for PC..." on line 2?
- Is the backlight blue (RGB 0,100,255)?

**If YES:** LCD is working! Continue to Step 3.

**If NO:** There may be a timing issue with LCD initialization. Try:
- Adding `delay(100);` after `lcd.begin(16, 2);` in the firmware
- Power cycling the Arduino completely

---

### Step 3: Test Commands from Python

With debug firmware still running:

1. **Close Arduino Serial Monitor** (important!)
2. In a terminal, navigate to `backend/` folder
3. Run: `python test_lcd.py`

**Watch Serial Monitor in Arduino IDE:**
- You should see debug messages like: `DEBUG: Received command: 'L:Test 1|Line 2'`
- LCD should update with each test command

**In the Python terminal:**
- You should see: "Sent X bytes" for each command
- No timeout errors

**Possible Issues:**

#### Issue A: No DEBUG messages in Arduino Serial Monitor
- **Problem:** Arduino isn't receiving commands
- **Solution:** Check COM port in `shared_config.py` (currently COM7)
- **Verify:** Run Device Manager → Ports → find Arduino port number

#### Issue B: DEBUG messages appear but LCD doesn't update
- **Problem:** LCD command parsing or display issue
- **Check debug output:** Are the parsed values correct?
- **Try:** Manually send commands in Serial Monitor:
  - Type: `L:Hello|World` and press Enter
  - Type: `RGB:255,0,0` and press Enter

#### Issue C: LCD updates briefly then goes blank
- **Problem:** Sensor data loop might be interfering
- **Try:** In debug firmware, comment out `sendSensorData()` in loop()

---

### Step 4: Check Main Application

If test_lcd.py works, try the full application:

1. Upload **Delirium_Monitor_Firmware.ino** (original, not debug)
2. Close Arduino IDE Serial Monitor
3. Run backend: `python main.py`
4. Run frontend: `cd frontend && npx vite`

**Watch the backend terminal:**
- Should see: "Sending to Arduino: RGB:0,0,50"
- Should see: "Sending to Arduino: L:Device Sleeping|..."

**If backend freezes:**
- The serial port is blocked by another application
- Close Arduino IDE completely
- Check Task Manager for any processes using COM7

---

## Common Solutions

### Solution 1: LCD Contrast
Some RGB LCD displays have very low contrast by default. If there's a small potentiometer (blue or white) on the back of the LCD module, try adjusting it while the display is powered on.

### Solution 2: I2C Address
The RGB LCD library uses I2C address 0x3E for RGB and 0x7C for LCD. If your LCD uses different addresses, you'll need to modify the library or use a different one.

### Solution 3: Library Issue
Make sure you have the correct RGB LCD library installed:
- In Arduino IDE: Sketch → Include Library → Manage Libraries
- Search for: "Grove LCD RGB Backlight"
- Install the library by Seeed Studio

### Solution 4: Power Supply
The RGB backlight can draw significant current. Make sure:
- Arduino is powered via USB from a good power supply (not a low-power USB hub)
- USB cable is of good quality (some cables are charge-only, not data)

### Solution 5: Wiring Check
```
LCD Module    Arduino R4 Minima
---------     -----------------
VCC    →      5V
GND    →      GND
SDA    →      SDA (or A4)
SCL    →      SCL (or A5)
```

---

## Quick Diagnostic Checklist

- [ ] LCD backlight turns on (any color)
- [ ] LCD shows text in hardware test (LCD_Hardware_Test.ino)
- [ ] Debug firmware shows "System Online!" on upload
- [ ] Serial Monitor shows DEBUG messages when Python sends commands
- [ ] test_lcd.py completes without errors
- [ ] LCD updates when test_lcd.py runs
- [ ] main.py doesn't freeze when sending LCD commands

---

## Expected Command Format

The Arduino expects commands in these formats:

**LCD Text (single line):**
```
L:Your text here\n
```

**LCD Text (two lines, separated by |):**
```
L:Line 1 text|Line 2 text\n
```

**RGB Backlight:**
```
RGB:255,0,0\n
```
(Red, Green, Blue values from 0-255)

---

## Files Reference

| File | Purpose |
|------|---------|
| `LCD_Hardware_Test.ino` | Test LCD without serial communication |
| `Delirium_Monitor_Firmware_Debug.ino` | Debug firmware with serial echo |
| `Delirium_Monitor_Firmware.ino` | Production firmware |
| `test_lcd.py` | Python script to test LCD commands |

---

## Next Steps

Once you determine which step fails, report back with:
1. Which test passed/failed
2. Any debug output from Serial Monitor
3. Any error messages from Python scripts

This will help identify the exact issue!
