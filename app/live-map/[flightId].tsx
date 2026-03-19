import { useLocalSearchParams, useRouter } from 'expo-router';
import { Compass, Crosshair, Navigation } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
];

const routeCoords = [
    { latitude: 28.5562, longitude: 77.1000 },
    { latitude: 26.0, longitude: 76.0 },
    { latitude: 23.0, longitude: 75.0 },
    { latitude: 19.0896, longitude: 72.8656 },
];

const BOTTOM_HEIGHT = 240;

export default function LiveMapScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI101');
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }} edges={['top']}>
            <View style={{ flex: 1 }}>

                {/* MAP */}
                <View style={{ flex: 1, marginBottom: BOTTOM_HEIGHT }}>
                    <MapView
                        provider={PROVIDER_DEFAULT}
                        style={StyleSheet.absoluteFillObject}
                        userInterfaceStyle="dark"
                        customMapStyle={darkMapStyle}
                        initialRegion={{ latitude: 23.5, longitude: 75.0, latitudeDelta: 15, longitudeDelta: 15 }}
                    >
                        <Polyline coordinates={routeCoords} strokeColor="#4A9EFF" strokeWidth={3} lineDashPattern={[6, 4]} />
                        <Marker coordinate={routeCoords[0]} title="DEL" pinColor="#4A9EFF" />
                        <Marker coordinate={routeCoords[3]} title="BOM" pinColor="#00E676" />
                        <Marker coordinate={{ latitude: 23.0, longitude: 75.0 }} title="Current">
                            <View style={{ padding: 4 }}><Navigation size={28} color="#FFF" /></View>
                        </Marker>
                    </MapView>

                    {/* Controls overlay */}
                    <View style={{ position: 'absolute', top: 12, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ backgroundColor: 'rgba(10,10,15,0.88)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <Text style={{ color: '#8E8E93', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 }}>ETA BOM</Text>
                            <Text style={{ color: '#4A9EFF', fontSize: 21, fontWeight: '700' }}>10:52 AM</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            <TouchableOpacity style={styles.iconBtn}><Crosshair size={18} color="#FFF" /></TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn}><Compass size={18} color="#FFF" /></TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* BOTTOM SHEET */}
                <View style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: drawerOpen ? BOTTOM_HEIGHT + 72 : BOTTOM_HEIGHT,
                    backgroundColor: '#0D0D14',
                    borderTopLeftRadius: 22, borderTopRightRadius: 22,
                    paddingTop: 8, paddingHorizontal: 22, paddingBottom: 20,
                    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
                }}>
                    <TouchableOpacity
                        style={{ width: 44, height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, alignSelf: 'center', marginBottom: 18 }}
                        onPress={() => setDrawerOpen(!drawerOpen)}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
                        <View>
                            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '700', marginBottom: 2 }}>{displayId}</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 12 }}>Boeing 777-300ER</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#4A9EFF', fontWeight: '700', fontSize: 16 }}>34,000 ft</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 12 }}>480 kts</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginBottom: 2 }}>DEL</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 11 }}>08:45 AM</Text>
                        </View>
                        <View style={{ flex: 2, paddingHorizontal: 12, alignItems: 'center' }}>
                            <View style={{ width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                <View style={{ width: '75%', height: '100%', backgroundColor: '#4A9EFF', borderRadius: 2 }} />
                            </View>
                            <Text style={{ color: '#8E8E93', fontSize: 10, marginTop: 5 }}>1h 12m remaining</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginBottom: 2 }}>BOM</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 11 }}>10:52 AM</Text>
                        </View>
                    </View>
                    {drawerOpen && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                            <Text style={{ color: '#8E8E93', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Next Waypoint</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>VABO</Text>
                                <Text style={{ color: '#8E8E93' }}>12 mins</Text>
                            </View>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={() => router.push(`/complete/${displayId}`)}
                        activeOpacity={0.8}
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', paddingVertical: 14, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' }}
                    >
                        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Debug: Trigger Landing</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    iconBtn: {
        width: 40, height: 40,
        backgroundColor: 'rgba(10,10,15,0.88)',
        borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
});