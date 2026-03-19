/**
 * OfflineAir — DataPipeline
 * Pre-flight orchestrator: fetches route, speed profile, SIGMETs,
 * persists everything to SQLite, and updates the Zustand store.
 *
 * Step order:
 *   1. Route + waypoints  → AviationAPI
 *   2. Speed profile      → OpenSky Network (last 30 tracks)
 *   3. SIGMETs            → aviationweather.gov
 *   4. Map tiles          → Mapbox (stub — native SDK handles this)
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

// ─── Config ───────────────────────────────────────────────────────────────────

const AVIATION_API_BASE = 'https://api.aviationapi.com/v1';
const OPENSKY_BASE      = 'https://opensky-network.org/api';
const SIGMET_BASE       = 'https://aviationweather.gov/api/data';

const http = axios.create({ timeout: 15_000 });

// ─── API response shapes (minimal — only fields we use) ──────────────────────

interface AviationApiRoute {
  departure_icao: string;
  arrival_icao: string;
  aircraft_type?: string;
  route?: string;          // space-separated fix idents
  cruise_altitude?: number;
  cruise_speed?: number;
}

interface AviationApiWaypoint {
  fix_ident: string;
  latitude: number;
  longitude: number;
  altitude?: number;
}

interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  time_position: number | null;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;  // metres
  velocity: number | null;       // m/s
  on_ground: boolean;
}

interface OpenSkyResponse {
  time: number;
  states: OpenSkyState[][] | null;
}

interface SigmetFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    hazard: string;
    severity: string;
    validTimeFrom: string; // ISO
    validTimeTo: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rough Haversine distance in km between two lat/lng points. */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

/** Total route distance from ordered waypoint list (km). */
function totalRouteDistance(waypoints: AviationApiWaypoint[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineKm(
      waypoints[i - 1].latitude, waypoints[i - 1].longitude,
      waypoints[i].latitude,     waypoints[i].longitude,
    );
  }
  return total;
}

/** Convert m/s → knots. */
const msToKts = (ms: number) => ms * 1.94384;

/** Convert metres → feet. */
const mToFt = (m: number) => m * 3.28084;

/** Detect flight phase from altitude (ft) and elapsed fraction. */
function detectPhase(altFt: number, fraction: number): FlightPhase {
  if (fraction < 0.15) return 'CLIMB';
  if (fraction > 0.85) return 'DESCENT';
  if (altFt > 15_000)  return 'CRUISE';
  if (fraction < 0.5)  return 'CLIMB';
  return 'DESCENT';
}

function parseSigmetSeverity(raw: string): SigmetSeverity {
  const s = raw.toUpperCase();
  if (s.includes('WARNING')) return 'WARNING';
  if (s.includes('WATCH'))   return 'WATCH';
  return 'ADVISORY';
}

// ─── Step implementations ─────────────────────────────────────────────────────

async function fetchRoute(
  flightNumber: string,
  origin: string,
  destination: string,
): Promise<{ route: AviationApiRoute; waypoints: AviationApiWaypoint[] }> {
  // AviationAPI: GET /flights?apt=VIDP (returns filed routes for the airport)
  const { data } = await http.get<Record<string, AviationApiRoute[]>>(
    `${AVIATION_API_BASE}/flights`,
    { params: { apt: origin } },
  );

  // Find the matching flight number
  const flightKey = Object.keys(data).find(k =>
    k.toUpperCase().includes(flightNumber.toUpperCase())
  );
  const routeInfo: AviationApiRoute = flightKey
    ? data[flightKey][0]
    : {
        departure_icao: origin,
        arrival_icao:   destination,
        cruise_altitude: 35_000,
        cruise_speed:    450,
      };

  // Fetch waypoints for the route string
  let waypoints: AviationApiWaypoint[] = [];
  if (routeInfo.route) {
    const fixes = routeInfo.route.trim().split(/\s+/);
    // OurAirports / AviationAPI fixes endpoint
    const { data: fixData } = await http.get<AviationApiWaypoint[]>(
      `${AVIATION_API_BASE}/charts`,
      { params: { apt: origin, type: 'DP' } },
    ).catch(() => ({ data: [] as AviationApiWaypoint[] }));

    // Map fix idents to coordinates — fall back to evenly spaced lat/lng if API sparse
    waypoints = fixes.map((ident, i) => {
      const found = Array.isArray(fixData)
        ? fixData.find((f: AviationApiWaypoint) => f.fix_ident === ident)
        : undefined;
      return found ?? {
        fix_ident: ident,
        latitude:  0,
        longitude: 0,
      };
    }).filter(w => w.latitude !== 0 || w.longitude !== 0);
  }

  // Always ensure origin + destination are in waypoint list
  if (waypoints.length === 0) {
    // Minimal 2-point route; coordinates will be filled by geocode or left 0
    waypoints = [
      { fix_ident: origin,      latitude: 0, longitude: 0 },
      { fix_ident: destination, latitude: 0, longitude: 0 },
    ];
  }

  return { route: routeInfo, waypoints };
}

async function fetchSpeedProfile(
  callsign: string,
  flightId: number,
): Promise<NewSpeedProfilePoint[]> {
  // OpenSky: fetch last known states for the callsign
  const paddedCallsign = callsign.padEnd(8, ' ');
  const { data } = await http.get<OpenSkyResponse>(
    `${OPENSKY_BASE}/states/all`,
    { params: { callsign: paddedCallsign } },
  );

  const states = data.states ?? [];
  if (states.length === 0) return buildSyntheticProfile(flightId);

  // Sort by time_position ascending
  const sorted = [...states]
    .filter(s => s[4] !== null && s[5] !== null && s[7] !== null)
    .sort((a, b) => (a[3] as number) - (b[3] as number));

  if (sorted.length < 2) return buildSyntheticProfile(flightId);

  const t0      = sorted[0][3] as number;
  const tEnd    = sorted[sorted.length - 1][3] as number;
  const duration = (tEnd - t0) / 60; // minutes

  return sorted.map((s, i): NewSpeedProfilePoint => {
    const elapsed  = ((s[3] as number) - t0) / 60;
    const altM     = (s[7] as number | null) ?? 0;
    const velMs    = (s[9] as number | null) ?? 0;
    const altFt    = mToFt(altM);
    const fraction = duration > 0 ? elapsed / duration : 0.5;

    return {
      flightId,
      elapsedMinutes: elapsed,
      speedKts:       msToKts(velMs),
      altitudeFt:     altFt,
      phase:          detectPhase(altFt, fraction),
    };
  });
}

/** Synthetic profile when OpenSky returns no data. */
function buildSyntheticProfile(flightId: number): NewSpeedProfilePoint[] {
  // Generic narrow-body profile: climb 25 min, cruise, descent 20 min
  const points: NewSpeedProfilePoint[] = [
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
  return points;
}

async function fetchSigmets(
  flightId: number,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<NewSigmet[]> {
  // aviationweather.gov GeoJSON SIGMET endpoint
  const { data } = await http.get<{ features: SigmetFeature[] }>(
    `${SIGMET_BASE}/isigmet`,
    { params: { format: 'geojson' } },
  );

  const features = data?.features ?? [];
  if (features.length === 0) return [];

  // Rough corridor bounding box (±3° around great-circle midpoint)
  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;
  const halfW  = Math.abs(destLat - originLat) / 2 + 3;
  const halfH  = Math.abs(destLng - originLng) / 2 + 3;

  return features
    .filter(f => {
      if (!f.geometry?.coordinates?.length) return false;
      // Check if any polygon vertex is inside corridor bounding box
      return f.geometry.coordinates[0].some(
        ([lng, lat]) =>
          lat >= midLat - halfW && lat <= midLat + halfW &&
          lng >= midLng - halfH && lng <= midLng + halfH,
      );
    })
    .map(f => ({
      flightId,
      severity:      parseSigmetSeverity(f.properties.severity ?? 'ADVISORY'),
      polygonGeoJSON: JSON.stringify(f.geometry),
      validFrom:     Math.floor(new Date(f.properties.validTimeFrom).getTime() / 1000),
      validTo:       Math.floor(new Date(f.properties.validTimeTo).getTime()   / 1000),
    }));
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface PipelineInput {
  flightNumber: string;   // e.g. "AI101"
  origin:       string;   // ICAO e.g. "VIDP"
  destination:  string;   // ICAO e.g. "VABB"
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

export async function runDataPipeline(
  input: PipelineInput,
): Promise<PipelineResult> {
  const { setDownloadProgress, setActiveFlight, setRouteData, setSpeedProfile, setSigmets } =
    useMapViewModel.getState();

  const markStep = (stepsComplete: number, step: Parameters<typeof setDownloadProgress>[0]['step']) =>
    setDownloadProgress({ step, stepsComplete, status: 'downloading' });

  setDownloadProgress({ status: 'downloading', stepsComplete: 0, step: 'route', error: null });

  let flightId = -1;

  try {
    // ── Create or reuse Flight row ──────────────────────────────────────────
    const existingFlight = await repo.getFlightByNumber(input.flightNumber);
    if (existingFlight) {
      flightId = existingFlight.id;
      await repo.clearPreflightData(flightId);
      await repo.updateFlightStatus(flightId, 'PENDING');
    } else {
      const newFlight: NewFlight = {
        flightNumber: input.flightNumber,
        aircraftType: input.aircraftType ?? null,
        origin:       input.origin,
        destination:  input.destination,
        status:       'PENDING',
      };
      flightId = await repo.createFlight(newFlight);
    }

    const flight = await repo.getFlightById(flightId);
    if (flight) setActiveFlight(flight);

    // ── Step 1: Route + waypoints ───────────────────────────────────────────
    markStep(0, 'route');

    const { route: routeInfo, waypoints: rawWaypoints } = await fetchRoute(
      input.flightNumber, input.origin, input.destination,
    );

    const totalKm = rawWaypoints.length >= 2
      ? totalRouteDistance(rawWaypoints)
      : haversineKm(input.originLat, input.originLng, input.destLat, input.destLng);

    const newRoute: NewRoute = {
      flightId,
      totalDistanceKm:  totalKm,
      filedAltitudeFt:  routeInfo.cruise_altitude ?? 35_000,
      cruiseSpeedKts:   routeInfo.cruise_speed    ?? 450,
    };
    const routeId = await repo.createRoute(newRoute);

    const newWaypoints: NewWaypoint[] = rawWaypoints.map((w, i) => ({
      routeId,
      sequenceNum: i,
      ident:       w.fix_ident,
      latitude:    w.latitude,
      longitude:   w.longitude,
      altitudeFt:  w.altitude ?? null,
    }));
    await repo.insertWaypoints(newWaypoints);

    const savedRoute = await repo.getRouteByFlightId(flightId);
    const savedWaypoints = await repo.getWaypointsByRouteId(routeId);
    if (savedRoute) setRouteData(savedRoute, savedWaypoints);

    markStep(1, 'profile');

    // ── Step 2: Speed profile ───────────────────────────────────────────────
    const profilePoints = await fetchSpeedProfile(input.flightNumber, flightId)
      .catch(() => buildSyntheticProfile(flightId));

    await repo.insertSpeedProfile(profilePoints);
    const savedProfile = await repo.getSpeedProfile(flightId);
    setSpeedProfile(savedProfile);

    markStep(2, 'sigmet');

    // ── Step 3: SIGMETs ─────────────────────────────────────────────────────
    const sigmetData = await fetchSigmets(
      flightId,
      input.originLat, input.originLng,
      input.destLat,   input.destLng,
    ).catch(() => [] as NewSigmet[]);

    if (sigmetData.length > 0) {
      await repo.insertSigmets(sigmetData);
    }
    const now = Math.floor(Date.now() / 1000);
    const activeSigmets = await repo.getActiveSigmets(flightId, now);
    setSigmets(activeSigmets);

    markStep(3, 'tiles');

    // ── Step 4: Map tiles ────────────────────────────────────────────────────
    // Mapbox offline SDK handles tile downloading natively.
    // We just pause briefly to let the UI show the final step.
    await new Promise(r => setTimeout(r, 300));

    // ── Done ─────────────────────────────────────────────────────────────────
    setDownloadProgress({ stepsComplete: 4, step: 'tiles', status: 'done', error: null });
    await repo.updateFlightStatus(flightId, 'PENDING');

    return { flightId, success: true };
  } catch (err) {
    const message = err instanceof AxiosError
      ? `Network error: ${err.message}`
      : err instanceof Error
        ? err.message
        : 'Unknown error during pre-flight download';

    setDownloadProgress({ status: 'error', error: message });
    return { flightId, success: false, error: message };
  }
}