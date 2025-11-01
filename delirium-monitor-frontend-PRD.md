# Delirium Monitor - Frontend PRD

## 1. Summary
A bedside web app that displays patient movement and temperature from an Arduino device. The app tracks stillness duration and triggers tiered alerts when the patient has been still for too long. It supports a sleep mode and a physical on/off switch. Built with ReactJS, HTML, and CSS.

## 2. Goals
- Show a live stillness timer since last detected movement.
- Trigger tiered prompts with sound and visual alerts at configured thresholds around 1 hour of stillness.
- Display live body temperature and status.
- Respect device sleep mode and on/off switch states.
- Provide a clear, accessible, low cognitive load UI suitable for clinical use.

## 3. Non-Goals
- No clinical decision support beyond basic alerts.
- No electronic health record integration in this version.
- No persistent cloud storage. Local storage only for UI preferences.

## 4. Users and Use Cases
- Bedside nurse or caregiver monitors a patient in real time.
- Family member monitors stillness and temperature during visits.
- Technician verifies sensor operation and calibrates thresholds.

## 5. Assumptions
- Arduino provides motion and temperature data at 1 Hz or similar.
- A bridge provides the data to the browser. Two options are supported:
  - Web Serial API in the browser with user permission.
  - Local service that reads serial and exposes a WebSocket.
- Device has a physical on/off switch reported in the data stream.

## 6. Hardware Inputs
- Accelerometer vector magnitude or 3 axes.
- Temperature sensor in Celsius.
- On/off switch state.
- Optional device battery and device health status.

## 7. Data and Interface Contracts
### 7.1 WebSocket message schema (recommended)
```json
{
  "ts": 1730442000123,
  "accel": { "x": 0.01, "y": -0.02, "z": 0.98, "mag": 0.98 },
  "temp_c": 36.7,
  "switch": "on",
  "sleep": false,
  "device_id": "arduino-01",
  "rssi": -50,
  "battery": 0.82
}
```

### 7.2 Web Serial line format (alternative)
- One JSON object per line with the same fields as above.
- Newline terminated. UTF-8.

### 7.3 Frontend derived state
- `motionDetected` boolean from accelerometer processing.
- `stillnessSeconds` integer seconds since last motion event.
- `temperatureStatus` enum: normal, elevated, fever, low.
- `deviceStatus` enum: on, off, sleeping, disconnected.

### 7.4 TypeScript interfaces
```ts
export type SwitchState = "on" | "off";
export type DeviceStatus = "on" | "off" | "sleeping" | "disconnected";
export type TempStatus = "normal" | "elevated" | "fever" | "low";

export interface Telemetry {
  ts: number;
  accel: { x: number; y: number; z: number; mag?: number };
  temp_c: number;
  switch: SwitchState;
  sleep?: boolean;
  device_id?: string;
  rssi?: number;
  battery?: number; // 0 to 1
}
```

## 8. Motion Detection and Stillness Logic
### 8.1 Definitions
- Baseline noise window: 5 seconds at startup to estimate noise.
- Movement threshold: `magDelta > 0.05 g` for at least 2 seconds within a 3 second window.
- Reset rule: when movement is detected, set `stillnessSeconds = 0`.
- Increment rule: when no movement detected, increment `stillnessSeconds` by elapsed seconds.
- Debounce: require 1 second continuous quiet before resuming stillness count after movement.

### 8.2 Alert tiers
| Tier | Trigger time | Visual | Audio | User actions |
| --- | --- | --- | --- | --- |
| 0 | < 45 min | Normal UI | None | None |
| 1 | 45 min stillness | Yellow banner and badge on timer | Soft chime once | Acknowledge or Snooze 10 min |
| 2 | 60 min stillness | Orange modal with countdown | Medium chime repeating every 60 s until ack | Acknowledge or Snooze 10 or 20 min |
| 3 | 65 min stillness | Red modal and flashing header | Escalation tone repeating every 30 s until ack | Acknowledge only |

- When acknowledged, keep the timer running. Acknowledge dismisses visuals and silences audio until the next tier threshold.
- When snoozed, pause alerts for the snooze duration. Timer continues.

### 8.3 False positive protection
- Require sustained movement to reset timer: movement above threshold for 2 seconds.
- Ignore spikes shorter than 200 ms.
- Provide a manual Reset button for clinical override.

## 9. Sleep Mode and Switch State
- Sleep mode can be set by the device or via the UI control. When sleeping:
  - UI dims and shows a Sleep badge.
  - Stillness alerts are disabled.
  - Temperature is still shown.
- On/off switch:
  - Off: show Device Off state, stop all timers and alerts, keep last readings grayed out.
  - On: normal operation.

## 10. Temperature Tracking
- Display current temperature and trend over the last 2 hours.
- Status logic:
  - Low: < 35.0 C.
  - Normal: 36.1 C to 37.5 C.
  - Elevated: 37.6 C to 37.9 C.
  - Fever: >= 38.0 C.
- Visuals: color coded chip and small sparkline.

## 11. UI and UX Requirements
- Clean single page layout with large readable text.
- Sections:
  - Header: device name, connection status, battery, on/off and sleep toggles.
  - Stillness card: big timer, tier badge, Reset, Acknowledge, Snooze controls.
  - Temperature card: current value, status pill, sparkline.
  - Activity card: 10 minute rolling activity bars.
  - Footer: last update time, debug link.
- Sound settings: volume slider, Mute checkbox. Mute requires re-enable confirmation.
- Always show connection status. If disconnected for more than 5 seconds, show a reconnect banner.
- WCAG AA contrast and keyboard operability. Focus outline required.

## 12. Component Tree and Props
```
<App>
  <Header status props... />
  <MainGrid>
    <StillnessCard
      stillnessSeconds
      tier
      onAcknowledge()
      onSnooze(minutes)
      onReset()
      muted
      volume
    />
    <TemperatureCard tempC status history[] />
    <ActivityCard samples[] />
  </MainGrid>
  <Footer lastUpdate connected />
  <AudioEngine tier muted volume />
  <ConnectionProvider useWebSerial|useWebSocket url />
</App>
```

## 13. State Machine
- States: `disconnected`, `on`, `sleeping`, `off`.
- Transitions:
  - `disconnected` to `on` when data arrives and switch is on.
  - `on` to `sleeping` when sleep flag true or user sets sleep.
  - `sleeping` to `on` when sleep false.
  - Any to `off` when switch off.

## 14. Configuration
- `ALERT_TIER1_MINUTES` default 45.
- `ALERT_TIER2_MINUTES` default 60.
- `ALERT_TIER3_MINUTES` default 65.
- Movement threshold and debounce values.
- Use localStorage for user preferences: mute, volume, snooze choices.

## 15. Error Handling
- If data is stale for more than 5 seconds, show Disconnected and stop sounds.
- If temperature value is invalid or missing, show N/A for temperature.
- If accelerometer data missing, pause stillness timer and mark N/A.

## 16. Accessibility
- Keyboard shortcuts:
  - A for Acknowledge
  - S for Snooze
  - R for Reset
  - M for Mute
- Visible focus and ARIA roles for alerts and live regions.
- Audio alerts paired with visual equivalents.

## 17. Security and Privacy
- No patient identifiers in the UI or logs.
- All data stays local on the device running the browser.
- If WebSocket is used, restrict to localhost by default.

## 18. Performance Targets
- Render updates within 100 ms of message receipt.
- Handle 10 messages per second without UI stutter.
- Audio start within 200 ms of tier trigger.

## 19. Telemetry and Debug
- Optional debug panel shows raw messages per second, last sample, and computed thresholds.
- Log alert transitions in memory for the current session.

## 20. Testing and Acceptance Criteria
- Unit tests for motion detection and tier logic using synthetic sequences.
- Manual tests:
  - Movement resets timer.
  - No movement hits Tier 1 at 45 min ± 5 s.
  - Tier 2 at 60 min ± 5 s with repeat until ack.
  - Tier 3 at 65 min ± 5 s with repeat until ack.
  - Snooze pauses alerts for the selected duration.
  - Sleep suppresses alerts and dims UI while showing temperature.
  - Switch off shows Device Off and disables controls.
  - Disconnection shows banner and silences audio.
- Accessibility checks pass with keyboard only navigation and screen reader announcements for alerts.

## 21. Implementation Notes for Codex
- Tech stack: React 18 with Vite, plain CSS or Tailwind is acceptable, no design system required.
- Provide a lightweight `AudioEngine` that maps tiers to audio patterns using Web Audio API.
- Provide an abstraction `ConnectionProvider` that supports WebSocket and Web Serial behind the same interface.
- Use a small state container with React context or Zustand.
- Include a feature flag file for thresholds and toggles.

## 22. Milestones
- M1: Skeleton UI with mock data and timers.
- M2: Motion detection, stillness timer, tier alerts with audio and controls.
- M3: Temperature status and sparkline.
- M4: Sleep mode, on/off handling, disconnect handling.
- M5: Accessibility polish and test plan.

## 23. Open Questions
- Confirm accelerometer units and sampling rate.
- Confirm whether sleep mode should keep counting timer silently or pause timer.
- Confirm hospital audio volume constraints.
- Confirm whether Tier 3 should notify an external system in a future version.

## 24. Appendix A - Sample Messages
```json
{"ts": 1730442000123, "accel": {"x": 0.00, "y": 0.01, "z": 1.00}, "temp_c": 36.6, "switch": "on", "sleep": false}
{"ts": 1730442060123, "accel": {"x": 0.35, "y": 0.10, "z": 0.88}, "temp_c": 36.7, "switch": "on", "sleep": false}
{"ts": 1730442120123, "accel": {"x": 0.01, "y": 0.01, "z": 1.00}, "temp_c": 37.8, "switch": "on", "sleep": false}
```
