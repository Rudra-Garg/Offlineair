/**
 * OfflineAir — DeadReckoningEngine (Expo Go safe)
 *
 * Changes from previous version:
 *  - Notifications wrapped in try/catch, skipped in Expo Go
 *  - Background task definition guarded so it doesn't crash in Expo Go
 *  - expo-background-fetch replaced with expo-background-task (per deprecation warning)
 *    but only imported dynamically so Expo Go doesn't throw at module load time
 */

import Constants from 'expo-constants';
import { repo } from '../db/SQLiteRepository';
import { useMapViewModel } from '../store/MapViewModel';
import type {
  FlightBundle,
  SpeedProfilePoint,
  Waypoint,
  Sigmet,
  FlightPhase,
  NewEstimatedTrackPoint,
  NewAppNotification,
  EstimatedTrackPoint,
} from '../db/types';
import type { LivePosition } from '../store/MapViewModel';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TASK_NAME        = 'DEAD_RECKONING_TASK';
const INTERVAL_SECONDS        = 30;
const KTS_TO_KM_PER_SEC       = 1.852 / 3600;
const EARTH_RADIUS_KM         = 6371;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ─── Haversine helpers ────────────────────────────────────────────────────────

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function interpolateSegment(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  frac: number,
): { latitude: number; longitude: number } {
  return {
    latitude:  lat1 + (lat2 - lat1) * frac,
    longitude: lng1 + (lng2 - lng1) * frac,
  };
}

// ─── Profile interpolation ────────────────────────────────────────────────────

export function interpolateProfile(
  profile: SpeedProfilePoint[],
  elapsedMinutes: number,
): { speedKts: number; altitudeFt: number; phase: FlightPhase } {
  if (profile.length === 0) return { speedKts: 450, altitudeFt: 35_000, phase: 'CRUISE' };

  if (elapsedMinutes <= profile[0].elapsedMinutes) {
    return { speedKts: profile[0].speedKts, altitudeFt: profile[0].altitudeFt, phase: profile[0].phase };
  }
  const last = profile[profile.length - 1];
  if (elapsedMinutes >= last.elapsedMinutes) {
    return { speedKts: last.speedKts, altitudeFt: last.altitudeFt, phase: last.phase };
  }

  let lo = 0, hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].elapsedMinutes <= elapsedMinutes) lo = mid; else hi = mid;
  }

  const p0 = profile[lo], p1 = profile[hi];
  const t  = (elapsedMinutes - p0.elapsedMinutes) / (p1.elapsedMinutes - p0.elapsedMinutes);

  return {
    speedKts:   p0.speedKts   + (p1.speedKts   - p0.speedKts)   * t,
    altitudeFt: p0.altitudeFt + (p1.altitudeFt - p0.altitudeFt) * t,
    phase:      t < 0.5 ? p0.phase : p1.phase,
  };
}

// ─── Waypoint walking ─────────────────────────────────────────────────────────

function buildCumulativeDistances(waypoints: Waypoint[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cum.push(cum[i - 1] + haversineKm(
      waypoints[i - 1].latitude, waypoints[i - 1].longitude,
      waypoints[i].latitude,     waypoints[i].longitude,
    ));
  }
  return cum;
}

export function positionAtDistance(
  waypoints: Waypoint[],
  cumDistances: number[],
  coveredKm: number,
): { latitude: number; longitude: number; bearing: number; remainingKm: number } {
  const totalKm  = cumDistances[cumDistances.length - 1];
  const clamped  = Math.max(0, Math.min(coveredKm, totalKm));

  let seg = cumDistances.length - 2;
  for (let i = 0; i < cumDistances.length - 1; i++) {
    if (clamped <= cumDistances[i + 1]) { seg = i; break; }
  }

  const segLen = cumDistances[seg + 1] - cumDistances[seg];
  const frac   = segLen > 0 ? (clamped - cumDistances[seg]) / segLen : 0;
  const w0     = waypoints[seg], w1 = waypoints[seg + 1];

  return {
    ...interpolateSegment(w0.latitude, w0.longitude, w1.latitude, w1.longitude, frac),
    bearing:      bearingDeg(w0.latitude, w0.longitude, w1.latitude, w1.longitude),
    remainingKm:  Math.max(0, totalKm - clamped),
  };
}

// ─── SIGMET check ─────────────────────────────────────────────────────────────

function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isInSigmet(lat: number, lng: number, sigmet: Sigmet): boolean {
  try {
    const geo = JSON.parse(sigmet.polygonGeoJSON) as { coordinates: number[][][] };
    return pointInPolygon(lat, lng, geo.coordinates?.[0] ?? []);
  } catch { return false; }
}

// ─── Notification helper (no-op in Expo Go) ───────────────────────────────────

async function fireNotification(title: string, body: string): Promise<void> {
  if (isExpoGo()) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    // silently ignore — notifications not critical to engine function
  }
}

// ─── Geofence + SIGMET checks ─────────────────────────────────────────────────

async function checkGeofences(
  sessionId: number,
  lat: number, lng: number,
  firedIds: Set<number>,
): Promise<void> {
  const nearby = await repo.getLandmarksNear(lat, lng, 50);
  const store  = useMapViewModel.getState();

  for (const lm of nearby) {
    if (firedIds.has(lm.id)) continue;
    const dist = haversineKm(lat, lng, lm.latitude, lm.longitude);
    if (dist <= lm.radiusKm) {
      firedIds.add(lm.id);
      const msg = `Passing over ${lm.name} (${Math.round(dist * 10) / 10} km)`;
      await repo.saveNotification({ sessionId, type: 'LANDMARK', message: msg });
      await fireNotification('📍 Landmark', msg);
      store.addAlert({ id: `lm-${lm.id}`, type: 'LANDMARK', message: msg, triggeredAt: Date.now() / 1000 });
    }
  }
}

async function checkSigmets(
  sessionId: number,
  lat: number, lng: number,
  sigmets: Sigmet[],
  firedIds: Set<number>,
): Promise<void> {
  const store = useMapViewModel.getState();
  const now   = Math.floor(Date.now() / 1000);

  for (const sig of sigmets) {
    if (firedIds.has(sig.id) || sig.validTo < now) continue;
    if (isInSigmet(lat, lng, sig)) {
      firedIds.add(sig.id);
      const msg = `Entering ${sig.severity} turbulence zone`;
      await repo.saveNotification({ sessionId, type: 'SIGMET', message: msg });
      await fireNotification('⚡ Turbulence Alert', msg);
      store.addAlert({ id: `sig-${sig.id}`, type: 'SIGMET', message: msg, triggeredAt: now });
    }
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class DeadReckoningEngine {
  private sessionId      = -1;
  private bundle: FlightBundle | null = null;
  private takeoffTime    = 0;
  private cumDistances: number[] = [];
  private firedLandmarkIds = new Set<number>();
  private firedSigmetIds   = new Set<number>();
  private manualOffsetKm   = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  async start(flightId: number, sessionId: number): Promise<void> {
    const bundle = await repo.getFlightBundle(flightId);
    if (!bundle)                      throw new Error(`No FlightBundle for flightId=${flightId}`);
    if (bundle.waypoints.length < 2)  throw new Error('Route needs at least 2 waypoints');

    this.bundle           = bundle;
    this.sessionId        = sessionId;
    this.takeoffTime      = Math.floor(Date.now() / 1000);
    this.cumDistances     = buildCumulativeDistances(bundle.waypoints);
    this.firedLandmarkIds = new Set();
    this.firedSigmetIds   = new Set();
    this.manualOffsetKm   = 0;

    await repo.updateSession(sessionId, { takeoffTime: this.takeoffTime, phase: 'IN_FLIGHT', status: 'ACTIVE' });
    useMapViewModel.getState().setIsTracking(true);

    await this._tick();
    this.intervalHandle = setInterval(() => { this._tick(); }, INTERVAL_SECONDS * 1000);
  }

  async stop(): Promise<void> {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    const landingTime = Math.floor(Date.now() / 1000);
    if (this.sessionId > 0) {
      await repo.updateSession(this.sessionId, { landingTime, phase: 'LANDED', status: 'COMPLETE' });
    }
    if (this.bundle) {
      await repo.updateFlightStatus(this.bundle.flight.id, 'LANDED');
    }
    useMapViewModel.getState().setIsTracking(false);
    this.bundle = null;
  }

  nudge(correctedLat: number, correctedLng: number): void {
    if (!this.bundle || !this.cumDistances.length) return;
    const now        = Math.floor(Date.now() / 1000);
    const elapsedSec = now - this.takeoffTime;
    const { speedKts } = interpolateProfile(this.bundle.speedProfile, elapsedSec / 60);
    const baseKm     = speedKts * KTS_TO_KM_PER_SEC * elapsedSec + this.manualOffsetKm;
    const totalKm    = this.cumDistances[this.cumDistances.length - 1];

    let bestDist = 0, bestErr = Infinity;
    for (let pct = 0; pct <= 1; pct += 0.001) {
      const testKm = pct * totalKm;
      const pos    = positionAtDistance(this.bundle.waypoints, this.cumDistances, testKm);
      const err    = haversineKm(correctedLat, correctedLng, pos.latitude, pos.longitude);
      if (err < bestErr) { bestErr = err; bestDist = testKm; }
    }
    this.manualOffsetKm = bestDist - baseKm;
    this._tick(true);
  }

  async tickFromBackground(): Promise<void> {
    await this._tick();
  }

  private async _tick(isManualOverride = false): Promise<void> {
    if (!this.bundle) return;
    const { waypoints, speedProfile, sigmets } = this.bundle;
    const store = useMapViewModel.getState();

    // Steps 1–3
    const nowUnix    = Math.floor(Date.now() / 1000);
    const elapsedSec = nowUnix - this.takeoffTime;
    const elapsedMin = elapsedSec / 60;
    const { speedKts, altitudeFt, phase } = interpolateProfile(speedProfile, elapsedMin);

    // Step 4
    const coveredKm = speedKts * KTS_TO_KM_PER_SEC * elapsedSec + this.manualOffsetKm;

    // Step 5
    const { latitude, longitude, bearing, remainingKm } =
      positionAtDistance(waypoints, this.cumDistances, coveredKm);

    // Step 7
    const remainingHours = speedKts > 0 ? remainingKm / (speedKts * 1.852) : 0;
    const etaUnix        = nowUnix + Math.round(remainingHours * 3600);

    // Step 8 — persist
    const point: NewEstimatedTrackPoint = {
      sessionId: this.sessionId, timestamp: nowUnix,
      latitude, longitude, altitudeFt, speedKts, isManualOverride,
    };
    await repo.appendEstimatedPoint(point);

    // Step 8 — update store
    const livePos: LivePosition = { latitude, longitude, altitudeFt, speedKts, bearing, timestamp: nowUnix, isManualOverride };
    store.updateLivePosition(livePos);
    store.setETA(etaUnix, remainingKm);
    store.setFlightPhase(phase);
    store.appendEstimatedPoint({ id: -1, ...point });

    // Step 9
    await checkGeofences(this.sessionId, latitude, longitude, this.firedLandmarkIds);
    await checkSigmets(this.sessionId, latitude, longitude, sigmets, this.firedSigmetIds);
  }
}

export const engine = new DeadReckoningEngine();

// ─── Background task (only registered in dev build / production) ──────────────

export async function registerBackgroundTask(): Promise<void> {
  if (isExpoGo()) return;
  try {
    const TaskManager = await import('expo-task-manager');
    const BackgroundTask = await import('expo-background-task');

    TaskManager.defineTask(TASK_NAME, async () => {
      try {
        await engine.tickFromBackground();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });

    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: INTERVAL_SECONDS,
    });
  } catch (err) {
    console.warn('[DRE] registerBackgroundTask failed:', err instanceof Error ? err.message : err);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  if (isExpoGo()) return;
  try {
    const TaskManager   = await import('expo-task-manager');
    const BackgroundTask = await import('expo-background-task');
    const isRegistered  = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch {}
}