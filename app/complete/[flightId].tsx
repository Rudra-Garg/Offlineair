import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Wifi } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

export default function FlightCompleteScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || "AI 101");

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <View className="flex-1 p-6">

                <View className="items-center mt-12 mb-10">
                    <View className="w-24 h-24 rounded-full bg-[#00E676]/20 items-center justify-center mb-6">
                        <CheckCircle2 color="#00E676" size={48} />
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tight mb-2">Flight Complete</Text>
                    <Text className="text-muted font-medium">{displayId} · DEL → BOM · 2h 07m</Text>
                </View>

                <View className="bg-white/5 rounded-3xl p-6 border border-white/10 mb-10">
                    <View className="flex-row justify-between mb-6">
                        <View>
                            <Text className="text-muted text-sm">Departed</Text>
                            <Text className="text-white font-semibold text-lg mt-1">08:45 AM</Text>
                        </View>
                        <View>
                            <Text className="text-muted text-sm">Landed</Text>
                            <Text className="text-white font-semibold text-lg mt-1">10:52 AM</Text>
                        </View>
                    </View>
                    <View className="flex-row justify-between">
                        <View>
                            <Text className="text-muted text-sm">Distance</Text>
                            <Text className="text-white font-semibold text-lg mt-1">1,136 km</Text>
                        </View>
                        <View>
                            <Text className="text-muted text-sm">Est. Accuracy</Text>
                            <Text className="text-white/40 font-semibold text-lg mt-1">—</Text>
                        </View>
                    </View>
                </View>

                <View className="mt-auto flex-1 justify-end">
                    <View className="flex-row items-center gap-4 mb-6">
                        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                            <Wifi size={24} color="#4A9EFF" />
                        </View>
                        <View>
                            <Text className="text-white font-semibold text-lg">Sync actual flight data</Text>
                            <Text className="text-muted text-sm mt-1">Download real ADS-B track to{'\n'}compare with your estimate</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push(`/comparison/${displayId}`)}
                        className="w-full bg-primary py-4 rounded-full items-center mb-4"
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-lg font-semibold">Sync Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/')}
                        className="w-full py-4 rounded-full flex-row items-center justify-center bg-transparent"
                        activeOpacity={0.6}
                    >
                        <Text className="text-muted text-base font-semibold">Skip for now</Text>
                    </TouchableOpacity>

                    <Text className="text-center text-muted/50 text-xs mt-4 font-medium">Data available ~1 hour after landing</Text>
                </View>

            </View>
        </SafeAreaView>
    );
}