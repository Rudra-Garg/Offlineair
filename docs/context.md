

## What is OfflineAir?

OfflineAir is a personal mobile app (built by **Rudra Garg**, CS undergrad at IIIT Guwahati, graduating 2026) that tracks flights in real time **without internet** using dead reckoning, then — after landing — downloads the actual ADS-B flight data and compares it against the estimate to generate an accuracy report.

Think: a smarter, offline-first Flightly, with a post-flight "how accurate was my guess?" feature.

---

## Three-Phase Architecture

### Phase 1 — Pre-flight (Online)
Before boarding, the app downloads everything it needs:
- Filed route + waypoints → **AviationAPI**
- Historical speed/altitude profile (last 30 tracks) → **OpenSky Network**
- Active SIGMETs along the route → **aviationweather.gov**
- Offline map tiles for the flight corridor → **Mapbox**
- All data persisted to on-device **SQLite**

### Phase 2 — In-flight (Fully Offline)
Zero network calls. Dead reckoning engine runs every 30 seconds:
- Interpolates position along waypoints using elapsed time + speed profile
- Estimates altitude from historical altitude curve
- Recalculates ETA dynamically
- Saves every estimate as a timestamped `EstimatedTrackPoint` in SQLite
- Fires geofence notifications when crossing landmarks
- Fires turbulence alerts when entering SIGMET zones
- User can manually nudge position if needed

### Phase 3 — Post-flight (Online again)
Once back online (after ~1hr delay for ADS-B availability):
- **PostFlightSync** fetches actual ADS-B track from OpenSky by callsign + date
- Falls back to ADS-B Exchange if OpenSky data is sparse
- Normalizes raw data → saves as `ActualTrackPoints` in SQLite
- **FlightComparator** aligns both tracks by timestamp, computes:
  - Haversine deviation per point
  - Max deviation, avg deviation, RMSE
  - Per-phase accuracy (climb / cruise / descent)
  - Accuracy score: `clamp(100 - RMSE_km * 2, 0, 100)`
- Deviation map: green < 10km, amber 10–50km, red > 50km

---

## Dead Reckoning Algorithm (9 steps)

1. `elapsed = now - takeoffTime`
2. Detect phase (climb/cruise/descent) from speed profile
3. Interpolate current speed from historical profile
4. Integrate speed over time → distance covered
5. Walk waypoints accumulating Haversine distances → interpolate position
6. Interpolate altitude from historical altitude curve
7. `ETA = remainingDist / currentSpeed`
8. Append `{ timestamp, lat, lng, alt, speed, isManualOverride }` to SQLite
9. Check geofences + SIGMET polygons → fire notifications

---

## Database Schema (SQLite)

| Table | Key Fields |
|---|---|
| `Flight` | id, flightNumber, aircraftType, origin, destination, status |
| `Route` | id, flightId FK, totalDistanceKm, filedAltitudeFt, cruiseSpeedKts |
| `Waypoint` | id, routeId FK, sequenceNum, ident, latitude, longitude, altitudeFt |
| `SpeedProfile` | id, flightId FK, elapsedMinutes, speedKts, altitudeFt, phase |
| `Sigmet` | id, flightId FK, severity, polygonGeoJSON, validFrom, validTo |
| `TrackingSession` | id, flightId FK, takeoffTime, landingTime, phase, status |
| `EstimatedTrackPoint` | id, sessionId FK, timestamp, latitude, longitude, altitudeFt, speedKts, isManualOverride |
| `ActualTrackPoint` | id, flightId FK, timestamp, latitude, longitude, altitudeFt, speedKts, source |
| `DeviationReport` | id, flightId FK, maxDeviationKm, avgDeviationKm, rmseKm, phaseAccuracy, accuracyScore |
| `Landmark` | id, name, latitude, longitude, radiusKm, type |
| `Notification` | id, sessionId FK, triggeredAt, type, message |

---

## Core Classes / Modules

| Module | Responsibility |
|---|---|
| `DataPipeline` | Pre-flight: fetch route, profile, SIGMETs, trigger Mapbox tile download |
| `DeadReckoningEngine` | In-flight: position interpolation, track recording, geofence/SIGMET checks |
| `SQLiteRepository` | All DB reads/writes — single abstraction layer |
| `PostFlightSync` | Post-flight: fetch + normalize ADS-B data, retry logic, quality flagging |
| `FlightComparator` | Timestamp alignment, deviation computation, accuracy scoring, report generation |
| `NotificationService` | Background geofence + turbulence alerts via expo-notifications |
| `MapViewModel` | Zustand store — single source of truth for all UI state (in-flight + comparison) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo) |
| Language | TypeScript |
| Offline DB | SQLite via expo-sqlite |
| Maps | react-native-maps + Mapbox Offline SDK |
| Background Tasks | expo-task-manager (30s reckoning cycle) |
| Notifications | expo-notifications |
| State Management | Zustand |
| HTTP Client | axios (pre-flight + post-flight only) |
| Pre-flight APIs | AviationAPI, OpenSky Network, aviationweather.gov, OurAirports |
| Post-flight APIs | OpenSky Network REST, ADS-B Exchange (fallback) |
| Comparison Engine | Custom TypeScript — Haversine, linear interpolation, RMSE |

---

## Screens (7 total)

1. **Flight Search** — search bar, recent flights, download CTA
2. **Pre-flight Download** — circular progress ring, 4 download steps, readiness confirmation
3. **Live Tracking Map** — full-bleed dark map, route line, position dot, SIGMET overlay, bottom sheet with ALT/SPD/ETA stats + altitude graph
4. **Landmark Notification** — bottom sheet popup with landmark name, type, distance
5. **Flight Complete + Sync Prompt** — summary card, sync CTA, retry scheduling
6. **Comparison View** — dual track overlay (blue estimated, green actual), deviation coloring, timeline scrubber, phase accuracy tiles
7. **Accuracy Report Card** — score ring, RMSE/max deviation stats, per-phase bar breakdown, share button

**Design language:** Dark aviation aesthetic (`#0A0A0F` bg, `#4A9EFF` accent, `#1C1C2E` cards), glass morphism cards, Flightly-inspired premium feel.

---

## Figma Make Design

- **Figma Make file:** https://www.figma.com/make/0h7vSvKIa1aDl1Arf9nqyU/offlineAir--Community-
- Generated a React + Vite + TypeScript + Tailwind + shadcn/ui web app
- Components: `FlightSearch.tsx`, `PreFlight.tsx`, `LiveMap.tsx`, `FlightComplete.tsx`, `ComparisonView.tsx`, `AccuracyReport.tsx`
- **Note:** This is a web prototype. The real app target is React Native (Expo).

---

## GitHub Repo

- **URL:** https://github.com/Rudra-Garg/Offlineair
- Contains the Figma Make export (React web app)
- Branch: `main`

---

## Key Design Decisions & Constraints

- **No GPS in airplane mode** — all positions are estimates only, never real GPS
- **Dead reckoning error** accumulates at ~0.5–2% of distance. For a 2,000km flight, max uncorrected error ≈ 10–40km
- **ADS-B data delay** — OpenSky has ~1hr delay after landing; PostFlightSync retries automatically
- **Sparse oceanic tracks** — gaps > 30min are marked UNAVAILABLE and excluded from RMSE
- **Manual nudge** resets accumulated error by recalibrating elapsed-distance offset
- **Accuracy score formula:** `score = clamp(100 - (RMSE_km * 2), 0, 100)` — score > 80 = RMSE < 10km
- **Post-flight sync is idempotent** — re-running never duplicates ActualTrackPoints
- **All data stays on-device** — no user account, no server, no telemetry

---

## Non-Functional Requirements (key ones)

- Position update cycle < 100ms
- FlightComparator processes 1,440 points (12hr flight) in < 3 seconds
- Pre-flight download completes < 30s on 4G
- Post-flight sync completes < 15s on 4G
- Dead reckoning error < 50km for flights under 6 hours without manual correction
- Timestamp alignment between tracks within 60 seconds

---

## About the Developer

**Rudra Garg** | IIIT Guwahati, B.Tech CSE 2026 | CGPA 8.42
- Strong in: FastAPI, React, Go, Python, Docker, Kubernetes, PostgreSQL, Redis, AWS, GCP
- Has built: LOKI (offline voice assistant, F1 0.9977), MUCEDS (RL + LSTM for UAV fleet), Portal Gambit (real-time chess + WebRTC), TerraQuest (multiplayer geo game in Go)
- GitHub: https://github.com/Rudra-Garg
- Portfolio: rudragarg.dev

---

## Documents Produced (in this project)

| Document | Description |
|---|---|
| SRS v1.1 | 44 functional requirements across 7 sections, NFRs, API table |
| Architecture Doc v1.1 | Component specs, dead reckoning + comparison algorithms, build plan |
| System Architecture Diagram | DataPipeline → SQLite → DRE → PostFlightSync → FlightComparator → UI |
| Use Case Diagram | Full user journey across all 3 phases |
| Sequence Diagram | Pre-flight download, in-flight loop, post-flight sync + comparison |
| ER Diagram | 11 tables with relationships |
| UML Class Diagram | 7 core classes with method signatures |
| Data Flow Diagram | Pre-flight + post-flight external data flows |

---

## 2-Week Build Plan

| Days | Phase | Deliverables |
|---|---|---|
| 1–3 | Data Pipeline | AviationAPI + OpenSky + SIGMET fetch, SQLite schema, DataPipeline |
| 4–5 | DB & Repository | SQLiteRepository, all CRUD methods, session persistence |
| 6–8 | Dead Reckoning Engine | Core algorithm, track recording, background task, Zustand store |
| 9–10 | Map & In-flight UI | Offline map, route + position dot, SIGMET overlay, altitude graph |
| 11–12 | Post-flight Sync | PostFlightSync, OpenSky integration, retry logic, normalization |
| 13–14 | Comparison & Polish | FlightComparator, deviation map, timeline scrubber, accuracy report card |