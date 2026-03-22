/**
 * OfflineAir — FlightComparator
 *
 * Compares the dead-reckoned estimated track against the real ADS-B actual
 * track and produces a DeviationReport that gets stored in SQLite and shown
 * on the Accuracy and Comparison screens.
 *
 * Algorithm
 * ─────────
 * 1. Load estimated + actual tracks from the DB.
 * 2. For each estimated point, find the spatially-closest actual point
 *    within a ±5-minute time window (temporal nearest-neighbour matching).
 * 3. Compute per-point deviation in km using haversine.
 * 4. Derive RMSE, max, and average deviation across all matched pairs.
 * 5. Split matched pairs into CLIMB / CRUISE / DESCENT buckets using the
 *    phase labels on the speed profile, then score each phase separately.
 * 6. Compute overall accuracy score:  clamp(100 − RMSE × 2, 0, 100)
 * 7. Persist a DeviationReport row and push it into the Zustand store.
 *
 * Phase bucketing
 * ───────────────
 * Uses the SpeedProfile entries (already in the DB) to determine the
 * elapsed-minute boundaries for CLIMB / CRUISE / DESCENT, then maps each
 * estimated track point to a phase based on the session's takeoffTime.
 *
 * Phase score formula
 * ───────────────────
 *   phaseScore = clamp(100 − avgDevKm × 3, 0, 100)
 * A phase where average deviation ≤ 10 km scores ≥ 70.
 * A phase where average deviation ≤ 5 km scores ≥ 85.
 *
 * Usage
 * ─────
 *   import { runComparison } from './FlightComparator';
 *   const result = await runComparison(flightId);
 *   // result.report is now in the store and DB
 */

import { repo } from '../db/SQLiteRepository';
import { useMapViewModel } from '../store/MapViewModel';
import type {
  EstimatedTrackPoint,
  ActualTrackPoint,
  SpeedProfilePoint,
  FlightPhase,
  NewDeviationReport,
  DeviationReport,
} from '../db/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM    = 6371;
/** Maximum time gap (seconds) between estimated and actual point for a match. */
const MATCH_WINDOW_SEC   = 5 * 60; // 5 minutes

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(
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

// ─── Phase boundaries from speed profile ─────────────────────────────────────

interface PhaseBoundaries {
  climbEndMin:   number;  // elapsed minutes when CLIMB ends
  cruiseEndMin:  number;  // elapsed minutes when CRUISE ends
}

/**
 * Determine climb/cruise/descent boundaries from the speed profile.
 * Finds the last profile point still in CLIMB and the last still in CRUISE.
 * Falls back to proportional thirds if the profile is unusable.
 */
function derivePhaseBoundaries(
  profile: SpeedProfilePoint[],
  totalMinutes: number,
): PhaseBoundaries {
  if (profile.length < 2) {
    return {
      climbEndMin:  totalMinutes * 0.20,
      cruiseEndMin: totalMinutes * 0.85,
    };
  }

  let climbEndMin  = 0;
  let cruiseEndMin = 0;

  for (const pt of profile) {
    if (pt.phase === 'CLIMB')   climbEndMin  = pt.elapsedMinutes;
    if (pt.phase === 'CRUISE')  cruiseEndMin = pt.elapsedMinutes;
  }

  // Sanity: cruiseEnd must be after climbEnd
  if (cruiseEndMin <= climbEndMin) {
    cruiseEndMin = climbEndMin + (totalMinutes - climbEndMin) * 0.75;
  }

  return { climbEndMin, cruiseEndMin };
}

/**
 * Map an elapsed-minute value to a FlightPhase.
 */
function phaseAtMinute(
  elapsedMin: number,
  bounds: PhaseBoundaries,
): FlightPhase {
  if (elapsedMin <= bounds.climbEndMin)  return 'CLIMB';
  if (elapsedMin <= bounds.cruiseEndMin) return 'CRUISE';
  return 'DESCENT';
}

// ─── Nearest-neighbour matching ───────────────────────────────────────────────

interface MatchedPair {
  estimated:   EstimatedTrackPoint;
  actual:      ActualTrackPoint;
  deviationKm: number;
  phase:       FlightPhase;
}

/**
 * For each estimated point, find the actual point that is:
 *  a) within MATCH_WINDOW_SEC of it in time, AND
 *  b) the spatially closest of all such candidates.
 *
 * Actual track is pre-sorted by timestamp (guaranteed by the DB query).
 * We use a two-pointer walk to efficiently find the time window.
 */
function matchTracks(
  estimated: EstimatedTrackPoint[],
  actual:    ActualTrackPoint[],
  takeoffTimeUnix: number,
  phaseBounds: PhaseBoundaries,
): MatchedPair[] {
  if (actual.length === 0 || estimated.length === 0) return [];

  const pairs: MatchedPair[] = [];
  let lo = 0; // left edge of the actual window

  for (const est of estimated) {
    // Advance lo to drop actual points that are too far in the past
    while (lo < actual.length && actual[lo].timestamp < est.timestamp - MATCH_WINDOW_SEC) {
      lo++;
    }

    // Collect candidates within the window
    let bestDist = Infinity;
    let bestActual: ActualTrackPoint | null = null;

    for (let i = lo; i < actual.length; i++) {
      if (actual[i].timestamp > est.timestamp + MATCH_WINDOW_SEC) break;
      const dist = haversineKm(
        est.latitude,     est.longitude,
        actual[i].latitude, actual[i].longitude,
      );
      if (dist < bestDist) {
        bestDist  = dist;
        bestActual = actual[i];
      }
    }

    if (bestActual) {
      const elapsedMin = (est.timestamp - takeoffTimeUnix) / 60;
      pairs.push({
        estimated:   est,
        actual:      bestActual,
        deviationKm: bestDist,
        phase:       phaseAtMinute(elapsedMin, phaseBounds),
      });
    }
  }

  return pairs;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function rmse(deviations: number[]): number {
  if (deviations.length === 0) return 0;
  const sumSq = deviations.reduce((acc, d) => acc + d * d, 0);
  return Math.sqrt(sumSq / deviations.length);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Score a set of deviations.
 * Overall: clamp(100 − RMSE × 2, 0, 100)
 * Phase:   clamp(100 − avgDev × 3, 0, 100)
 */
function computeScore(deviations: number[], isPhase = false): number {
  if (deviations.length === 0) return 100; // no data = assume perfect
  if (isPhase) {
    return clamp(100 - mean(deviations) * 3, 0, 100);
  }
  return clamp(100 - rmse(deviations) * 2, 0, 100);
}

// ─── Public result type ───────────────────────────────────────────────────────

export interface ComparisonResult {
  success:  boolean;
  report:   DeviationReport | null;
  error?:   string;
  /** Raw matched pairs — useful for the comparison map to draw deviation lines. */
  pairs:    MatchedPair[];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run the full comparison pipeline for a completed, synced flight.
 *
 * Prerequisites:
 *  - `repo.getEstimatedTrack(sessionId)` has data (engine ran during flight)
 *  - `repo.getActualTrack(flightId)` has data (AdsbSync completed)
 *
 * The function is idempotent — calling it twice overwrites the previous report.
 */
export async function runComparison(flightId: number): Promise<ComparisonResult> {
  const store = useMapViewModel.getState();

  try {
    // ── Load flight metadata ────────────────────────────────────────────────
    const flight = await repo.getFlightById(flightId);
    if (!flight) {
      return { success: false, report: null, error: 'Flight not found', pairs: [] };
    }

    // ── Load session ────────────────────────────────────────────────────────
    const session = await repo.getActiveSession(flightId);
    if (!session) {
      return { success: false, report: null, error: 'No tracking session found', pairs: [] };
    }

    const takeoffTime  = session.takeoffTime  ?? Math.floor(Date.now() / 1000) - 7200;
    const landingTime  = session.landingTime  ?? Math.floor(Date.now() / 1000);
    const totalMinutes = (landingTime - takeoffTime) / 60;

    // ── Load estimated track ────────────────────────────────────────────────
    const estimated = await repo.getEstimatedTrack(session.id);
    if (estimated.length < 2) {
      return {
        success: false, report: null, pairs: [],
        error: 'Estimated track too short — was the engine running?',
      };
    }

    // ── Load actual track ───────────────────────────────────────────────────
    const actual = await repo.getActualTrack(flightId);
    if (actual.length < 2) {
      return {
        success: false, report: null, pairs: [],
        error: 'No actual ADS-B track found — run Sync first.',
      };
    }

    // ── Load speed profile for phase boundaries ─────────────────────────────
    const speedProfile = await repo.getSpeedProfile(flightId);
    const phaseBounds  = derivePhaseBoundaries(speedProfile, totalMinutes);

    // ── Match tracks ────────────────────────────────────────────────────────
    const pairs = matchTracks(estimated, actual, takeoffTime, phaseBounds);

    if (pairs.length === 0) {
      return {
        success: false, report: null, pairs: [],
        error: 'Could not match estimated and actual tracks — time windows may not overlap.',
      };
    }

    // ── Compute aggregate stats ─────────────────────────────────────────────
    const allDeviations = pairs.map(p => p.deviationKm);

    const maxDeviationKm = Math.max(...allDeviations);
    const avgDeviationKm = mean(allDeviations);
    const rmseKm         = rmse(allDeviations);
    const accuracyScore  = computeScore(allDeviations);

    // ── Phase-level stats ───────────────────────────────────────────────────
    const byPhase: Record<FlightPhase, number[]> = {
      CLIMB:   [],
      CRUISE:  [],
      DESCENT: [],
    };

    for (const p of pairs) {
      byPhase[p.phase].push(p.deviationKm);
    }

    const phaseAccuracy = {
      climb:   Math.round(computeScore(byPhase.CLIMB,   true)),
      cruise:  Math.round(computeScore(byPhase.CRUISE,  true)),
      descent: Math.round(computeScore(byPhase.DESCENT, true)),
    };

    // ── Persist ─────────────────────────────────────────────────────────────
    const reportData: NewDeviationReport = {
      flightId,
      maxDeviationKm,
      avgDeviationKm,
      rmseKm,
      phaseAccuracy,
      accuracyScore,
    };

    const reportId = await repo.saveDeviationReport(reportData);
    const report   = await repo.getDeviationReport(flightId);

    if (!report) {
      return { success: false, report: null, pairs, error: 'Failed to persist report' };
    }

    // ── Update store ────────────────────────────────────────────────────────
    store.setDeviationReport(report);

    return { success: true, report, pairs };

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown comparator error';
    return { success: false, report: null, pairs: [], error: message };
  }
}

// ─── Lightweight re-export of MatchedPair ─────────────────────────────────────
// Comparison screen can import this type to render deviation polylines.

export type { MatchedPair };