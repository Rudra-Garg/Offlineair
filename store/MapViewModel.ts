/**
 * OfflineAir — MapViewModel (Zustand store)
 * Single source of truth for all in-flight and comparison UI state.
 *
 * Slices:
 *  1. Pre-flight  — loaded bundle, download progress
 *  2. In-flight   — live position, ETA, phase, track, SIGMET alerts
 *  3. Post-flight — sync status, actual track, deviation report
 *  4. UI          — bottom sheet, active tab, map camera
 */

import { create } from 'zustand';
import type {
  Flight,
  Route,
  Waypoint,
  SpeedProfilePoint,
  Sigmet,
  TrackingSession,
  EstimatedTrackPoint,
  ActualTrackPoint,
  DeviationReport,
  FlightPhase,
} from '../db/types';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LivePosition extends LatLng {
  altitudeFt: number;
  speedKts: number;
  bearing: number;       // degrees 0–360
  timestamp: number;     // unix seconds
  isManualOverride: boolean;
}

export type DownloadStep = 'route' | 'profile' | 'sigmet' | 'tiles';
export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

export interface DownloadProgress {
  step: DownloadStep | null;
  stepsComplete: number;   // 0–4
  totalSteps: number;      // always 4
  status: DownloadStatus;
  error: string | null;
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'done' | 'error' | 'unavailable';

export type ComparisonTab = 'Estimated' | 'Actual' | 'Both';

export interface MapCamera {
  center: LatLng;
  zoomLevel: number;     // platform-specific hint
  followsUser: boolean;  // auto-pan to live position
}

export interface ActiveAlert {
  id: string;            // sigmetId or landmarkId as string
  type: 'SIGMET' | 'LANDMARK';
  message: string;
  triggeredAt: number;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface MapViewModelState {
  // ── Pre-flight ──────────────────────────────────────────────────────────
  activeFlight: Flight | null;
  route: Route | null;
  waypoints: Waypoint[];
  speedProfile: SpeedProfilePoint[];
  sigmets: Sigmet[];
  downloadProgress: DownloadProgress;

  // ── In-flight ───────────────────────────────────────────────────────────
  session: TrackingSession | null;
  flightPhase: FlightPhase | null;
  livePosition: LivePosition | null;
  etaUnix: number | null;            // estimated arrival unix seconds
  remainingDistanceKm: number | null;
  estimatedTrack: EstimatedTrackPoint[];
  activeAlerts: ActiveAlert[];
  isTracking: boolean;

  // ── Post-flight ─────────────────────────────────────────────────────────
  syncStatus: SyncStatus;
  syncError: string | null;
  actualTrack: ActualTrackPoint[];
  deviationReport: DeviationReport | null;

  // ── UI ──────────────────────────────────────────────────────────────────
  bottomSheetExpanded: boolean;
  comparisonTab: ComparisonTab;
  mapCamera: MapCamera;
  scrubberPositionPct: number;       // 0.0–1.0 for timeline scrubber
}

export interface MapViewModelActions {
  // ── Pre-flight ──────────────────────────────────────────────────────────
  setActiveFlight: (flight: Flight) => void;
  setRouteData: (route: Route, waypoints: Waypoint[]) => void;
  setSpeedProfile: (profile: SpeedProfilePoint[]) => void;
  setSigmets: (sigmets: Sigmet[]) => void;
  setDownloadProgress: (progress: Partial<DownloadProgress>) => void;
  resetDownload: () => void;

  // ── In-flight ───────────────────────────────────────────────────────────
  setSession: (session: TrackingSession) => void;
  setFlightPhase: (phase: FlightPhase) => void;
  updateLivePosition: (pos: LivePosition) => void;
  setETA: (etaUnix: number, remainingKm: number) => void;
  appendEstimatedPoint: (point: EstimatedTrackPoint) => void;
  setIsTracking: (tracking: boolean) => void;
  addAlert: (alert: ActiveAlert) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;

  // ── Post-flight ─────────────────────────────────────────────────────────
  setSyncStatus: (status: SyncStatus, error?: string) => void;
  setActualTrack: (track: ActualTrackPoint[]) => void;
  setDeviationReport: (report: DeviationReport) => void;

  // ── UI ──────────────────────────────────────────────────────────────────
  setBottomSheetExpanded: (expanded: boolean) => void;
  setComparisonTab: (tab: ComparisonTab) => void;
  setMapCamera: (camera: Partial<MapCamera>) => void;
  setScrubberPosition: (pct: number) => void;

  // ── Global ──────────────────────────────────────────────────────────────
  /** Full reset — called on app launch or after flight is archived. */
  resetAll: () => void;
  /** Reset only in-flight state, keep pre-flight bundle. */
  resetInFlight: () => void;
}

export type MapViewModel = MapViewModelState & MapViewModelActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const DEFAULT_CAMERA: MapCamera = {
  center: { latitude: 20.5937, longitude: 78.9629 }, // centre of India
  zoomLevel: 5,
  followsUser: true,
};

const INITIAL_DOWNLOAD: DownloadProgress = {
  step: null,
  stepsComplete: 0,
  totalSteps: 4,
  status: 'idle',
  error: null,
};

const initialState: MapViewModelState = {
  // Pre-flight
  activeFlight: null,
  route: null,
  waypoints: [],
  speedProfile: [],
  sigmets: [],
  downloadProgress: INITIAL_DOWNLOAD,

  // In-flight
  session: null,
  flightPhase: null,
  livePosition: null,
  etaUnix: null,
  remainingDistanceKm: null,
  estimatedTrack: [],
  activeAlerts: [],
  isTracking: false,

  // Post-flight
  syncStatus: 'idle',
  syncError: null,
  actualTrack: [],
  deviationReport: null,

  // UI
  bottomSheetExpanded: false,
  comparisonTab: 'Both',
  mapCamera: DEFAULT_CAMERA,
  scrubberPositionPct: 0,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMapViewModel = create<MapViewModel>((set, get) => ({
  ...initialState,

  // ── Pre-flight actions ──────────────────────────────────────────────────

  setActiveFlight: (flight) =>
    set({ activeFlight: flight }),

  setRouteData: (route, waypoints) => {
    // Centre the map on the midpoint of the route
    const midIdx = Math.floor(waypoints.length / 2);
    const mid = waypoints[midIdx] ?? waypoints[0];
    const camera = mid
      ? { ...get().mapCamera, center: { latitude: mid.latitude, longitude: mid.longitude }, zoomLevel: 6 }
      : get().mapCamera;
    set({ route, waypoints, mapCamera: camera });
  },

  setSpeedProfile: (profile) =>
    set({ speedProfile: profile }),

  setSigmets: (sigmets) =>
    set({ sigmets }),

  setDownloadProgress: (progress) =>
    set(state => ({
      downloadProgress: { ...state.downloadProgress, ...progress },
    })),

  resetDownload: () =>
    set({ downloadProgress: INITIAL_DOWNLOAD }),

  // ── In-flight actions ───────────────────────────────────────────────────

  setSession: (session) =>
    set({ session }),

  setFlightPhase: (phase) =>
    set({ flightPhase: phase }),

  updateLivePosition: (pos) =>
    set(state => ({
      livePosition: pos,
      // If camera is following, update centre
      mapCamera: state.mapCamera.followsUser
        ? { ...state.mapCamera, center: { latitude: pos.latitude, longitude: pos.longitude } }
        : state.mapCamera,
    })),

  setETA: (etaUnix, remainingKm) =>
    set({ etaUnix, remainingDistanceKm: remainingKm }),

  appendEstimatedPoint: (point) =>
    set(state => ({
      estimatedTrack: [...state.estimatedTrack, point],
    })),

  setIsTracking: (tracking) =>
    set({ isTracking: tracking }),

  addAlert: (alert) =>
    set(state => ({
      // Deduplicate by id
      activeAlerts: state.activeAlerts.some(a => a.id === alert.id)
        ? state.activeAlerts
        : [...state.activeAlerts, alert],
    })),

  dismissAlert: (id) =>
    set(state => ({
      activeAlerts: state.activeAlerts.filter(a => a.id !== id),
    })),

  clearAlerts: () =>
    set({ activeAlerts: [] }),

  // ── Post-flight actions ─────────────────────────────────────────────────

  setSyncStatus: (status, error = undefined) =>
    set({ syncStatus: status, syncError: error ?? null }),

  setActualTrack: (track) =>
    set({ actualTrack: track }),

  setDeviationReport: (report) =>
    set({ deviationReport: report }),

  // ── UI actions ──────────────────────────────────────────────────────────

  setBottomSheetExpanded: (expanded) =>
    set({ bottomSheetExpanded: expanded }),

  setComparisonTab: (tab) =>
    set({ comparisonTab: tab }),

  setMapCamera: (camera) =>
    set(state => ({ mapCamera: { ...state.mapCamera, ...camera } })),

  setScrubberPosition: (pct) =>
    set({ scrubberPositionPct: Math.max(0, Math.min(1, pct)) }),

  // ── Global resets ───────────────────────────────────────────────────────

  resetAll: () =>
    set({ ...initialState }),

  resetInFlight: () =>
    set({
      session: null,
      flightPhase: null,
      livePosition: null,
      etaUnix: null,
      remainingDistanceKm: null,
      estimatedTrack: [],
      activeAlerts: [],
      isTracking: false,
      syncStatus: 'idle',
      syncError: null,
      actualTrack: [],
      deviationReport: null,
      scrubberPositionPct: 0,
    }),
}));

// ─── Selector hooks ───────────────────────────────────────────────────────────
// Fine-grained selectors to avoid unnecessary re-renders.

export const useLivePosition = () => useMapViewModel(s => s.livePosition);
export const useFlightPhase  = () => useMapViewModel(s => s.flightPhase);
export const useETA          = () => useMapViewModel(s => s.etaUnix);
export const useWaypoints    = () => useMapViewModel(s => s.waypoints);
export const useSigmets      = () => useMapViewModel(s => s.sigmets);
export const useActiveAlerts = () => useMapViewModel(s => s.activeAlerts);
export const useIsTracking   = () => useMapViewModel(s => s.isTracking);
export const useSyncStatus   = () => useMapViewModel(s => s.syncStatus);
export const useDeviationReport = () => useMapViewModel(s => s.deviationReport);
export const useComparisonTab   = () => useMapViewModel(s => s.comparisonTab);
export const useDownloadProgress = () => useMapViewModel(s => s.downloadProgress);
export const useEstimatedTrack  = () => useMapViewModel(s => s.estimatedTrack);
export const useActualTrack     = () => useMapViewModel(s => s.actualTrack);
export const useMapCamera       = () => useMapViewModel(s => s.mapCamera);
export const useScrubberPosition = () => useMapViewModel(s => s.scrubberPositionPct);
export const useActiveFlight    = () => useMapViewModel(s => s.activeFlight);
export const useRemainingDistance = () => useMapViewModel(s => s.remainingDistanceKm);