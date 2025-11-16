/**
 * @file R4_Minima_Controller.ino
 * @author Deacon Sham
 * @brief Main firmware for the Delirium Prevention Wearable on an Arduino R4 Minima.
 * @version 2.1
 * @date 2025-11-15
 *
 *
 * @details This firmware performs the following tasks:
 * 1. Reads 4 analog sensors (Temp, Accel X/Y/Z) at 10Hz.
 * 2. Formats sensor data into a comma-separated string.
 * 3. Sends this data packet over Serial (9600 baud) to a Python backend.
 * 4. Listens for commands from the backend to control the LCD text and backlight colour.
 */

#include <Wire.h>
#include "rgb_lcd.h"
#include <math.h>

rgb_lcd lcd;

const int tempPin = A0;
const int accelXPin = A1;
const int accelYPin = A2;
const int accelZPin = A3;

const int B_CONST = 4275;
const float R0_CONST = 100000.0;
const float ADC_MAX = 4095.0;

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 100;

String rx_command;

/**
 * @brief Initializes all hardware, peripherals, and serial communication.
 * @details Runs once at startup. Sets ADC resolution, initializes Serial, and sets up the LCD.
 */
void setup() {
  Serial.begin(9600);
  Wire.begin();
  analogReadResolution(12);

  lcd.begin(16, 2);
  lcd.setRGB(0, 100, 255);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Online!");
  lcd.setCursor(0, 1);
  lcd.print("Waiting for PC...");

  rx_command.reserve(100);
}

/**
 * @brief Main application loop.
 * @details This loop runs continuously. It uses a non-blocking delay
 * (millis()) to send sensor data at a fixed interval and
 * constantly checks for new commands from the PC.
 */
void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= sendInterval) {
    lastSendTime = now;
    sendSensorData();
  }
  
  checkSerialCommands();
}

/**
 * @brief Reads all 4 analog sensors, calculates temperature, formats, and
 * sends the data packet over Serial.
 * @note  The data format is "T:temp,X:x,Y:y,Z:z\n".
 */
void sendSensorData() {
  /* Read all 4 analog pins */
  int temp_adc_val = analogRead(tempPin);
  int accel_x_val  = analogRead(accelXPin);
  int accel_y_val  = analogRead(accelYPin);
  int accel_z_val  = analogRead(accelZPin);
  
  /* Calculate temperature */
  float temp_C = -99.0;
  if (temp_adc_val > 0) {
    float R_thermistor = R0_CONST * (ADC_MAX / (float)temp_adc_val - 1.0);
    float log_R = log(R_thermistor / R0_CONST);
    float temp_K = 1.0 / (log_R / B_CONST + 1.0 / 298.15);
    temp_C = temp_K - 273.15;
  }

  /* Format the data string */
  String tx = "T:" + String(temp_C, 1);
  tx += ",X:" + String(accel_x_val);
  tx += ",Y:" + String(accel_y_val);
  tx += ",Z:" + String(accel_z_val);
  
  /* Send the packet with a newline */
  Serial.println(tx);
}

/**
 * @brief Checks if a complete command string has arrived over Serial.
 * @details If data is available, it reads until a newline character
 * and then passes the command to parseCommand().
 */
void checkSerialCommands() {
  if (Serial.available() > 0) {
    rx_command = Serial.readStringUntil('\n');
    rx_command.trim();
    parseCommand(rx_command);
  }
}

/**
 * @brief Processes a command string from the Python backend.
 * @param cmd The command string to parse.
 */
void parseCommand(String cmd) {
  int colonIndex = cmd.indexOf(':');
  if (colonIndex == -1) {
    Serial.println("ERR:Invalid format");
    return;
  }

  String commandType = cmd.substring(0, colonIndex);
  String commandValue = cmd.substring(colonIndex + 1);

  if (commandType == "RGB") {
    int r, g, b;
    if (sscanf(commandValue.c_str(), "%d,%d,%d", &r, &g, &b) == 3) {
      lcd.setRGB(r, g, b);
      Serial.println("ACK:RGB");
    } else {
      Serial.println("ERR:RGB parse failed");
    }
  } else if (commandType == "L") {
    lcd.clear();
    int split = commandValue.indexOf('|');
    if (split == -1) {
      lcd.setCursor(0, 0);
      lcd.print(commandValue);
    } else {
      String line1 = commandValue.substring(0, split);
      String line2 = commandValue.substring(split + 1);
      lcd.setCursor(0, 0);
      lcd.print(line1);
      lcd.setCursor(0, 1);
      lcd.print(line2);
    }
    Serial.println("ACK:L");
  } else {
    Serial.println("ERR:Unknown command");
  }
}