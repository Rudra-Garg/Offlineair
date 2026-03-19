/**
 * OfflineAir — Domain types
 * Mirror every DB table row as a TypeScript interface.
 */

// ─── Flight ──────────────────────────────────────────────────────────────────

export type FlightStatus =
  | 'PENDING'       // downloaded, not yet flying
  | 'IN_FLIGHT'     // active session
  | 'LANDED'        // flight done, awaiting sync
  | 'SYNCED';       // ADS-B data pulled, report generated

export interface Flight {
  id: number;
  flightNumber: string;
  aircraftType: string | null;
  origin: string;
  destination: string;
  status: FlightStatus;
  createdAt: number; // unix seconds
}

export type NewFlight = Omit<Flight, 'id' | 'createdAt'>;

// ─── Route ───────────────────────────────────────────────────────────────────

export interface Route {
  id: number;
  flightId: number;
  totalDistanceKm: number | null;
  filedAltitudeFt: number | null;
  cruiseSpeedKts: number | null;
}

export type NewRoute = Omit<Route, 'id'>;

// ─── Waypoint ─────────────────────────────────────────────────────────────────

export interface Waypoint {
  id: number;
  routeId: number;
  sequenceNum: number;
  ident: string;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
}

export type NewWaypoint = Omit<Waypoint, 'id'>;

// ─── SpeedProfile ────────────────────────────────────────────────────────────

export type FlightPhase = 'CLIMB' | 'CRUISE' | 'DESCENT';

export interface SpeedProfilePoint {
  id: number;
  flightId: number;
  elapsedMinutes: number;
  speedKts: number;
  altitudeFt: number;
  phase: FlightPhase;
}

export type NewSpeedProfilePoint = Omit<SpeedProfilePoint, 'id'>;

// ─── Sigmet ───────────────────────────────────────────────────────────────────

export type SigmetSeverity = 'ADVISORY' | 'WATCH' | 'WARNING';

export interface Sigmet {
  id: number;
  flightId: number;
  severity: SigmetSeverity;
  polygonGeoJSON: string; // serialised GeoJSON Polygon
  validFrom: number;      // unix seconds
  validTo: number;        // unix seconds
}

export type NewSigmet = Omit<Sigmet, 'id'>;

// ─── TrackingSession ─────────────────────────────────────────────────────────

export type SessionPhase = 'PRE_FLIGHT' | 'IN_FLIGHT' | 'LANDED';
export type SessionStatus = 'ACTIVE' | 'COMPLETE' | 'ABORTED';

export interface TrackingSession {
  id: number;
  flightId: number;
  takeoffTime: number | null; // unix seconds
  landingTime: number | null;
  phase: SessionPhase;
  status: SessionStatus;
}

export type NewTrackingSession = Omit<TrackingSession, 'id'>;

// ─── EstimatedTrackPoint ─────────────────────────────────────────────────────

export interface EstimatedTrackPoint {
  id: number;
  sessionId: number;
  timestamp: number;   // unix seconds
  latitude: number;
  longitude: number;
  altitudeFt: number;
  speedKts: number;
  isManualOverride: boolean;
}

export type NewEstimatedTrackPoint = Omit<EstimatedTrackPoint, 'id'>;

// ─── ActualTrackPoint ─────────────────────────────────────────────────────────

export type AdsSource = 'OPENSKY' | 'ADSB_EXCHANGE';

export interface ActualTrackPoint {
  id: number;
  flightId: number;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  speedKts: number;
  source: AdsSource;
}

export type NewActualTrackPoint = Omit<ActualTrackPoint, 'id'>;

// ─── DeviationReport ─────────────────────────────────────────────────────────

export interface PhaseAccuracy {
  climb: number;
  cruise: number;
  descent: number;
}

export interface DeviationReport {
  id: number;
  flightId: number;
  maxDeviationKm: number;
  avgDeviationKm: number;
  rmseKm: number;
  phaseAccuracy: PhaseAccuracy; // stored as JSON string in DB
  accuracyScore: number;
  generatedAt: number;
}

export type NewDeviationReport = Omit<DeviationReport, 'id' | 'generatedAt'>;

// ─── Landmark ─────────────────────────────────────────────────────────────────

export type LandmarkType = 'AIRPORT' | 'CITY' | 'WAYPOINT' | 'GENERIC';

export interface Landmark {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  type: LandmarkType;
}

export type NewLandmark = Omit<Landmark, 'id'>;

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType = 'LANDMARK' | 'SIGMET' | 'ETA_UPDATE';

export interface AppNotification {
  id: number;
  sessionId: number;
  triggeredAt: number;
  type: NotificationType;
  message: string;
}

export type NewAppNotification = Omit<AppNotification, 'id' | 'triggeredAt'>;

// ─── Composite helpers ────────────────────────────────────────────────────────

/** Full pre-flight bundle stored on device for a single flight. */
export interface FlightBundle {
  flight: Flight;
  route: Route;
  waypoints: Waypoint[];
  speedProfile: SpeedProfilePoint[];
  sigmets: Sigmet[];
}