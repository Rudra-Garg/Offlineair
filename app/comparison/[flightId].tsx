/**
 * app/comparison/[flightId].tsx
 *
 * Real flight comparison screen.
 *
 * Map layers (toggled by tab):
 *   Estimated  → blue dashed polyline from estimatedTrack
 *   Actual     → green solid polyline from actualTrack
 *   Both       → both polylines + deviation markers coloured by distance:
 *                  green  < 10 km
 *                  orange 10–50 km
 *                  red    > 50 km
 *
 * Data sources (all from Zustand store, populated before navigation):
 *   estimatedTrack  — EstimatedTrackPoint[]  (engine wrote these during flight)
 *   actualTrack     — ActualTrackPoint[]      (AdsbSync fetched these)
 *   deviationReport — DeviationReport         (FlightComparator produced this)
 *
 * MatchedPair deviation lines are re-computed here from the two tracks
 * using the same nearest-neighbour logic as FlightComparator, but only
 * for rendering — we never re-persist from this screen.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    useActualTrack,
    useDeviationReport,
    useEstimatedTrack,
    useMapViewModel,
    useWaypoints,
} from '@/store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
    latitude: number;
    longitude: number;
}

interface DeviationMarker {
    estimated: LatLng;
    actual:    LatLng;
    distKm:    number;
}

type ComparisonTab = 'Estimated' | 'Actual' | 'Both';

// ─── Constants ────────────────────────────────────────────────────────────────

const MATCH_WINDOW_SEC = 5 * 60;

const darkMapStyle = [
    { elementType: 'geometry',            stylers: [{ color: '#0A0A0F' }] },
    { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill',    stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deviationColor(km: number): string {
    if (km < 10)  return '#00E676';
    if (km < 50)  return '#FF9800';
    return '#F44336';
}

function fmt(km: number | undefined): string {
    if (km == null) return '--';
    return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function scoreColor(score: number): string {
    if (score >= 80) return '#00E676';
    if (score >= 60) return '#FF9800';
    return '#F44336';
}

/**
 * Given two sorted-by-timestamp tracks, produce deviation markers using
 * temporal nearest-neighbour matching (same algorithm as FlightComparator).
 * Downsampled to at most maxMarkers for rendering performance.
 */
function buildDeviationMarkers(
    estimated: { timestamp: number; latitude: number; longitude: number }[],
    actual:    { timestamp: number; latitude: number; longitude: number }[],
    maxMarkers = 40,
): DeviationMarker[] {
    if (!estimated.length || !actual.length) return [];

    const pairs: DeviationMarker[] = [];
    let lo = 0;

    for (const est of estimated) {
        while (lo < actual.length && actual[lo].timestamp < est.timestamp - MATCH_WINDOW_SEC) lo++;

        let bestDist = Infinity;
        let bestActual: (typeof actual)[0] | null = null;

        for (let i = lo; i < actual.length; i++) {
            if (actual[i].timestamp > est.timestamp + MATCH_WINDOW_SEC) break;
            const d = haversineKm(est.latitude, est.longitude, actual[i].latitude, actual[i].longitude);
            if (d < bestDist) { bestDist = d; bestActual = actual[i]; }
        }

        if (bestActual) {
            pairs.push({
                estimated: { latitude: est.latitude,         longitude: est.longitude },
                actual:    { latitude: bestActual.latitude,  longitude: bestActual.longitude },
                distKm:    bestDist,
            });
        }
    }

    // Uniform downsample
    if (pairs.length <= maxMarkers) return pairs;
    const stride = pairs.length / maxMarkers;
    return Array.from({ length: maxMarkers }, (_, i) => pairs[Math.round(i * stride)]);
}

/**
 * Compute a map region that fits all provided coordinates with padding.
 */
function fitRegion(coords: LatLng[]): {
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
} {
    if (coords.length === 0) {
        return { latitude: 20.5, longitude: 78.9, latitudeDelta: 15, longitudeDelta: 15 };
    }
    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 0.15;
    const latDelta = (maxLat - minLat) * (1 + pad) || 8;
    const lngDelta = (maxLng - minLng) * (1 + pad) || 8;
    return {
        latitude:      (minLat + maxLat) / 2,
        longitude:     (minLng + maxLng) / 2,
        latitudeDelta:  latDelta,
        longitudeDelta: lngDelta,
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500' }}>{label}</Text>
        </View>
    );
}

function PhaseAccuracy({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <View style={styles.phaseCard}>
            <View style={[styles.phaseRing, { borderColor: color }]}>
                <Text style={styles.phaseScore}>{Math.round(score)}</Text>
            </View>
            <Text style={styles.phaseLabel}>{label}</Text>
        </View>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ComparisonScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI101');

    const estimatedTrack = useEstimatedTrack();
    const actualTrack    = useActualTrack();
    const report         = useDeviationReport();
    const waypoints      = useWaypoints();
    const activeFlight   = useMapViewModel(s => s.activeFlight);

    const [activeTab, setActiveTab] = useState<ComparisonTab>('Both');
    const mapRef = useRef<MapView>(null);

    // ── Derived map data ───────────────────────────────────────────────────────

    const estimatedCoords: LatLng[] = useMemo(
        () => estimatedTrack.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        [estimatedTrack],
    );

    const actualCoords: LatLng[] = useMemo(
        () => actualTrack.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        [actualTrack],
    );

    const deviationMarkers = useMemo(
        () => buildDeviationMarkers(estimatedTrack, actualTrack),
        [estimatedTrack, actualTrack],
    );

    // Map region: fit both tracks, fall back to waypoints
    const initialRegion = useMemo(() => {
        const allCoords = [...estimatedCoords, ...actualCoords];
        if (allCoords.length > 0) return fitRegion(allCoords);
        return fitRegion(waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude })));
    }, [estimatedCoords, actualCoords, waypoints]);

    // ── Fit map on mount once tracks load ─────────────────────────────────────

    useEffect(() => {
        if (!mapRef.current) return;
        const coords = [...estimatedCoords, ...actualCoords];
        if (coords.length === 0) return;
        // Small delay to ensure the map has rendered
        const t = setTimeout(() => {
            mapRef.current?.animateToRegion(fitRegion(coords), 600);
        }, 400);
        return () => clearTimeout(t);
    }, [estimatedCoords, actualCoords]);

    // ── No-data guard ──────────────────────────────────────────────────────────

    const hasData = estimatedTrack.length > 0 && actualTrack.length > 0;

    const handleViewReport = useCallback(() => {
        router.push(`/accuracy/${displayId}`);
    }, [router, displayId]);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>

            {/* ── MAP ──────────────────────────────────────────────────────── */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_DEFAULT}
                    style={StyleSheet.absoluteFillObject}
                    userInterfaceStyle="dark"
                    customMapStyle={darkMapStyle}
                    initialRegion={initialRegion}
                    scrollEnabled
                    zoomEnabled
                    rotateEnabled={false}
                >
                    {/* Estimated track — blue dashed */}
                    {estimatedCoords.length >= 2 &&
                        (activeTab === 'Estimated' || activeTab === 'Both') && (
                            <Polyline
                                coordinates={estimatedCoords}
                                strokeColor="#4A9EFF"
                                strokeWidth={2.5}
                                lineDashPattern={[6, 4]}
                            />
                        )}

                    {/* Actual track — green solid */}
                    {actualCoords.length >= 2 &&
                        (activeTab === 'Actual' || activeTab === 'Both') && (
                            <Polyline
                                coordinates={actualCoords}
                                strokeColor="#00E676"
                                strokeWidth={2.5}
                            />
                        )}

                    {/* Deviation markers — only in Both tab */}
                    {activeTab === 'Both' &&
                        deviationMarkers.map((m, i) => {
                            const color = deviationColor(m.distKm);
                            return (
                                <React.Fragment key={i}>
                                    {/* Line connecting estimated to actual */}
                                    <Polyline
                                        coordinates={[m.estimated, m.actual]}
                                        strokeColor={`${color}66`}
                                        strokeWidth={1}
                                    />
                                    {/* Dot on the estimated position */}
                                    <Marker
                                        coordinate={m.estimated}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        tracksViewChanges={false}
                                    >
                                        <View style={[styles.deviationDot, { backgroundColor: color }]} />
                                    </Marker>
                                </React.Fragment>
                            );
                        })}

                    {/* Origin / destination markers */}
                    {actualCoords.length >= 2 && (
                        <>
                            <Marker
                                coordinate={actualCoords[0]}
                                title={activeFlight?.origin}
                                pinColor="#4A9EFF"
                                tracksViewChanges={false}
                            />
                            <Marker
                                coordinate={actualCoords[actualCoords.length - 1]}
                                title={activeFlight?.destination}
                                pinColor="#00E676"
                                tracksViewChanges={false}
                            />
                        </>
                    )}
                </MapView>

                {/* Loading overlay when tracks not yet loaded */}
                {!hasData && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color="#4A9EFF" size="small" />
                        <Text style={styles.loadingText}>Loading tracks…</Text>
                    </View>
                )}

                {/* Legend */}
                <View style={styles.legend}>
                    {activeTab !== 'Actual' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.legendLineDashed} />
                            <Text style={{ color: '#4A9EFF', fontSize: 11, fontWeight: '500' }}>Estimated</Text>
                        </View>
                    )}
                    {activeTab !== 'Estimated' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.legendLineSolid} />
                            <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '500' }}>Actual</Text>
                        </View>
                    )}
                </View>

                {/* Overlaid controls */}
                <View style={styles.mapControls}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                    >
                        <ArrowLeft color="#FFF" size={18} />
                    </TouchableOpacity>

                    {/* Tab switcher */}
                    <View style={styles.tabBar}>
                        {(['Estimated', 'Actual', 'Both'] as ComparisonTab[]).map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[
                                    styles.tabBtn,
                                    activeTab === tab && styles.tabBtnActive,
                                ]}
                            >
                                <Text style={[
                                    styles.tabBtnText,
                                    activeTab === tab && styles.tabBtnTextActive,
                                ]}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* ── BOTTOM SHEET ─────────────────────────────────────────────── */}
            <ScrollView
                style={{ flex: 1, backgroundColor: '#0A0A0F' }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            >
                <View style={styles.handle} />

                {/* Title + Score */}
                <View style={styles.titleRow}>
                    <Text style={styles.titleText}>Flight Comparison</Text>
                    {report ? (
                        <View style={[styles.scoreBadge, { borderColor: `${scoreColor(report.accuracyScore)}40` }]}>
                            <Text style={[styles.scoreText, { color: scoreColor(report.accuracyScore) }]}>
                                Score: {Math.round(report.accuracyScore)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.scoreBadgePending}>
                            <Text style={styles.scorePendingText}>Calculating…</Text>
                        </View>
                    )}
                </View>

                {/* Deviation legend */}
                <View style={styles.deviationLegend}>
                    <LegendItem color="#00E676" label="< 10 km" />
                    <LegendItem color="#FF9800" label="10–50 km" />
                    <LegendItem color="#F44336" label="> 50 km" />
                </View>

                {/* Stats */}
                {report && (
                    <View style={styles.statsCard}>
                        <StatRow label="RMSE"          value={fmt(report.rmseKm)} />
                        <StatRow label="Max deviation" value={fmt(report.maxDeviationKm)} />
                        <StatRow label="Avg deviation" value={fmt(report.avgDeviationKm)} />
                        <StatRow
                            label="Track points"
                            value={`${estimatedTrack.length} est · ${actualTrack.length} actual`}
                        />
                    </View>
                )}

                {/* Phase accuracy cards */}
                {report && (
                    <View style={styles.phaseRow}>
                        <PhaseAccuracy
                            label="Climb"
                            score={report.phaseAccuracy.climb}
                            color={scoreColor(report.phaseAccuracy.climb)}
                        />
                        <PhaseAccuracy
                            label="Cruise"
                            score={report.phaseAccuracy.cruise}
                            color={scoreColor(report.phaseAccuracy.cruise)}
                        />
                        <PhaseAccuracy
                            label="Descent"
                            score={report.phaseAccuracy.descent}
                            color={scoreColor(report.phaseAccuracy.descent)}
                        />
                    </View>
                )}

                {/* Route info */}
                {activeFlight && (
                    <View style={styles.routeRow}>
                        <Text style={styles.routeAirport}>{activeFlight.origin}</Text>
                        <View style={styles.routeLine}>
                            <View style={styles.routeLineFill} />
                        </View>
                        <Text style={styles.routeAirport}>{activeFlight.destination}</Text>
                    </View>
                )}

                {/* Full report CTA */}
                <TouchableOpacity
                    onPress={handleViewReport}
                    activeOpacity={0.8}
                    style={styles.reportBtn}
                >
                    <Text style={styles.reportBtnText}>View Full Report</Text>
                    <ChevronRight size={18} color="#8E8E93" />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    mapContainer: {
        height: 320,
        backgroundColor: '#080D18',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(8,13,24,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 13,
    },
    deviationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#0A0A0F',
    },
    legend: {
        position: 'absolute',
        bottom: 14,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    legendLineDashed: {
        width: 18,
        height: 2,
        backgroundColor: '#4A9EFF',
        borderRadius: 1,
        // Native dashes aren't possible on View — colour alone distinguishes it
    },
    legendLineSolid: {
        width: 18,
        height: 2,
        backgroundColor: '#00E676',
        borderRadius: 1,
    },
    mapControls: {
        position: 'absolute',
        top: 14,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backBtn: {
        width: 36,
        height: 36,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 50,
        padding: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 50,
    },
    tabBtnActive: {
        backgroundColor: '#4A9EFF',
    },
    tabBtnText: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '600',
    },
    tabBtnTextActive: {
        color: '#FFFFFF',
    },
    handle: {
        width: 48,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 3,
        alignSelf: 'center',
        marginVertical: 14,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    scoreBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
    },
    scoreText: {
        fontWeight: '700',
        fontSize: 15,
    },
    scoreBadgePending: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    scorePendingText: {
        color: '#8E8E93',
        fontSize: 13,
    },
    deviationLegend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    statsCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 10,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statLabel: {
        color: '#8E8E93',
        fontSize: 13,
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    phaseRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    phaseCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    phaseRing: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    phaseScore: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    phaseLabel: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    routeAirport: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    routeLine: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    routeLineFill: {
        width: '100%',
        height: '100%',
        backgroundColor: '#4A9EFF',
        borderRadius: 2,
    },
    reportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 14,
        paddingVertical: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    reportBtnText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 15,
    },
});