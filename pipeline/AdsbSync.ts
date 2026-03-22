/**
 * OfflineAir — AdsbSync
 *
 * Fetches the real ADS-B track for a completed flight from OpenSky Network
 * and stores it as ActualTrackPoint rows in SQLite.
 *
 * Flow:
 *  1. Look up the flight's takeoff/landing times from TrackingSession
 *  2. Query OpenSky /flights/callsign for the matching flight segment
 *  3. Query OpenSky /tracks/all for the full state vector track
 *  4. Downsample to ≤ 200 points and upsert into ActualTrackPoint
 *  5. Update syncStatus in MapViewModel store throughout
 *
 * OpenSky free tier limits:
 *  - /flights/callsign  → needs begin/end unix timestamps (max 7-day window)
 *  - /tracks/all        → needs icao24 + time (the departure unix second)
 *  - Unauthenticated:   400 req/day, ≥ 5 s between calls
 *
 * Falls back to ADS-B Exchange if OpenSky returns nothing (stub for now —
 * full ADSB-X integration requires a paid API key).
 */

import axios, { AxiosError } from 'axios';
import { repo } from '../db/SQLiteRepository';
import { useMapViewModel } from '../store/MapViewModel';
import type { NewActualTrackPoint } from '../db/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENSKY_BASE = 'https://opensky-network.org/api';

/** Max points to store — keeps the DB lean and comparison fast. */
const MAX_TRACK_POINTS = 200;

/** Minimum spacing between stored points (seconds). */
const MIN_POINT_INTERVAL_SEC = 30;

const http = axios.create({ timeout: 20_000 });

// ─── Types (OpenSky wire format) ──────────────────────────────────────────────

interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;   // unix seconds
  lastSeen: number;    // unix seconds
  callsign: string | null;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
}

interface OpenSkyTrack {
  icao24: string;
  startTime: number;
  endTime: number;
  /**
   * Each state vector: [time, lat, lon, altBaro, altGeo, onGround, speed, heading, ...]
   * Index:              0      1    2    3         4       5         6      7
   */
  path: Array<[number, number | null, number | null, number | null, number | null, boolean, number | null, number | null]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mToFt   = (m: number)  => m  * 3.28084;
const msToKts = (ms: number) => ms * 1.94384;

/**
 * Pad callsign to 8 characters (OpenSky requirement).
 * e.g. "AI101" → "AI101   "
 */
function padCallsign(flightNumber: string): string {
  return flightNumber.replace(/\s/g, '').toUpperCase().padEnd(8, ' ');
}

/**
 * Downsample a track array to at most `max` points,
 * also enforcing a minimum time interval between kept points.
 */
function downsample<T extends { timestamp: number }>(
  points: T[],
  max: number,
  minIntervalSec: number,
): T[] {
  if (points.length === 0) return [];

  // First pass: enforce minimum interval
  const spaced: T[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp - spaced[spaced.length - 1].timestamp >= minIntervalSec) {
      spaced.push(points[i]);
    }
  }

  // Always keep last point
  const last = points[points.length - 1];
  if (spaced[spaced.length - 1].timestamp !== last.timestamp) {
    spaced.push(last);
  }

  if (spaced.length <= max) return spaced;

  // Second pass: uniform stride
  const stride = spaced.length / max;
  const result: T[] = [];
  for (let i = 0; i < max; i++) {
    result.push(spaced[Math.round(i * stride)]);
  }
  result[result.length - 1] = spaced[spaced.length - 1]; // keep last
  return result;
}

// ─── Step 1: Find icao24 for this callsign + time window ─────────────────────

async function resolveIcao24(
  callsign: string,
  beginUnix: number,
  endUnix: number,
): Promise<string | null> {
  const padded = padCallsign(callsign);
  try {
    const { data } = await http.get<OpenSkyFlight[]>(
      `${OPENSKY_BASE}/flights/callsign`,
      {
        params: {
          callsign: padded,
          begin: beginUnix,
          end:   endUnix,
        },
      },
    );

    if (!Array.isArray(data) || data.length === 0) return null;

    // Pick the flight whose time window best overlaps our session
    const best = data.reduce((prev, curr) => {
      const prevOverlap = Math.min(prev.lastSeen, endUnix) - Math.max(prev.firstSeen, beginUnix);
      const currOverlap = Math.min(curr.lastSeen, endUnix) - Math.max(curr.firstSeen, beginUnix);
      return currOverlap > prevOverlap ? curr : prev;
    });

    return best.icao24 ?? null;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) return null;
    throw err;
  }
}

// ─── Step 2: Fetch full state-vector track ────────────────────────────────────

async function fetchTrack(
  icao24: string,
  departureUnix: number,
): Promise<OpenSkyTrack | null> {
  try {
    const { data } = await http.get<OpenSkyTrack>(
      `${OPENSKY_BASE}/tracks/all`,
      {
        params: {
          icao24,
          time: departureUnix,
        },
      },
    );
    return data ?? null;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) return null;
    throw err;
  }
}

// ─── Step 3: Parse track into ActualTrackPoint rows ───────────────────────────

function parseTrackPoints(
  track: OpenSkyTrack,
  flightId: number,
): NewActualTrackPoint[] {
  return track.path
    .filter(sv => {
      const [, lat, lon, , altGeo, onGround, speed] = sv;
      return (
        lat != null && lon != null &&
        altGeo != null && altGeo > 0 &&
        speed != null &&
        onGround === false
      );
    })
    .map(sv => {
      const [time, lat, lon, , altGeo, , speed] = sv;
      return {
        flightId,
        timestamp:  time as number,
        latitude:   lat  as number,
        longitude:  lon  as number,
        altitudeFt: mToFt(altGeo as number),
        speedKts:   msToKts(speed as number),
        source:     'OPENSKY' as const,
      };
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SyncResult {
  success:    boolean;
  pointCount: number;
  error?:     string;
}

/**
 * Sync the real ADS-B track for `flightId`.
 *
 * 1. Reads the TrackingSession to get takeoff/landing times.
 * 2. Resolves the icao24 transponder code via /flights/callsign.
 * 3. Downloads the full track via /tracks/all.
 * 4. Downsamples and stores as ActualTrackPoints.
 * 5. Keeps syncStatus in the Zustand store updated throughout.
 *
 * Callers should navigate to the comparison screen after success.
 */
export async function syncAdsbTrack(flightId: number): Promise<SyncResult> {
  const store = useMapViewModel.getState();
  store.setSyncStatus('syncing');

  try {
    // ── Resolve flight metadata ─────────────────────────────────────────────
    const flight = await repo.getFlightById(flightId);
    if (!flight) {
      store.setSyncStatus('error', 'Flight not found in database');
      return { success: false, pointCount: 0, error: 'Flight not found' };
    }

    // ── Resolve session times ───────────────────────────────────────────────
    const session = await repo.getActiveSession(flightId);

    // Use session times if available; fall back to a ±4-hour window around now
    const now       = Math.floor(Date.now() / 1000);
    const beginUnix = session?.takeoffTime ?? now - 4 * 3600;
    const endUnix   = session?.landingTime ?? now;

    // OpenSky requires at least a 1-second window
    const safeEnd = Math.max(endUnix, beginUnix + 60);

    // ── Resolve icao24 ──────────────────────────────────────────────────────
    let icao24: string | null = null;
    try {
      icao24 = await resolveIcao24(flight.flightNumber, beginUnix, safeEnd);
    } catch (err) {
      // Non-fatal: OpenSky /flights/callsign can be flaky. Try with a wider window.
      try {
        icao24 = await resolveIcao24(
          flight.flightNumber,
          beginUnix - 3600,
          safeEnd   + 3600,
        );
      } catch {
        // Fall through — icao24 stays null
      }
    }

    if (!icao24) {
      // OpenSky doesn't have this flight — mark unavailable (not an error)
      store.setSyncStatus('unavailable',
        'Flight track not found on OpenSky. Data is usually available 1–2 h after landing.');
      return {
        success:    false,
        pointCount: 0,
        error:      'Track not available yet on OpenSky',
      };
    }

    // ── Fetch full track ────────────────────────────────────────────────────
    const track = await fetchTrack(icao24, beginUnix);

    if (!track || track.path.length === 0) {
      store.setSyncStatus('unavailable',
        'OpenSky returned an empty track. Try again in a few minutes.');
      return {
        success:    false,
        pointCount: 0,
        error:      'Empty track from OpenSky',
      };
    }

    // ── Parse + downsample ──────────────────────────────────────────────────
    const rawPoints   = parseTrackPoints(track, flightId);
    const finalPoints = downsample(rawPoints, MAX_TRACK_POINTS, MIN_POINT_INTERVAL_SEC);

    if (finalPoints.length === 0) {
      store.setSyncStatus('unavailable', 'Track contained no airborne points.');
      return {
        success:    false,
        pointCount: 0,
        error:      'No airborne points in track',
      };
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    await repo.upsertActualPoints(finalPoints);
    await repo.updateFlightStatus(flightId, 'SYNCED');

    // ── Update store ────────────────────────────────────────────────────────
    const stored = await repo.getActualTrack(flightId);
    store.setActualTrack(stored);
    store.setSyncStatus('done');

    return { success: true, pointCount: finalPoints.length };

  } catch (err) {
    const message =
      err instanceof AxiosError
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown sync error';

    store.setSyncStatus('error', message);
    return { success: false, pointCount: 0, error: message };
  }
}