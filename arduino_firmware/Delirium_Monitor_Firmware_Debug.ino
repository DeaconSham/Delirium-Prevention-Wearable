/**
 * @file Delirium_Monitor_Firmware_Debug.ino
 * @brief Arduino firmware for Delirium Prevention Wearable - DEBUG VERSION
 * @details This version adds serial debugging to help diagnose LCD issues.
 */

#include <Wire.h>
#include "rgb_lcd.h"

// Pin Definitions
const int tempPin   = A0; // Thermistor
const int lightPin  = A1; // Light sensor
const int soundPin  = A2; // Sound sensor
const int accelXPin = A3; // Accelerometer X
const int accelYPin = A4; // Accelerometer Y
const int accelZPin = A5; // Accelerometer Z

// Temperature sensor constants
const float B_CONST = 4275.0;
const float R0_CONST = 100000.0;
const float ADC_MAX = 4095.0;

// Timing variables
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 100;

// LCD object
rgb_lcd lcd;

// Serial command buffer
String rx_command = "";

void setup() {
  Serial.begin(9600);
  analogReadResolution(12);

  // Initialize LCD
  lcd.begin(16, 2);
  lcd.setRGB(0, 100, 255);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Online!");
  lcd.setCursor(0, 1);
  lcd.print("Waiting for PC...");

  rx_command.reserve(100);

  // Debug message
  Serial.println("DEBUG: Arduino initialized, LCD should show 'System Online!'");
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= sendInterval) {
    lastSendTime = now;
    sendSensorData();
  }

  checkSerialCommands();
}

void sendSensorData() {
  int temp_adc_val = analogRead(tempPin);
  int accel_x_val  = analogRead(accelXPin);
  int accel_y_val  = analogRead(accelYPin);
  int accel_z_val  = analogRead(accelZPin);
  int light_adc_val = analogRead(lightPin);
  int sound_adc_val = analogRead(soundPin);

  float temp_C = -99.0;
  if (temp_adc_val > 0) {
    float R_thermistor = R0_CONST * (ADC_MAX / (float)temp_adc_val - 1.0);
    float log_R = log(R_thermistor / R0_CONST);
    float temp_K = 1.0 / (log_R / B_CONST + 1.0 / 298.15);
    temp_C = temp_K - 273.15;
  }

  String tx = "T:" + String(temp_C, 1);
  tx += ",X:" + String(accel_x_val);
  tx += ",Y:" + String(accel_y_val);
  tx += ",Z:" + String(accel_z_val);
  tx += ",L:" + String(light_adc_val);
  tx += ",S:" + String(sound_adc_val);

  Serial.println(tx);
}

void checkSerialCommands() {
  if (Serial.available() > 0) {
    rx_command = Serial.readStringUntil('\n');
    rx_command.trim();

    // DEBUG: Echo received command
    Serial.print("DEBUG: Received command: '");
    Serial.print(rx_command);
    Serial.println("'");

    parseCommand(rx_command);
  }
}

void parseCommand(String cmd) {
  int colonIndex = cmd.indexOf(':');
  if (colonIndex == -1) {
    Serial.println("DEBUG: Invalid command format (no colon)");
    return;
  }

  String commandType = cmd.substring(0, colonIndex);
  String commandValue = cmd.substring(colonIndex + 1);

  Serial.print("DEBUG: Command type = '");
  Serial.print(commandType);
  Serial.print("', Value = '");
  Serial.print(commandValue);
  Serial.println("'");

  if (commandType == "RGB") {
    int r, g, b;
    if (sscanf(commandValue.c_str(), "%d,%d,%d", &r, &g, &b) == 3) {
      lcd.setRGB(r, g, b);
      Serial.print("DEBUG: Set RGB to (");
      Serial.print(r);
      Serial.print(", ");
      Serial.print(g);
      Serial.print(", ");
      Serial.print(b);
      Serial.println(")");
    } else {
      Serial.println("DEBUG: Failed to parse RGB values");
    }
  } else if (commandType == "L") {
    Serial.println("DEBUG: Processing LCD text command");
    lcd.clear();

    int split = commandValue.indexOf('|');

    if (split == -1) {
      // Only one line of text
      lcd.setCursor(0, 0);
      lcd.print(commandValue);
      Serial.print("DEBUG: LCD Line 1: '");
      Serial.print(commandValue);
      Serial.println("'");
    } else {
      // Two lines of text
      String line1 = commandValue.substring(0, split);
      String line2 = commandValue.substring(split + 1);

      lcd.setCursor(0, 0);
      lcd.print(line1);
      lcd.setCursor(0, 1);
      lcd.print(line2);

      Serial.print("DEBUG: LCD Line 1: '");
      Serial.print(line1);
      Serial.print("', Line 2: '");
      Serial.print(line2);
      Serial.println("'");
    }
  } else {
    Serial.print("DEBUG: Unknown command type: ");
    Serial.println(commandType);
  }
}
