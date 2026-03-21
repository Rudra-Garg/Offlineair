/**
 * OfflineAir — DataPipeline (v3)
 *
 * AviationAPI /preferred-routes is FAA-only (US routes).
 * For non-US routes like DEL→BOM it returns 500.
 * Removed it entirely — route is built from airport coords directly.
 *
 * OpenSky /states/all still used for speed profile (falls back to synthetic).
 * SIGMET from aviationweather.gov still used (falls back to empty).
 *
 * Every step is independently try/caught so one failure never
 * blocks the pipeline from completing.
 */

import axios, { AxiosError } from 'axios';
import { repo } from '../db/SQLiteRepository';
import { useMapViewModel } from '../store/MapViewModel';
import type {
  NewFlight,
  NewRoute,
  NewWaypoint,
  NewSpeedProfilePoint,
  NewSigmet,
  FlightPhase,
  SigmetSeverity,
} from '../db/types';

const OPENSKY_BASE = 'https://opensky-network.org/api';
const SIGMET_BASE  = 'https://aviationweather.gov/api/data';
const http = axios.create({ timeout: 15_000 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const msToKts = (ms: number) => ms * 1.94384;
const mToFt   = (m: number)  => m  * 3.28084;

function detectPhase(altFt: number, fraction: number): FlightPhase {
  if (fraction < 0.15) return 'CLIMB';
  if (fraction > 0.85) return 'DESCENT';
  if (altFt > 15_000)  return 'CRUISE';
  return fraction < 0.5 ? 'CLIMB' : 'DESCENT';
}

function parseSigmetSeverity(raw: string): SigmetSeverity {
  const s = raw.toUpperCase();
  if (s.includes('WARNING')) return 'WARNING';
  if (s.includes('WATCH'))   return 'WATCH';
  return 'ADVISORY';
}

// ─── Step 1: Build route from coords (no external API needed) ─────────────────
//
// Interpolates 5 evenly-spaced waypoints between origin and destination.
// Good enough for dead reckoning — SIGMET + geofence checks work on position,
// not on named fixes.

function buildRouteFromCoords(
  origin: string, originLat: number, originLng: number,
  destination: string, destLat: number, destLng: number,
  numIntermediates = 3,
): Array<{ fix_ident: string; latitude: number; longitude: number }> {
  const waypoints = [];
  const total = numIntermediates + 2; // origin + intermediates + destination
  for (let i = 0; i < total; i++) {
    const frac = i / (total - 1);
    if (i === 0) {
      waypoints.push({ fix_ident: origin,      latitude: originLat, longitude: originLng });
    } else if (i === total - 1) {
      waypoints.push({ fix_ident: destination, latitude: destLat,   longitude: destLng   });
    } else {
      waypoints.push({
        fix_ident: `WPT${i}`,
        latitude:  originLat + (destLat  - originLat) * frac,
        longitude: originLng + (destLng - originLng) * frac,
      });
    }
  }
  return waypoints;
}

// ─── Step 2: Speed profile from OpenSky ──────────────────────────────────────

function buildSyntheticProfile(flightId: number): NewSpeedProfilePoint[] {
  return [
    { flightId, elapsedMinutes: 0,   speedKts: 160,  altitudeFt: 1_000,  phase: 'CLIMB'   },
    { flightId, elapsedMinutes: 5,   speedKts: 250,  altitudeFt: 10_000, phase: 'CLIMB'   },
    { flightId, elapsedMinutes: 15,  speedKts: 400,  altitudeFt: 25_000, phase: 'CLIMB'   },
    { flightId, elapsedMinutes: 25,  speedKts: 450,  altitudeFt: 35_000, phase: 'CRUISE'  },
    { flightId, elapsedMinutes: 60,  speedKts: 450,  altitudeFt: 35_000, phase: 'CRUISE'  },
    { flightId, elapsedMinutes: 100, speedKts: 450,  altitudeFt: 35_000, phase: 'CRUISE'  },
    { flightId, elapsedMinutes: 115, speedKts: 380,  altitudeFt: 25_000, phase: 'DESCENT' },
    { flightId, elapsedMinutes: 125, speedKts: 280,  altitudeFt: 10_000, phase: 'DESCENT' },
    { flightId, elapsedMinutes: 135, speedKts: 180,  altitudeFt: 2_000,  phase: 'DESCENT' },
    { flightId, elapsedMinutes: 140, speedKts: 140,  altitudeFt: 0,      phase: 'DESCENT' },
  ];
}

async function fetchSpeedProfile(callsign: string, flightId: number): Promise<NewSpeedProfilePoint[]> {
  try {
    const padded = callsign.padEnd(8, ' ');
    const { data } = await http.get<{ states: unknown[][] | null }>(
      `${OPENSKY_BASE}/states/all`,
      { params: { callsign: padded } },
    );

    const states = data?.states;
    if (!states?.length) return buildSyntheticProfile(flightId);

    const airborne = states.filter(s =>
      s[8] === false && s[6] != null && s[5] != null && s[9] != null && s[7] != null && s[3] != null
    );
    if (airborne.length < 2) return buildSyntheticProfile(flightId);

    airborne.sort((a, b) => (a[3] as number) - (b[3] as number));
    const t0       = airborne[0][3] as number;
    const duration = ((airborne[airborne.length - 1][3] as number) - t0) / 60;

    return airborne.map((s): NewSpeedProfilePoint => {
      const elapsed  = ((s[3] as number) - t0) / 60;
      const altFt    = mToFt(s[7] as number);
      const fraction = duration > 0 ? elapsed / duration : 0.5;
      return {
        flightId,
        elapsedMinutes: elapsed,
        speedKts:       msToKts(s[9] as number),
        altitudeFt:     altFt,
        phase:          detectPhase(altFt, fraction),
      };
    });
  } catch (err) {
    console.warn('[DataPipeline] fetchSpeedProfile fallback:', err instanceof Error ? err.message : err);
    return buildSyntheticProfile(flightId);
  }
}

// ─── Step 3: SIGMETs ─────────────────────────────────────────────────────────

interface SigmetFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: number[][][] };
  properties: { hazard?: string; severity?: string; validTimeFrom?: string; validTimeTo?: string };
}

async function fetchSigmets(
  flightId: number,
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
): Promise<NewSigmet[]> {
  try {
    const { data } = await http.get(`${SIGMET_BASE}/isigmet`, { params: { format: 'geojson' } });
    let features: SigmetFeature[] = Array.isArray(data)
      ? data : (data?.features ?? []);

    const minLat = Math.min(originLat, destLat) - 3;
    const maxLat = Math.max(originLat, destLat) + 3;
    const minLng = Math.min(originLng, destLng) - 3;
    const maxLng = Math.max(originLng, destLng) + 3;
    const now    = Math.floor(Date.now() / 1000);

    return features
      .filter(f =>
        f.type === 'Feature' &&
        f.geometry?.coordinates?.[0]?.some(
          ([lng, lat]) => lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
        )
      )
      .map(f => {
        const validFrom = f.properties.validTimeFrom
          ? Math.floor(new Date(f.properties.validTimeFrom).getTime() / 1000) : now;
        const validTo   = f.properties.validTimeTo
          ? Math.floor(new Date(f.properties.validTimeTo).getTime()   / 1000) : now + 3600;
        return {
          flightId,
          severity:       parseSigmetSeverity(f.properties.severity ?? ''),
          polygonGeoJSON: JSON.stringify(f.geometry),
          validFrom,
          validTo,
        };
      })
      .filter(s => s.validTo >= now);
  } catch (err) {
    console.warn('[DataPipeline] fetchSigmets fallback:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface PipelineInput {
  flightNumber: string;
  origin:       string;
  destination:  string;
  originLat:    number;
  originLng:    number;
  destLat:      number;
  destLng:      number;
  aircraftType?: string;
}

export interface PipelineResult {
  flightId: number;
  success:  boolean;
  error?:   string;
}

export async function runDataPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { setDownloadProgress, setActiveFlight, setRouteData, setSpeedProfile, setSigmets } =
    useMapViewModel.getState();

  const markStep = (n: number, step: Parameters<typeof setDownloadProgress>[0]['step']) =>
    setDownloadProgress({ step, stepsComplete: n, status: 'downloading' });

  setDownloadProgress({ status: 'downloading', stepsComplete: 0, step: 'route', error: null });

  let flightId = -1;

  try {
    // ── Create or reuse Flight row ──────────────────────────────────────────
    const existing = await repo.getFlightByNumber(input.flightNumber);
    if (existing) {
      flightId = existing.id;
      await repo.clearPreflightData(flightId);
      await repo.updateFlightStatus(flightId, 'PENDING');
    } else {
      flightId = await repo.createFlight({
        flightNumber: input.flightNumber,
        aircraftType: input.aircraftType ?? null,
        origin:       input.origin,
        destination:  input.destination,
        status:       'PENDING',
      });
    }

    const flight = await repo.getFlightById(flightId);
    if (flight) setActiveFlight(flight);

    // ── Step 1: Route (local, no API) ───────────────────────────────────────
    markStep(0, 'route');

    const rawWaypoints = buildRouteFromCoords(
      input.origin,    input.originLat, input.originLng,
      input.destination, input.destLat, input.destLng,
    );
    const totalKm = haversineKm(input.originLat, input.originLng, input.destLat, input.destLng);

    const routeId = await repo.createRoute({
      flightId,
      totalDistanceKm: totalKm,
      filedAltitudeFt: 35_000,
      cruiseSpeedKts:  450,
    });

    await repo.insertWaypoints(rawWaypoints.map((w, i) => ({
      routeId,
      sequenceNum: i,
      ident:       w.fix_ident,
      latitude:    w.latitude,
      longitude:   w.longitude,
      altitudeFt:  null,
    })));

    const savedRoute     = await repo.getRouteByFlightId(flightId);
    const savedWaypoints = await repo.getWaypointsByRouteId(routeId);
    if (savedRoute) setRouteData(savedRoute, savedWaypoints);

    // ── Step 2: Speed profile ───────────────────────────────────────────────
    markStep(1, 'profile');

    const profilePoints = await fetchSpeedProfile(input.flightNumber, flightId);
    await repo.insertSpeedProfile(profilePoints);
    setSpeedProfile(await repo.getSpeedProfile(flightId));

    // ── Step 3: SIGMETs ─────────────────────────────────────────────────────
    markStep(2, 'sigmet');

    const sigmetData = await fetchSigmets(
      flightId, input.originLat, input.originLng, input.destLat, input.destLng,
    );
    if (sigmetData.length > 0) await repo.insertSigmets(sigmetData);
    setSigmets(await repo.getActiveSigmets(flightId, Math.floor(Date.now() / 1000)));

    // ── Step 4: Map tiles (Mapbox handles natively) ─────────────────────────
    markStep(3, 'tiles');
    await new Promise(r => setTimeout(r, 300));

    setDownloadProgress({ stepsComplete: 4, step: 'tiles', status: 'done', error: null });
    await repo.updateFlightStatus(flightId, 'PENDING');

    return { flightId, success: true };

  } catch (err) {
    const message = err instanceof AxiosError ? `Network error: ${err.message}`
      : err instanceof Error ? err.message
      : 'Unknown error during pre-flight download';
    setDownloadProgress({ status: 'error', error: message });
    return { flightId, success: false, error: message };
  }
}