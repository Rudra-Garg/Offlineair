/**
 * OfflineAir — SessionManager (Expo Go safe)
 *
 * Background fetch and notifications are not available in Expo Go.
 * This version detects the environment and degrades gracefully:
 *  - Background task registration is skipped silently in Expo Go
 *  - Notifications are skipped silently in Expo Go
 *  - The foreground setInterval in DeadReckoningEngine still runs fine
 */

import Constants from 'expo-constants';
import { repo } from '../db/SQLiteRepository';
import { engine, registerBackgroundTask, unregisterBackgroundTask } from './DeadReckoningEngine';
import { useMapViewModel } from '../store/MapViewModel';
import type { NewTrackingSession } from '../db/types';

// ─── Environment check ────────────────────────────────────────────────────────

/**
 * Returns true when running inside Expo Go.
 * In a dev build or production this is false and all APIs work.
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ─── Notification setup (no-op in Expo Go) ───────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo()) return false;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export interface StartFlightOptions {
  flightId: number;
}

export interface StartFlightResult {
  sessionId: number;
  success:   boolean;
  error?:    string;
}

export async function startFlight(opts: StartFlightOptions): Promise<StartFlightResult> {
  const { flightId } = opts;
  const store = useMapViewModel.getState();

  try {
    await requestNotificationPermissions();

    const sessionData: NewTrackingSession = {
      flightId,
      takeoffTime: null,
      landingTime: null,
      phase:  'PRE_FLIGHT',
      status: 'ACTIVE',
    };
    const sessionId = await repo.createTrackingSession(sessionData);

    const session = await repo.getActiveSession(flightId);
    if (session) store.setSession(session);

    await engine.start(flightId, sessionId);

    if (!isExpoGo()) {
      await registerBackgroundTask().catch(err =>
        console.warn('[SessionManager] Background task skipped:', err?.message)
      );
    }

    await repo.updateFlightStatus(flightId, 'IN_FLIGHT');

    return { sessionId, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start flight';
    return { sessionId: -1, success: false, error: message };
  }
}

export async function stopFlight(): Promise<void> {
  await engine.stop();
  if (!isExpoGo()) {
    await unregisterBackgroundTask().catch(() => {});
  }
}

export function nudgePosition(lat: number, lng: number): void {
  engine.nudge(lat, lng);
}