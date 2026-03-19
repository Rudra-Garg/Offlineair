/**
 * app/download/[flightId].tsx
 * Pre-flight download screen — wired to the real DataPipeline.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, ArrowLeft, CheckCircle2, Map, Minus, Navigation, Thermometer } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { runDataPipeline } from '../../pipeline/DataPipeline';
import { airportCoords } from '../../pipeline/airports';
import { useDownloadProgress } from '../../store';

// ─── Known routes (extend or replace with a flight search API) ────────────────

const ROUTE_LOOKUP: Record<string, { origin: string; destination: string; aircraft?: string }> = {
  AI101:  { origin: 'VIDP', destination: 'VABB', aircraft: 'B777' },
  AI102:  { origin: 'VABB', destination: 'VIDP', aircraft: 'B777' },
  AI191:  { origin: 'VIDP', destination: 'VOMM', aircraft: 'A320' },
  BA234:  { origin: 'EGLL', destination: 'KJFK', aircraft: 'B747' },
  EK500:  { origin: 'OMDB', destination: 'VIDP', aircraft: 'A380' },
};

function resolveRoute(flightNumber: string) {
  const key = flightNumber.replace(/\s/g, '').toUpperCase();
  return ROUTE_LOOKUP[key] ?? { origin: 'VIDP', destination: 'VABB' };
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Route & Waypoints', icon: Navigation, key: 'route'   },
  { label: 'Speed Profile',     icon: Activity,   key: 'profile' },
  { label: 'Weather SIGMETs',   icon: Thermometer, key: 'sigmet' },
  { label: 'Offline Map Tiles', icon: Map,         key: 'tiles'  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreFlightScreen() {
  const router   = useRouter();
  const { flightId } = useLocalSearchParams();

  const idValue  = Array.isArray(flightId) ? flightId[0] : flightId;
  const rawId    = (idValue ?? 'AI101').replace('%20', '').replace(' ', '');
  const displayId = rawId.replace(/([A-Za-z]+)(\d+)/, '$1 $2');

  const progress = useDownloadProgress();
  const started  = useRef(false);

  const isReady = progress.status === 'done';
  const hasError = progress.status === 'error';

  // Kick off pipeline once on mount
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const route = resolveRoute(rawId);
    const coords = airportCoords(route.origin, route.destination);

    runDataPipeline({
      flightNumber: rawId,
      origin:       route.origin,
      destination:  route.destination,
      aircraftType: route.aircraft,
      ...coords,
    });
  }, [rawId]);

  const handleReadyToFly = () => {
    if (!isReady) return;
    router.push(`/live-map/${rawId}`);
  };

  // Convert stepsComplete to a percentage for the ring
  const pct = Math.round((progress.stepsComplete / progress.totalSteps) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 48 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <ArrowLeft color="#FFF" size={24} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginRight: 32 }}>
            {displayId} · {resolveRoute(rawId).origin} → {resolveRoute(rawId).destination}
          </Text>
        </View>

        {/* Progress Ring + Steps */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>

          {/* Circular Progress */}
          <View style={{ width: 224, height: 224, marginBottom: 48, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              position: 'absolute', width: 224, height: 224, borderRadius: 112,
              borderWidth: 12, borderColor: 'rgba(255,255,255,0.05)',
            }} />
            <View style={{
              position: 'absolute', width: 224, height: 224, borderRadius: 112,
              borderWidth: 12,
              borderTopColor:    pct >= 10 ? (hasError ? '#FF4444' : '#4A9EFF') : 'transparent',
              borderRightColor:  pct >= 35 ? (hasError ? '#FF4444' : '#4A9EFF') : 'transparent',
              borderBottomColor: pct >= 60 ? (hasError ? '#FF4444' : '#4A9EFF') : 'transparent',
              borderLeftColor:   pct >= 85 ? (hasError ? '#FF4444' : '#4A9EFF') : 'transparent',
              transform: [{ rotate: '-45deg' }],
            }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: hasError ? '#FF4444' : '#FFFFFF', fontSize: 52, fontWeight: '700', letterSpacing: -2 }}>
                {pct}
              </Text>
              <Text style={{ color: '#8E8E93', fontSize: 20, marginTop: -4 }}>%</Text>
            </View>
          </View>

          {/* Steps Card */}
          <View style={{
            width: '100%',
            backgroundColor: 'rgba(28,28,46,0.7)',
            borderRadius: 24, padding: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            {STEPS.map((s, i) => {
              const Icon    = s.icon;
              const isDone  = i < progress.stepsComplete;
              const isActive = progress.step === s.key && !isReady && !hasError;
              return (
                <View key={s.key} style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: i < 3 ? 20 : 0,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      padding: 8, borderRadius: 12, marginRight: 12,
                      backgroundColor: isDone
                        ? 'rgba(74,158,255,0.2)'
                        : isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                    }}>
                      <Icon size={20} color={isDone ? '#4A9EFF' : isActive ? '#FFF' : '#8E8E93'} />
                    </View>
                    <Text style={{
                      fontSize: 15, fontWeight: '500',
                      color: isDone ? '#FFFFFF' : isActive ? 'rgba(255,255,255,0.9)' : '#8E8E93',
                    }}>
                      {s.label}
                    </Text>
                  </View>
                  {isDone
                    ? <CheckCircle2 size={20} color="#00E676" />
                    : isActive
                      ? <ActivityIndicator size="small" color="#4A9EFF" />
                      : <Minus size={20} color="rgba(142,142,147,0.5)" />}
                </View>
              );
            })}
          </View>

          {/* Error message */}
          {hasError && (
            <Text style={{ color: '#FF4444', fontSize: 13, marginTop: 16, textAlign: 'center', paddingHorizontal: 8 }}>
              {progress.error ?? 'Download failed. Check your connection and try again.'}
            </Text>
          )}
        </View>

        {/* Bottom */}
        <View style={{ paddingTop: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 6, borderRadius: 50,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500' }}>
                {isReady
                  ? 'All steps complete'
                  : hasError
                    ? 'Download failed'
                    : `Downloading… ${progress.stepsComplete} of ${progress.totalSteps}`}
              </Text>
            </View>
          </View>

          {hasError ? (
            <TouchableOpacity
              onPress={() => { started.current = false; }}
              activeOpacity={0.8}
              style={{ backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>Retry</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleReadyToFly}
              activeOpacity={isReady ? 0.8 : 1}
              style={{
                backgroundColor: isReady ? '#4A9EFF' : 'rgba(255,255,255,0.1)',
                borderRadius: 50, paddingVertical: 16, alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: isReady ? '#FFFFFF' : '#8E8E93' }}>
                Ready to Fly
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}