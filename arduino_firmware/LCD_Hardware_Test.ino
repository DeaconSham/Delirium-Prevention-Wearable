/**
 * @file LCD_Hardware_Test.ino
 * @brief Simple LCD hardware test - NO serial communication
 * @details This minimal test verifies the LCD hardware is working.
 *          Upload this, and the LCD should cycle through different
 *          messages and colors every 2 seconds.
 */

#include <Wire.h>
#include "rgb_lcd.h"

rgb_lcd lcd;

void setup() {
  // Initialize LCD
  lcd.begin(16, 2);

  // Test 1: Red background with text
  lcd.setRGB(255, 0, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LCD Test 1");
  lcd.setCursor(0, 1);
  lcd.print("RED BACKGROUND");
  delay(2000);

  // Test 2: Green background
  lcd.setRGB(0, 255, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LCD Test 2");
  lcd.setCursor(0, 1);
  lcd.print("GREEN");
  delay(2000);

  // Test 3: Blue background
  lcd.setRGB(0, 0, 255);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LCD Test 3");
  lcd.setCursor(0, 1);
  lcd.print("BLUE");
  delay(2000);

  // Test 4: White background
  lcd.setRGB(255, 255, 255);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LCD Test 4");
  lcd.setCursor(0, 1);
  lcd.print("WHITE");
  delay(2000);
}

void loop() {
  // Test 5: Cycle through colors with counter
  static int counter = 0;

  // Red
  lcd.setRGB(255, 0, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Cycling: RED");
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(counter++);
  delay(2000);

  // Green
  lcd.setRGB(0, 255, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Cycling: GREEN");
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(counter++);
  delay(2000);

  // Blue
  lcd.setRGB(0, 0, 255);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Cycling: BLUE");
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(counter++);
  delay(2000);

  // Dim blue (like the user sees)
  lcd.setRGB(0, 0, 50);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Cycling: DIM");
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(counter++);
  delay(2000);
}
