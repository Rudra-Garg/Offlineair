/**
 * db/database.native.ts
 * Real SQLite implementation — Metro only bundles this on iOS/Android.
 * The .native.ts suffix means web NEVER sees this file or its imports.
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'offlineair.db';
export const SCHEMA_VERSION = 1;

const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Flight (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  flightNumber    TEXT    NOT NULL,
  aircraftType    TEXT,
  origin          TEXT    NOT NULL,
  destination     TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'PENDING',
  createdAt       INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS Route (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId         INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  totalDistanceKm  REAL,
  filedAltitudeFt  INTEGER,
  cruiseSpeedKts   INTEGER
);
CREATE TABLE IF NOT EXISTS Waypoint (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  routeId     INTEGER NOT NULL REFERENCES Route(id) ON DELETE CASCADE,
  sequenceNum INTEGER NOT NULL,
  ident       TEXT    NOT NULL,
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  altitudeFt  INTEGER
);
CREATE TABLE IF NOT EXISTS SpeedProfile (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId       INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  elapsedMinutes REAL    NOT NULL,
  speedKts       REAL    NOT NULL,
  altitudeFt     REAL    NOT NULL,
  phase          TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS Sigmet (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId       INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  severity       TEXT    NOT NULL,
  polygonGeoJSON TEXT    NOT NULL,
  validFrom      INTEGER NOT NULL,
  validTo        INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS TrackingSession (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId    INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  takeoffTime INTEGER,
  landingTime INTEGER,
  phase       TEXT    NOT NULL DEFAULT 'PRE_FLIGHT',
  status      TEXT    NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS EstimatedTrackPoint (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId        INTEGER NOT NULL REFERENCES TrackingSession(id) ON DELETE CASCADE,
  timestamp        INTEGER NOT NULL,
  latitude         REAL    NOT NULL,
  longitude        REAL    NOT NULL,
  altitudeFt       REAL    NOT NULL,
  speedKts         REAL    NOT NULL,
  isManualOverride INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ActualTrackPoint (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId   INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  timestamp  INTEGER NOT NULL,
  latitude   REAL    NOT NULL,
  longitude  REAL    NOT NULL,
  altitudeFt REAL    NOT NULL,
  speedKts   REAL    NOT NULL,
  source     TEXT    NOT NULL DEFAULT 'OPENSKY'
);
CREATE TABLE IF NOT EXISTS DeviationReport (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  flightId        INTEGER NOT NULL REFERENCES Flight(id) ON DELETE CASCADE,
  maxDeviationKm  REAL    NOT NULL,
  avgDeviationKm  REAL    NOT NULL,
  rmseKm          REAL    NOT NULL,
  phaseAccuracy   TEXT    NOT NULL,
  accuracyScore   REAL    NOT NULL,
  generatedAt     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS Landmark (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL,
  radiusKm  REAL NOT NULL DEFAULT 5.0,
  type      TEXT NOT NULL DEFAULT 'GENERIC'
);
CREATE TABLE IF NOT EXISTS Notification (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId   INTEGER NOT NULL REFERENCES TrackingSession(id) ON DELETE CASCADE,
  triggeredAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  type        TEXT    NOT NULL,
  message     TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS _migrations (
  version   INTEGER PRIMARY KEY,
  appliedAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`;

let _db: SQLiteDatabase | null = null;

export async function openDatabase(): Promise<SQLiteDatabase | null> {
  if (_db) return _db;
  _db = await openDatabaseAsync(DB_NAME);
  await _db.execAsync(DDL);
  const existing = await _db.getFirstAsync(
    'SELECT version FROM _migrations WHERE version = ?', [SCHEMA_VERSION]
  );
  if (!existing) {
    await _db.runAsync('INSERT INTO _migrations (version) VALUES (?)', [SCHEMA_VERSION]);
  }
  return _db;
}

export async function closeDatabase(): Promise<void> {
  if (_db) { await _db.closeAsync(); _db = null; }
}