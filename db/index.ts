/**
 * OfflineAir — db/index.ts
 * Public barrel for the database layer.
 *
 * Intentionally does NOT re-export:
 *  - ./database.native  (platform-split file — Metro resolves it directly,
 *                        re-exporting breaks the web stub fallback)
 */

export * from './types';
export { SQLiteRepository, repo } from './SQLiteRepository';
export { DatabaseProvider, useDatabase } from './DatabaseProvider';