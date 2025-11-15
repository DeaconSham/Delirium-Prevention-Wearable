# Delirium Monitor Frontend MVP

React 18 + Vite implementation of the bedside delirium monitor described in `delirium-monitor-frontend-PRD.md`. The UI renders stillness timing, tiered alerts, temperature tracking, movement history, escalating alarm sounds, and a manual telemetry tester for calibration.

## Getting Started

```bash
npm install
npm run dev
```

The dev server defaults to <http://localhost:5173>. To produce an optimized bundle run `npm run build`.

### Environment Variables

Add a `.env` or `.env.local` file to configure runtime values:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Flask REST base URL | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket endpoint for live telemetry | `ws://localhost:5000/ws/telemetry` |
| `VITE_TELEMETRY_MODE` | `'ws'` (default), `'poll'`, or `'mock'` | `ws` |
| `VITE_POLL_INTERVAL_MS` | Poll interval in milliseconds when mode is `poll` | `1000` |
| `VITE_DEVICE_ID` | Device identifier used by control endpoints | `arduino-01` |

Set `VITE_TELEMETRY_MODE=mock` to keep the local simulator active.

### Backend Expectations

The frontend speaks to a Flask backend:

- WebSocket `GET ws://.../ws/telemetry` - stream telemetry samples that match the PRD JSON shape.
- REST
  - `GET /telemetry/latest` - most recent telemetry sample (or `204 No Content`).
  - `POST /device/<deviceId>/sleep` `{ "sleep": true|false }`
  - `POST /device/<deviceId>/power` `{ "switch": "on"|"off" }`
  - `POST /device/<deviceId>/acknowledge` `{ "tier": 1|2|3 }`

UI updates are optimistic; failures are logged to the console.

### Keyboard Shortcuts

- `R` - Reset stillness timer (clinical override)
- `A` - Acknowledge the current alert tier
- `S` - Snooze for 10 minutes
- `M` - Toggle mute

Shortcuts are ignored while focus is inside a text input.

## Feature Overview

- **Stillness card**: large timer, tier badge, motion indicator, and controls for reset, acknowledge, and snooze (10 or 20 minutes). Leaving sleep mode automatically clears the timer and tiers.
- **Alert logic**: 45/60/65 minute tiers, 10-second sustained movement requirement, snooze suppression, acknowledgement tracking, and escalating alarm tones (single chime, double tone, triple tone).
- **Temperature card**: current deg C / deg F reading, status chip (low, normal, elevated, fever), and a two-hour sparkline (one sample per minute).
- **Activity card**: ten-minute rolling activity history plus an "Open Graph" button that launches a dedicated movement timeline (allow pop-ups for localhost).
- **Header**: device status (on, off, sleeping, disconnected), last update, audio controls, and backend-wired power/sleep toggles.
- **Manual telemetry tester**: adjust temperature, power state, sleep, movement mode, trigger a 10 s movement burst, simulate an 8 s disconnect, or jump the stillness timer to any minute mark for fast tier testing.

## Manual Test Guide

Use the dashboard and manual tester in tandem:

1. **Baseline** - Leave movement on "Still" or jump the timer to 45 / 60 / 65 minutes to exercise specific tiers.
2. **Movement reset** - "Movement Burst (10s)" resets the timer and clears alerts after sustained motion.
3. **Tier escalation** - Let the timer advance; confirm alarm volume increases with each tier and acknowledgement silences the active tier only.
4. **Snooze** - Trigger a tier, snooze for 10 minutes, and verify visuals/audio resume after the snooze expires while the timer continues.
5. **Sleep / Awake** - Enable sleep; the UI dims and alerts pause. Disable sleep to confirm the timer resets immediately. Power off/on to verify controls disable and resume correctly.
6. **Temperature states** - Send 34.5 deg C (low), 36.8 deg C (normal), 37.9 deg C (elevated), and 38.7 deg C (fever) to validate status chips and sparkline updates.
7. **Disconnect** - Simulate an 8 s disconnect; the banner appears and alarms silence until telemetry resumes.
8. **Movement graph** - Open the external graph window and confirm the latest samples plot in time order.
9. **Accessibility** - Tab through all controls (focus outline visible) and ensure alerts announce through the `aria-live` region.

## Project Structure

- `src/hooks/useTelemetryController.ts` - central state machine: telemetry ingestion (WebSocket, poll, or mock), stillness logic, tier alerts, snooze, acknowledgement, backend control calls, and audio wiring.
- `src/services/telemetryClient.ts`, `src/services/api.ts` - transport helpers for live telemetry and REST control requests.
- `src/components/` - presentational components for the header, cards, audio engine, footer, manual tester, and graph controls.
- `src/constants.ts`, `src/utils.ts`, `src/utils/mockTelemetry.ts` - thresholds, formatting helpers, and mock sample builders.

Adjust thresholds in `src/constants.ts` or switch to mock mode for rapid prototyping, then return to WebSocket or polling once the Flask backend is live.
