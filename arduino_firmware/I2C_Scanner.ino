/**
 * @file I2C_Scanner.ino
 * @brief I2C Address Scanner
 * @details Scans the I2C bus and reports all detected devices.
 *          Use this to verify your RGB LCD is connected and responding.
 *
 * Expected I2C addresses for Grove RGB LCD:
 *  - 0x3E (62 decimal) - RGB backlight controller
 *  - 0x7C (124 decimal) - LCD display controller
 *
 * Upload this sketch and open Serial Monitor at 9600 baud.
 */

#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(9600);

  while (!Serial) {
    ; // wait for serial port to connect
  }

  Serial.println("\n\n");
  Serial.println("=================================");
  Serial.println("I2C Scanner for Arduino R4 Minima");
  Serial.println("=================================");
  Serial.println();
  Serial.println("Expected for Grove RGB LCD:");
  Serial.println("  - 0x3E (RGB controller)");
  Serial.println("  - 0x7C (LCD controller)");
  Serial.println();
  Serial.println("Scanning I2C bus...");
  Serial.println();
}

void loop() {
  byte error, address;
  int deviceCount = 0;

  Serial.println("Starting scan...");

  for (address = 1; address < 127; address++) {
    // The i2c_scanner uses the return value of the Write.endTransmission
    // to see if a device acknowledged the address.
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.print(address, HEX);
      Serial.print(" (");
      Serial.print(address);
      Serial.print(" decimal)");

      // Identify known devices
      if (address == 0x3E) {
        Serial.print(" <- RGB Backlight Controller");
      } else if (address == 0x7C) {
        Serial.print(" <- LCD Display Controller");
      }

      Serial.println();
      deviceCount++;
    } else if (error == 4) {
      Serial.print("Unknown error at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.println(address, HEX);
    }
  }

  Serial.println();
  if (deviceCount == 0) {
    Serial.println("!!! No I2C devices found !!!");
    Serial.println();
    Serial.println("Check:");
    Serial.println("  1. SDA wire is connected to SDA pin");
    Serial.println("  2. SCL wire is connected to SCL pin");
    Serial.println("  3. VCC is connected to 5V");
    Serial.println("  4. GND is connected to GND");
    Serial.println("  5. Wires are not loose or broken");
  } else {
    Serial.print("Found ");
    Serial.print(deviceCount);
    Serial.println(" device(s)");

    if (deviceCount == 2) {
      Serial.println();
      Serial.println("✓ Both I2C devices detected!");
      Serial.println("✓ RGB LCD should be working");
    } else if (deviceCount < 2) {
      Serial.println();
      Serial.println("⚠ Warning: Expected 2 devices for RGB LCD");
      Serial.println("⚠ Check connections or try different I2C addresses");
    }
  }

  Serial.println();
  Serial.println("Scan complete. Waiting 5 seconds before next scan...");
  Serial.println("=================================");
  Serial.println();

  delay(5000); // Wait 5 seconds before next scan
}
