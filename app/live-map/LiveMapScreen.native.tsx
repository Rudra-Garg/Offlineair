import { useLocalSearchParams, useRouter } from 'expo-router';
import { Compass, Crosshair, Navigation } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { darkMapStyle } from '../../constants/MapStyle';

export default function LiveMapScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || "AI 101");
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <MapView
                provider={PROVIDER_DEFAULT}
                style={StyleSheet.absoluteFillObject}
                userInterfaceStyle="dark"
                customMapStyle={darkMapStyle}
                scrollEnabled={true}
                initialRegion={{
                    latitude: 23.5,
                    longitude: 75.0,
                    latitudeDelta: 15,
                    longitudeDelta: 15,
                }}
            >
                <Marker
                    coordinate={{ latitude: 28.5562, longitude: 77.1000 }}
                    title="DEL (Indira Gandhi Int)"
                    pinColor="#4A9EFF"
                />
                <Marker
                    coordinate={{ latitude: 19.0896, longitude: 72.8656 }}
                    title="BOM (Chhatrapati Shivaji)"
                    pinColor="#00E676"
                />
                <Marker
                    coordinate={{ latitude: 23.0, longitude: 75.0 }}
                    title="Current Position"
                >
                    <View className="items-center justify-center p-2 pt-1 pb-1">
                        <Navigation size={28} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
                    </View>
                </Marker>
            </MapView>

            <View className="flex-1 justify-between pointer-events-none">
                <View className="px-6 pt-6 flex-row justify-between items-start">
                    <View className="bg-dark/80 rounded-2xl p-4 border border-white/10">
                        <Text className="text-muted text-xs uppercase tracking-wider mb-1">ETA DEL</Text>
                        <Text className="text-primary text-2xl font-bold">10:52 AM</Text>
                    </View>

                    <View className="flex-col gap-3">
                        <TouchableOpacity className="w-12 h-12 bg-dark/80 rounded-full items-center justify-center border border-white/10 mb-2">
                            <Crosshair size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity className="w-12 h-12 bg-dark/80 rounded-full items-center justify-center border border-white/10">
                            <Compass size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="bg-[#0A0A0F] border-t border-white/10 rounded-t-3xl pt-2 px-6 pb-8">
                    <TouchableOpacity
                        className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6"
                        onPress={() => setDrawerOpen(!drawerOpen)}
                    />

                    <View className="flex-row justify-between items-end mb-6">
                        <View>
                            <Text className="text-white text-2xl font-bold mb-1">{displayId}</Text>
                            <Text className="text-muted text-sm tracking-wide">Boeing 777-300ER</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-primary font-bold text-lg">34,000 ft</Text>
                            <Text className="text-muted text-xs">480 kts</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg mb-1">DEL</Text>
                            <Text className="text-muted text-xs">08:45 AM</Text>
                        </View>
                        <View className="flex-[2] items-center px-4">
                            <View className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                                <View className="absolute left-0 top-0 bottom-0 w-3/4 bg-primary" />
                            </View>
                            <Text className="text-muted text-xs mt-2">1h 12m remaining</Text>
                        </View>
                        <View className="flex-1 items-end">
                            <Text className="text-white font-bold text-lg mb-1">BOM</Text>
                            <Text className="text-muted text-xs">10:52 AM</Text>
                        </View>
                    </View>

                    {drawerOpen && (
                        <View className="mb-6 space-y-4">
                            <View className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                <Text className="text-muted text-xs uppercase tracking-wider mb-2">Next Waypoint</Text>
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-white font-semibold text-base">VABO</Text>
                                    <Text className="text-white">12 mins</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() => router.push(`/complete/${displayId}`)}
                        className="w-full bg-white/10 py-4 rounded-full border border-white/20 items-center justify-center"
                    >
                        <Text className="text-white font-semibold text-base">Debug: Trigger Landing</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </SafeAreaView>
    );
}
