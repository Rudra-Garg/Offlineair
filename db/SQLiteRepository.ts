/**
 * OfflineAir — SQLiteRepository
 * Imports from ./database which Metro resolves as:
 *   iOS/Android → database.native.ts (real expo-sqlite)
 *   web         → database.ts        (no-op stub)
 */

import { openDatabase } from './database';
import type {
  Flight, NewFlight, FlightStatus,
  Route, NewRoute,
  Waypoint, NewWaypoint,
  SpeedProfilePoint, NewSpeedProfilePoint,
  Sigmet, NewSigmet,
  TrackingSession, NewTrackingSession, SessionPhase, SessionStatus,
  EstimatedTrackPoint, NewEstimatedTrackPoint,
  ActualTrackPoint, NewActualTrackPoint,
  DeviationReport, NewDeviationReport,
  Landmark, NewLandmark,
  AppNotification, NewAppNotification,
  FlightBundle,
  PhaseAccuracy,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

// ─── Row coercions ────────────────────────────────────────────────────────────

function coerceBool(val: number | null | undefined): boolean {
  return val === 1;
}

function parsePhaseAccuracy(json: string): PhaseAccuracy {
  try { return JSON.parse(json) as PhaseAccuracy; }
  catch { return { climb: 0, cruise: 0, descent: 0 }; }
}

function rowToFlight(r: Record<string, unknown>): Flight {
  return {
    id: r.id as number, flightNumber: r.flightNumber as string,
    aircraftType: (r.aircraftType as string | null) ?? null,
    origin: r.origin as string, destination: r.destination as string,
    status: r.status as FlightStatus, createdAt: r.createdAt as number,
  };
}
function rowToRoute(r: Record<string, unknown>): Route {
  return {
    id: r.id as number, flightId: r.flightId as number,
    totalDistanceKm: (r.totalDistanceKm as number | null) ?? null,
    filedAltitudeFt: (r.filedAltitudeFt as number | null) ?? null,
    cruiseSpeedKts:  (r.cruiseSpeedKts  as number | null) ?? null,
  };
}
function rowToWaypoint(r: Record<string, unknown>): Waypoint {
  return {
    id: r.id as number, routeId: r.routeId as number,
    sequenceNum: r.sequenceNum as number, ident: r.ident as string,
    latitude: r.latitude as number, longitude: r.longitude as number,
    altitudeFt: (r.altitudeFt as number | null) ?? null,
  };
}
function rowToSpeedPoint(r: Record<string, unknown>): SpeedProfilePoint {
  return {
    id: r.id as number, flightId: r.flightId as number,
    elapsedMinutes: r.elapsedMinutes as number, speedKts: r.speedKts as number,
    altitudeFt: r.altitudeFt as number, phase: r.phase as SpeedProfilePoint['phase'],
  };
}
function rowToSession(r: Record<string, unknown>): TrackingSession {
  return {
    id: r.id as number, flightId: r.flightId as number,
    takeoffTime: (r.takeoffTime as number | null) ?? null,
    landingTime: (r.landingTime as number | null) ?? null,
    phase: r.phase as SessionPhase, status: r.status as SessionStatus,
  };
}
function rowToEstimated(r: Record<string, unknown>): EstimatedTrackPoint {
  return {
    id: r.id as number, sessionId: r.sessionId as number,
    timestamp: r.timestamp as number, latitude: r.latitude as number,
    longitude: r.longitude as number, altitudeFt: r.altitudeFt as number,
    speedKts: r.speedKts as number,
    isManualOverride: coerceBool(r.isManualOverride as number),
  };
}
function rowToActual(r: Record<string, unknown>): ActualTrackPoint {
  return {
    id: r.id as number, flightId: r.flightId as number,
    timestamp: r.timestamp as number, latitude: r.latitude as number,
    longitude: r.longitude as number, altitudeFt: r.altitudeFt as number,
    speedKts: r.speedKts as number, source: r.source as ActualTrackPoint['source'],
  };
}
function rowToDeviation(r: Record<string, unknown>): DeviationReport {
  return {
    id: r.id as number, flightId: r.flightId as number,
    maxDeviationKm: r.maxDeviationKm as number, avgDeviationKm: r.avgDeviationKm as number,
    rmseKm: r.rmseKm as number,
    phaseAccuracy: parsePhaseAccuracy(r.phaseAccuracy as string),
    accuracyScore: r.accuracyScore as number, generatedAt: r.generatedAt as number,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class SQLiteRepository {
  private db: AnyDB | null = null;

  async init(): Promise<void> {
    this.db = await openDatabase();
  }

  get isAvailable(): boolean { return this.db !== null; }

  // ── Flights ──────────────────────────────────────────────────────────────

  async createFlight(data: NewFlight): Promise<number> {
    if (!this.db) return -1;
    const r = await this.db.runAsync(
      `INSERT INTO Flight (flightNumber, aircraftType, origin, destination, status)
       VALUES (?, ?, ?, ?, ?)`,
      [data.flightNumber, data.aircraftType ?? null, data.origin, data.destination, data.status]
    );
    return r.lastInsertRowId;
  }

  async getFlightById(id: number): Promise<Flight | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync('SELECT * FROM Flight WHERE id = ?', [id]);
    return row ? rowToFlight(row) : null;
  }

  async getAllFlights(): Promise<Flight[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync('SELECT * FROM Flight ORDER BY createdAt DESC');
    return rows.map(rowToFlight);
  }

  async getFlightByNumber(flightNumber: string): Promise<Flight | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync(
      'SELECT * FROM Flight WHERE flightNumber = ? ORDER BY createdAt DESC LIMIT 1',
      [flightNumber]
    );
    return row ? rowToFlight(row) : null;
  }

  async updateFlightStatus(id: number, status: FlightStatus): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('UPDATE Flight SET status = ? WHERE id = ?', [status, id]);
  }

  async deleteFlight(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM Flight WHERE id = ?', [id]);
  }

  // ── Route ────────────────────────────────────────────────────────────────

  async createRoute(data: NewRoute): Promise<number> {
    if (!this.db) return -1;
    const r = await this.db.runAsync(
      `INSERT INTO Route (flightId, totalDistanceKm, filedAltitudeFt, cruiseSpeedKts)
       VALUES (?, ?, ?, ?)`,
      [data.flightId, data.totalDistanceKm ?? null, data.filedAltitudeFt ?? null, data.cruiseSpeedKts ?? null]
    );
    return r.lastInsertRowId;
  }

  async getRouteByFlightId(flightId: number): Promise<Route | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync('SELECT * FROM Route WHERE flightId = ?', [flightId]);
    return row ? rowToRoute(row) : null;
  }

  // ── Waypoints ────────────────────────────────────────────────────────────

  async insertWaypoints(waypoints: NewWaypoint[]): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      for (const w of waypoints) {
        await this.db.runAsync(
          `INSERT INTO Waypoint (routeId, sequenceNum, ident, latitude, longitude, altitudeFt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [w.routeId, w.sequenceNum, w.ident, w.latitude, w.longitude, w.altitudeFt ?? null]
        );
      }
    });
  }

  async getWaypointsByRouteId(routeId: number): Promise<Waypoint[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      'SELECT * FROM Waypoint WHERE routeId = ? ORDER BY sequenceNum ASC', [routeId]
    );
    return rows.map(rowToWaypoint);
  }

  // ── Speed Profile ─────────────────────────────────────────────────────────

  async insertSpeedProfile(points: NewSpeedProfilePoint[]): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      for (const p of points) {
        await this.db.runAsync(
          `INSERT INTO SpeedProfile (flightId, elapsedMinutes, speedKts, altitudeFt, phase)
           VALUES (?, ?, ?, ?, ?)`,
          [p.flightId, p.elapsedMinutes, p.speedKts, p.altitudeFt, p.phase]
        );
      }
    });
  }

  async getSpeedProfile(flightId: number): Promise<SpeedProfilePoint[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      'SELECT * FROM SpeedProfile WHERE flightId = ? ORDER BY elapsedMinutes ASC', [flightId]
    );
    return rows.map(rowToSpeedPoint);
  }

  // ── SIGMETs ───────────────────────────────────────────────────────────────

  async insertSigmets(sigmets: NewSigmet[]): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      for (const s of sigmets) {
        await this.db.runAsync(
          `INSERT INTO Sigmet (flightId, severity, polygonGeoJSON, validFrom, validTo)
           VALUES (?, ?, ?, ?, ?)`,
          [s.flightId, s.severity, s.polygonGeoJSON, s.validFrom, s.validTo]
        );
      }
    });
  }

  async getActiveSigmets(flightId: number, nowUnix: number): Promise<Sigmet[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      `SELECT * FROM Sigmet WHERE flightId = ? AND validFrom <= ? AND validTo >= ?`,
      [flightId, nowUnix, nowUnix]
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number, flightId: r.flightId as number,
      severity: r.severity as Sigmet['severity'],
      polygonGeoJSON: r.polygonGeoJSON as string,
      validFrom: r.validFrom as number, validTo: r.validTo as number,
    }));
  }

  // ── Tracking Session ──────────────────────────────────────────────────────

  async createTrackingSession(data: NewTrackingSession): Promise<number> {
    if (!this.db) return -1;
    const r = await this.db.runAsync(
      `INSERT INTO TrackingSession (flightId, takeoffTime, landingTime, phase, status)
       VALUES (?, ?, ?, ?, ?)`,
      [data.flightId, data.takeoffTime ?? null, data.landingTime ?? null, data.phase, data.status]
    );
    return r.lastInsertRowId;
  }

  async getActiveSession(flightId: number): Promise<TrackingSession | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync(
      `SELECT * FROM TrackingSession WHERE flightId = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
      [flightId]
    );
    return row ? rowToSession(row) : null;
  }

  async updateSession(
    id: number,
    updates: Partial<Pick<TrackingSession, 'takeoffTime' | 'landingTime' | 'phase' | 'status'>>
  ): Promise<void> {
    if (!this.db) return;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.takeoffTime !== undefined) { fields.push('takeoffTime = ?'); values.push(updates.takeoffTime); }
    if (updates.landingTime !== undefined) { fields.push('landingTime = ?'); values.push(updates.landingTime); }
    if (updates.phase       !== undefined) { fields.push('phase = ?');       values.push(updates.phase); }
    if (updates.status      !== undefined) { fields.push('status = ?');      values.push(updates.status); }
    if (!fields.length) return;
    values.push(id);
    await this.db.runAsync(`UPDATE TrackingSession SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  // ── Estimated Track Points ────────────────────────────────────────────────

  async appendEstimatedPoint(point: NewEstimatedTrackPoint): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO EstimatedTrackPoint
         (sessionId, timestamp, latitude, longitude, altitudeFt, speedKts, isManualOverride)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [point.sessionId, point.timestamp, point.latitude, point.longitude,
       point.altitudeFt, point.speedKts, point.isManualOverride ? 1 : 0]
    );
  }

  async getEstimatedTrack(sessionId: number): Promise<EstimatedTrackPoint[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      'SELECT * FROM EstimatedTrackPoint WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]
    );
    return rows.map(rowToEstimated);
  }

  async countEstimatedPoints(sessionId: number): Promise<number> {
    if (!this.db) return 0;
    const row = await this.db.getFirstAsync(
      'SELECT COUNT(*) as cnt FROM EstimatedTrackPoint WHERE sessionId = ?', [sessionId]
    );
    return row?.cnt ?? 0;
  }

  // ── Actual Track Points ───────────────────────────────────────────────────

  async upsertActualPoints(points: NewActualTrackPoint[]): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      for (const p of points) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO ActualTrackPoint
             (flightId, timestamp, latitude, longitude, altitudeFt, speedKts, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [p.flightId, p.timestamp, p.latitude, p.longitude, p.altitudeFt, p.speedKts, p.source]
        );
      }
    });
  }

  async getActualTrack(flightId: number): Promise<ActualTrackPoint[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      'SELECT * FROM ActualTrackPoint WHERE flightId = ? ORDER BY timestamp ASC', [flightId]
    );
    return rows.map(rowToActual);
  }

  async hasActualTrack(flightId: number): Promise<boolean> {
    if (!this.db) return false;
    const row = await this.db.getFirstAsync(
      'SELECT COUNT(*) as cnt FROM ActualTrackPoint WHERE flightId = ?', [flightId]
    );
    return (row?.cnt ?? 0) > 0;
  }

  // ── Deviation Report ──────────────────────────────────────────────────────

  async saveDeviationReport(data: NewDeviationReport): Promise<number> {
    if (!this.db) return -1;
    const r = await this.db.runAsync(
      `INSERT INTO DeviationReport
         (flightId, maxDeviationKm, avgDeviationKm, rmseKm, phaseAccuracy, accuracyScore)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.flightId, data.maxDeviationKm, data.avgDeviationKm, data.rmseKm,
       JSON.stringify(data.phaseAccuracy), data.accuracyScore]
    );
    return r.lastInsertRowId;
  }

  async getDeviationReport(flightId: number): Promise<DeviationReport | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync(
      'SELECT * FROM DeviationReport WHERE flightId = ? ORDER BY generatedAt DESC LIMIT 1',
      [flightId]
    );
    return row ? rowToDeviation(row) : null;
  }

  // ── Landmarks ─────────────────────────────────────────────────────────────

  async upsertLandmarks(landmarks: NewLandmark[]): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      for (const l of landmarks) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO Landmark (name, latitude, longitude, radiusKm, type)
           VALUES (?, ?, ?, ?, ?)`,
          [l.name, l.latitude, l.longitude, l.radiusKm, l.type]
        );
      }
    });
  }

  async getLandmarksNear(lat: number, lng: number, maxKm: number): Promise<Landmark[]> {
    if (!this.db) return [];
    const delta = maxKm / 111;
    const rows = await this.db.getAllAsync(
      `SELECT * FROM Landmark
       WHERE latitude  BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?`,
      [lat - delta, lat + delta, lng - delta, lng + delta]
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number, name: r.name as string,
      latitude: r.latitude as number, longitude: r.longitude as number,
      radiusKm: r.radiusKm as number, type: r.type as Landmark['type'],
    }));
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async saveNotification(data: NewAppNotification): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT INTO Notification (sessionId, type, message) VALUES (?, ?, ?)',
      [data.sessionId, data.type, data.message]
    );
  }

  async getNotificationsForSession(sessionId: number): Promise<AppNotification[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      'SELECT * FROM Notification WHERE sessionId = ? ORDER BY triggeredAt ASC', [sessionId]
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number, sessionId: r.sessionId as number,
      triggeredAt: r.triggeredAt as number,
      type: r.type as AppNotification['type'], message: r.message as string,
    }));
  }

  // ── Composite ─────────────────────────────────────────────────────────────

  async getFlightBundle(flightId: number): Promise<FlightBundle | null> {
    if (!this.db) return null;
    const flight = await this.getFlightById(flightId);
    if (!flight) return null;
    const route = await this.getRouteByFlightId(flightId);
    if (!route) return null;
    const [waypoints, speedProfile, sigmets] = await Promise.all([
      this.getWaypointsByRouteId(route.id),
      this.getSpeedProfile(flightId),
      this.getActiveSigmets(flightId, Math.floor(Date.now() / 1000)),
    ]);
    return { flight, route, waypoints, speedProfile, sigmets };
  }

  async clearPreflightData(flightId: number): Promise<void> {
    if (!this.db) return;
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM Sigmet WHERE flightId = ?', [flightId]);
      await this.db.runAsync('DELETE FROM SpeedProfile WHERE flightId = ?', [flightId]);
      const route = await this.getRouteByFlightId(flightId);
      if (route) {
        await this.db.runAsync('DELETE FROM Waypoint WHERE routeId = ?', [route.id]);
        await this.db.runAsync('DELETE FROM Route WHERE id = ?', [route.id]);
      }
    });
  }
}

export const repo = new SQLiteRepository();