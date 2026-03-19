/**
 * db/database.ts
 * Web fallback — Metro uses this on web because .native.ts takes priority
 * on iOS/Android. This file has ZERO reference to expo-sqlite.
 */

export const DB_NAME = 'offlineair.db';
export const SCHEMA_VERSION = 1;

export async function openDatabase(): Promise<null> {
  console.warn('[OfflineAir] SQLite is not available on web. All DB operations are no-ops.');
  return null;
}

export async function closeDatabase(): Promise<void> {
  // no-op on web
}