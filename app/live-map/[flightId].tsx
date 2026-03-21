/**
 * app/live-map/[flightId].tsx
 * Updated to include SigmetOverlay and AltitudeGraph.
 * Only the MapView children and bottom sheet are changed from previous version.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Compass, Crosshair, Navigation } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import AltitudeGraph from '../../components/AltitudeGraph';
import SigmetOverlay from '../../components/SigmetOverlay';
import { startFlight, stopFlight } from '../../engine/SessionManager';
import {
    useActiveAlerts,
    useETA,
    useFlightPhase,
    useIsTracking,
    useLivePosition,
    useMapViewModel,
    useRemainingDistance,
    useWaypoints,
} from '../../store';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOTTOM_HEIGHT = 300; // taller to fit altitude graph

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatETA(etaUnix: number | null): string {
    if (!etaUnix) return '--:--';
    return new Date(etaUnix * 1000).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}
function formatAlt(ft?: number | null) { return ft != null ? `${Math.round(ft / 100) * 100} ft` : '--'; }
function formatSpd(kts?: number | null) { return kts != null ? `${Math.round(kts)} kts` : '--'; }
function formatRem(km: number | null) {
    if (km == null) return '--';
    const hrs = Math.floor(km / 800);
    const mins = Math.round((km / 800 - hrs) * 60);
    return hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins}m remaining`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveMapScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const rawId = Array.isArray(flightId) ? flightId[0] : (flightId ?? 'AI101');
    const displayId = rawId.replace(/([A-Za-z]+)(\d+)/, '$1 $2');
    const { width } = useWindowDimensions();

    const livePosition = useLivePosition();
    const etaUnix = useETA();
    const flightPhase = useFlightPhase();
    const waypoints = useWaypoints();
    const activeAlerts = useActiveAlerts();
    const isTracking = useIsTracking();
    const remainingKm = useRemainingDistance();
    const activeFlight = useMapViewModel(s => s.activeFlight);
    const route = useMapViewModel(s => s.route);
    const dismissAlert = useMapViewModel(s => s.dismissAlert);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const mapRef = useRef<MapView>(null);
    const hasStarted = useRef(false);

    // ── Start engine on mount ──────────────────────────────────────────────────
    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        (async () => {
            const flight = useMapViewModel.getState().activeFlight;
            if (!flight) return;
            const result = await startFlight({ flightId: flight.id });
            if (!result.success) {
                Alert.alert('Engine Error', result.error ?? 'Could not start dead reckoning');
            }
        })();
    }, []);

    // ── Auto-pan to live position ──────────────────────────────────────────────
    useEffect(() => {
        if (!livePosition || !mapRef.current) return;
        mapRef.current.animateToRegion({
            latitude: livePosition.latitude, longitude: livePosition.longitude,
            latitudeDelta: 5, longitudeDelta: 5,
        }, 600);
    }, [livePosition]);

    // ── Auto-dismiss alerts ────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeAlerts.length) return;
        const id = activeAlerts[activeAlerts.length - 1].id;
        const t = setTimeout(() => dismissAlert(id), 8000);
        return () => clearTimeout(t);
    }, [activeAlerts, dismissAlert]);

    // ── Landing ────────────────────────────────────────────────────────────────
    const handleLanding = useCallback(() => {
        Alert.alert('Confirm Landing', 'Stop tracking and proceed to post-flight sync?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Land', style: 'destructive', onPress: async () => {
                    await stopFlight();
                    router.push(`/complete/${rawId}`);
                }
            },
        ]);
    }, [rawId, router]);

    const routeCoords = waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude }));
    const totalKm = route?.totalDistanceKm ?? 1;
    const progressPct = remainingKm != null ? Math.round((1 - remainingKm / totalKm) * 100) : 0;

    const phaseLabel = flightPhase
        ? { CLIMB: '↑ Climbing', CRUISE: '→ Cruising', DESCENT: '↓ Descending' }[flightPhase]
        : 'Calculating…';

    // Graph width = card width minus padding
    const graphWidth = width - 48 - 24; // 24px horizontal padding each side

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }} edges={['top']}>
            <View style={{ flex: 1 }}>

                {/* ── MAP ─────────────────────────────────────────────────────── */}
                <View style={{ flex: 1, marginBottom: BOTTOM_HEIGHT }}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_DEFAULT}
                        style={StyleSheet.absoluteFillObject}
                        userInterfaceStyle="dark"
                        customMapStyle={darkMapStyle}
                        initialRegion={{
                            latitude: livePosition?.latitude ?? 23.5,
                            longitude: livePosition?.longitude ?? 75.0,
                            latitudeDelta: 15,
                            longitudeDelta: 15,
                        }}
                    >
                        {/* Route polyline */}
                        {routeCoords.length >= 2 && (
                            <Polyline
                                coordinates={routeCoords}
                                strokeColor="#4A9EFF"
                                strokeWidth={3}
                                lineDashPattern={[6, 4]}
                            />
                        )}

                        {/* Origin / destination */}
                        {routeCoords.length >= 2 && (
                            <>
                                <Marker coordinate={routeCoords[0]} title={activeFlight?.origin} pinColor="#4A9EFF" />
                                <Marker coordinate={routeCoords[routeCoords.length - 1]} title={activeFlight?.destination} pinColor="#00E676" />
                            </>
                        )}

                        {/* Live position */}
                        {livePosition && (
                            <Marker
                                coordinate={{ latitude: livePosition.latitude, longitude: livePosition.longitude }}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={styles.positionDot}>
                                    <Navigation
                                        size={22}
                                        color="#FFF"
                                        style={{ transform: [{ rotate: `${livePosition.bearing}deg` }] }}
                                    />
                                </View>
                            </Marker>
                        )}

                        {/* SIGMET polygons */}
                        <SigmetOverlay />
                    </MapView>

                    {/* Alert banner */}
                    {activeAlerts.length > 0 && (
                        <View style={styles.alertBanner}>
                            <Text style={styles.alertText}>
                                {activeAlerts[activeAlerts.length - 1].type === 'SIGMET' ? '⚡ ' : '📍 '}
                                {activeAlerts[activeAlerts.length - 1].message}
                            </Text>
                        </View>
                    )}

                    {/* Map controls overlay */}
                    <View style={styles.mapControls}>
                        <View style={styles.etaCard}>
                            <Text style={styles.etaLabel}>ETA {activeFlight?.destination ?? 'DST'}</Text>
                            <Text style={styles.etaValue}>{formatETA(etaUnix)}</Text>
                            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => {
                                if (livePosition) mapRef.current?.animateToRegion(
                                    { latitude: livePosition.latitude, longitude: livePosition.longitude, latitudeDelta: 5, longitudeDelta: 5 }, 400,
                                );
                            }}>
                                <Crosshair size={18} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn}><Compass size={18} color="#FFF" /></TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ── BOTTOM SHEET ─────────────────────────────────────────────── */}
                <View style={[styles.sheet, { height: drawerOpen ? BOTTOM_HEIGHT + 60 : BOTTOM_HEIGHT }]}>

                    <TouchableOpacity
                        style={styles.handle}
                        onPress={() => setDrawerOpen(!drawerOpen)}
                    />

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                        <View>
                            <Text style={styles.flightId}>{displayId}</Text>
                            <Text style={styles.aircraftType}>{activeFlight?.aircraftType ?? 'Unknown aircraft'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.altText}>{formatAlt(livePosition?.altitudeFt)}</Text>
                            <Text style={styles.spdText}>{formatSpd(livePosition?.speedKts)}</Text>
                        </View>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.apLabel}>{activeFlight?.origin ?? '---'}</Text>
                        </View>
                        <View style={styles.progressBarWrap}>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${Math.min(100, progressPct)}%` }]} />
                            </View>
                            <Text style={styles.remainingText}>{formatRem(remainingKm)}</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={styles.apLabel}>{activeFlight?.destination ?? '---'}</Text>
                            <Text style={{ color: '#4A9EFF', fontSize: 11, marginTop: 2 }}>{formatETA(etaUnix)}</Text>
                        </View>
                    </View>

                    {/* ── Altitude graph ─────────────────────────────────────────── */}
                    <View style={styles.graphCard}>
                        <Text style={styles.graphLabel}>Altitude Profile</Text>
                        <AltitudeGraph width={graphWidth} height={64} />
                    </View>

                    {/* Expanded: next waypoint */}
                    {drawerOpen && (
                        <View style={styles.waypointCard}>
                            <Text style={styles.waypointLabel}>Next Waypoint</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                                {waypoints[1]?.ident ?? activeFlight?.destination ?? '---'}
                            </Text>
                        </View>
                    )}

                    {/* Landing button */}
                    <TouchableOpacity onPress={handleLanding} activeOpacity={0.8} style={styles.landBtn}>
                        <Text style={styles.landBtnText}>
                            {isTracking ? 'Confirm Landing' : 'Starting engine…'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    positionDot: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(74,158,255,0.9)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#FFF',
    },
    alertBanner: {
        position: 'absolute', top: 80, left: 16, right: 16,
        backgroundColor: 'rgba(255,152,0,0.92)',
        borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: 'rgba(255,200,0,0.4)',
    },
    alertText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13, textAlign: 'center' },
    mapControls: {
        position: 'absolute', top: 12, left: 20, right: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    etaCard: {
        backgroundColor: 'rgba(10,10,15,0.88)',
        borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    etaLabel: { color: '#8E8E93', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
    etaValue: { color: '#4A9EFF', fontSize: 21, fontWeight: '700' },
    phaseLabel: { color: '#8E8E93', fontSize: 10, marginTop: 2 },
    iconBtn: {
        width: 40, height: 40, backgroundColor: 'rgba(10,10,15,0.88)',
        borderRadius: 20, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    sheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0D0D14',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingTop: 8, paddingHorizontal: 24, paddingBottom: 20,
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    },
    handle: {
        width: 44, height: 5, backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 3, alignSelf: 'center', marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-end', marginBottom: 14,
    },
    flightId: { color: '#FFFFFF', fontSize: 19, fontWeight: '700', marginBottom: 2 },
    aircraftType: { color: '#8E8E93', fontSize: 12 },
    altText: { color: '#4A9EFF', fontWeight: '700', fontSize: 16 },
    spdText: { color: '#8E8E93', fontSize: 12 },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    progressBarWrap: { flex: 2, paddingHorizontal: 12, alignItems: 'center' },
    progressBarBg: {
        width: '100%', height: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2, overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: '#4A9EFF', borderRadius: 2 },
    remainingText: { color: '#8E8E93', fontSize: 10, marginTop: 4 },
    apLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    graphCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12, padding: 12, marginBottom: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    graphLabel: {
        color: '#8E8E93', fontSize: 9,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    },
    waypointCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12, padding: 14, marginBottom: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    },
    waypointLabel: {
        color: '#8E8E93', fontSize: 9,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5,
    },
    landBtn: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        paddingVertical: 14, borderRadius: 50,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
    },
    landBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});