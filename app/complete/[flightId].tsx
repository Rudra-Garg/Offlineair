/**
 * app/complete/[flightId].tsx
 * Post-landing screen — wired to real AdsbSync.
 *
 * States:
 *  idle       → show "Sync Now" button
 *  syncing    → show spinner + progress message
 *  done       → auto-navigate to /comparison
 *  unavailable→ show "try again later" message + retry
 *  error      → show error + retry
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Wifi, AlertCircle, Clock } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { syncAdsbTrack } from '../../pipeline/AdsbSync';
import { runComparison } from '../../pipeline/FlightComparator';
import { useSyncStatus, useMapViewModel } from '../../store';

export default function FlightCompleteScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI 101');

    // Numeric flight id from the store (set during pre-flight pipeline)
    const activeFlight  = useMapViewModel(s => s.activeFlight);
    const session       = useMapViewModel(s => s.session);
    const syncStatus    = useSyncStatus();
    const syncError     = useMapViewModel(s => s.syncError);
    const setSyncStatus = useMapViewModel(s => s.setSyncStatus);

    const syncing = syncStatus === 'syncing';
    const hasError = syncStatus === 'error';
    const unavailable = syncStatus === 'unavailable';

    // Flight duration from session
    const durationLabel = (() => {
        if (!session?.takeoffTime || !session?.landingTime) return '—';
        const diffMin = Math.round((session.landingTime - session.takeoffTime) / 60);
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    })();

    const departedLabel = session?.takeoffTime
        ? new Date(session.takeoffTime * 1000).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: true,
          })
        : '—';
    const landedLabel = session?.landingTime
        ? new Date(session.landingTime * 1000).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: true,
          })
        : '—';

    // ── Auto-navigate when sync finishes ──────────────────────────────────────
    useEffect(() => {
        if (syncStatus === 'done') {
            // Short pause so user sees the success state briefly
            const t = setTimeout(() => {
                router.push(`/comparison/${displayId}`);
            }, 800);
            return () => clearTimeout(t);
        }
    }, [syncStatus, displayId, router]);

    // ── Reset sync status on mount so stale errors don't show ────────────────
    const mounted = useRef(false);
    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true;
            // Only reset if previous status was error/unavailable from a prior flight
            if (syncStatus !== 'idle' && syncStatus !== 'syncing') {
                setSyncStatus('idle');
            }
        }
    }, []);

    const handleSync = useCallback(async () => {
        if (syncing) return;
        const id = activeFlight?.id ?? -1;
        if (id < 0) {
            setSyncStatus('error', 'Could not identify flight — please restart the app.');
            return;
        }
        const syncResult = await syncAdsbTrack(id);
        // If sync succeeded, immediately run the comparator so the
        // accuracy report is ready before we navigate to comparison.
        if (syncResult.success) {
            await runComparison(id);
        }
        // Navigation to /comparison is handled by the useEffect above
    }, [syncing, activeFlight, setSyncStatus]);

    const handleSkip = useCallback(() => {
        setSyncStatus('idle');
        router.push('/');
    }, [router, setSyncStatus]);

    // ── Sync status UI helpers ────────────────────────────────────────────────
    const syncIcon = () => {
        if (syncing)      return <ActivityIndicator color="#4A9EFF" size="small" />;
        if (syncStatus === 'done') return <CheckCircle2 size={22} color="#00E676" />;
        if (hasError)     return <AlertCircle size={22} color="#F44336" />;
        if (unavailable)  return <Clock size={22} color="#FF9800" />;
        return <Wifi size={22} color="#4A9EFF" />;
    };

    const syncTitle = () => {
        if (syncing)      return 'Fetching ADS-B track…';
        if (syncStatus === 'done') return 'Track synced!';
        if (hasError)     return 'Sync failed';
        if (unavailable)  return 'Not available yet';
        return 'Sync actual flight data';
    };

    const syncSubtitle = () => {
        if (syncing)      return 'Downloading real position data from OpenSky Network';
        if (syncStatus === 'done') return 'Navigating to comparison…';
        if (hasError)     return syncError ?? 'Check your connection and try again.';
        if (unavailable)  return syncError ?? 'Data is usually available 1–2 h after landing.';
        return `Download real ADS-B track to\ncompare with your dead-reckoned estimate`;
    };

    const syncIconBg = () => {
        if (hasError)    return 'rgba(244,67,54,0.2)';
        if (unavailable) return 'rgba(255,152,0,0.2)';
        if (syncStatus === 'done') return 'rgba(0,230,118,0.2)';
        return 'rgba(74,158,255,0.2)';
    };

    const btnLabel = () => {
        if (syncing)     return 'Syncing…';
        if (hasError || unavailable) return 'Retry';
        return 'Sync Now';
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View style={{ flex: 1, padding: 24 }}>

                {/* ── Success icon ── */}
                <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 40 }}>
                    <View style={{
                        width: 96, height: 96, borderRadius: 48,
                        backgroundColor: 'rgba(0,230,118,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 24,
                    }}>
                        <CheckCircle2 color="#00E676" size={48} />
                    </View>
                    <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                        Flight Complete
                    </Text>
                    <Text style={{ color: '#8E8E93', fontWeight: '500' }}>
                        {displayId} · {activeFlight?.origin ?? 'DEL'} → {activeFlight?.destination ?? 'BOM'} · {durationLabel}
                    </Text>
                </View>

                {/* ── Stats card ── */}
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 24, padding: 24,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                    marginBottom: 40,
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Departed</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>{departedLabel}</Text>
                        </View>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Landed</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>{landedLabel}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Distance</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>
                                {activeFlight ? `${Math.round((useMapViewModel.getState().route?.totalDistanceKm ?? 0))} km` : '—'}
                            </Text>
                        </View>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Est. Accuracy</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '600', fontSize: 18, marginTop: 4 }}>
                                {syncStatus === 'done' ? 'Calculating…' : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Sync section ── */}
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 }}>
                        <View style={{
                            width: 48, height: 48, borderRadius: 24,
                            backgroundColor: syncIconBg(),
                            alignItems: 'center', justifyContent: 'center',
                            marginRight: 16, marginTop: 2,
                        }}>
                            {syncIcon()}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>
                                {syncTitle()}
                            </Text>
                            <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                                {syncSubtitle()}
                            </Text>
                        </View>
                    </View>

                    {/* Sync progress bar (visible while syncing) */}
                    {syncing && (
                        <View style={{
                            height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
                            borderRadius: 2, overflow: 'hidden', marginBottom: 20,
                        }}>
                            <View style={{
                                width: '60%', height: '100%',
                                backgroundColor: '#4A9EFF', borderRadius: 2,
                            }} />
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={handleSync}
                        activeOpacity={syncing ? 1 : 0.8}
                        disabled={syncing || syncStatus === 'done'}
                        style={{
                            backgroundColor: syncing || syncStatus === 'done'
                                ? 'rgba(74,158,255,0.4)'
                                : hasError || unavailable
                                    ? 'rgba(74,158,255,0.8)'
                                    : '#4A9EFF',
                            borderRadius: 50, paddingVertical: 16,
                            alignItems: 'center', marginBottom: 12,
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                            {btnLabel()}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSkip}
                        activeOpacity={0.6}
                        style={{ paddingVertical: 16, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#8E8E93', fontSize: 16, fontWeight: '600' }}>
                            {syncStatus === 'done' ? 'Going to comparison…' : 'Skip for now'}
                        </Text>
                    </TouchableOpacity>

                    <Text style={{
                        textAlign: 'center', color: 'rgba(142,142,147,0.5)',
                        fontSize: 11, marginTop: 8, fontWeight: '500',
                    }}>
                        ADS-B data via OpenSky Network · available ~1 h after landing
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}