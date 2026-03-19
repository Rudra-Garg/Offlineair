/**
 * OfflineAir — DatabaseProvider
 * Initialises the SQLiteRepository singleton before any screen renders.
 * Import chain: DatabaseProvider → SQLiteRepository → database (platform-split)
 * No direct expo-sqlite reference anywhere in this file.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { repo } from './SQLiteRepository';

interface DBContextValue {
  ready: boolean;
  error: Error | null;
}

const DBContext = createContext<DBContextValue>({ ready: false, error: null });

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    repo
      .init()
      .then(() => setReady(true))
      .catch(e => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (!ready && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#4A9EFF" size="large" />
      </View>
    );
  }

  return (
    <DBContext.Provider value={{ ready: ready || !!error, error }}>
      {children}
    </DBContext.Provider>
  );
}

export function useDatabase(): DBContextValue {
  return useContext(DBContext);
}