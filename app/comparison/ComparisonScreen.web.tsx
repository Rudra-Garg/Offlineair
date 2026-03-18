import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ComparisonScreenWeb() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI 101');
    const [activeTab, setActiveTab] = useState('Both');

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <View className="absolute top-0 left-0 w-full h-[65%] bg-[#0C1220]">
                <View className="absolute inset-0 items-center justify-center px-6">
                    <Text className="text-white text-lg font-bold mb-2">Map Comparison Is Native-Only</Text>
                    <Text className="text-muted text-sm text-center">
                        Route overlays rely on react-native-maps. On web, this screen shows the comparison metrics and timeline without the map layer.
                    </Text>
                </View>
                <View className="absolute inset-0 bg-black/30 pointer-events-none" />
            </View>

            <View className="absolute top-12 left-6 right-6 flex-row items-center justify-between z-10">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="p-2 -ml-2 rounded-full bg-black/20"
                >
                    <ArrowLeft color="#FFF" size={24} />
                </TouchableOpacity>

                <View className="flex-row bg-black/40 rounded-full p-1 border border-white/10">
                    {['Estimated', 'Actual', 'Both'].map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-full ${activeTab === tab ? 'bg-primary' : 'bg-transparent'}`}
                        >
                            <Text className={`text-xs font-semibold ${activeTab === tab ? 'text-white' : 'text-muted'}`}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View className="absolute bottom-0 left-0 w-full h-[45%] bg-[#0A0A0F] rounded-t-3xl pt-2 px-6 pb-6 z-10 border-t border-white/10">
                <View className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5 mt-2" />

                <View className="flex-row items-center justify-between mb-5">
                    <Text className="text-white text-xl font-bold">Flight Comparison</Text>
                    <View className="px-3 py-1 rounded-lg bg-primary/20 border border-primary/30">
                        <Text className="text-primary font-bold text-sm">Score: 84</Text>
                    </View>
                </View>

                <View className="flex-row justify-between items-center mb-6 bg-white/5 rounded-xl p-3 border border-white/5">
                    <LegendItem color="bg-[#00E676]" label="< 10km" />
                    <LegendItem color="bg-[#FF9800]" label="10-50km" />
                    <LegendItem color="bg-[#F44336]" label="> 50km" />
                </View>

                <View className="mb-6 relative w-full items-center">
                    <View className="h-1 w-full bg-white/10 rounded-full" />
                    <View className="absolute top-[-6px] left-[40%] w-4 h-4 bg-white rounded-full border border-dark" />
                    <View className="flex-row justify-between w-full mt-2">
                        <Text className="text-[10px] font-medium text-muted">08:45 DEL</Text>
                        <Text className="text-[10px] font-medium text-muted">10:52 BOM</Text>
                    </View>
                </View>

                <View className="flex-row gap-3 mb-6 justify-between">
                    <PhaseAccuracy label="Climb" score={91} color="#00E676" />
                    <PhaseAccuracy label="Cruise" score={82} color="#4A9EFF" />
                    <PhaseAccuracy label="Descent" score={79} color="#FF9800" />
                </View>

                <TouchableOpacity
                    onPress={() => router.push(`/accuracy/${displayId}`)}
                    className="mt-auto flex-row items-center justify-center gap-2 w-full bg-white/10 rounded-xl py-3"
                    activeOpacity={0.8}
                >
                    <Text className="text-white font-semibold flex-row items-center justify-center text-center">
                        View Full Report <ChevronRight size={20} color="#8E8E93" style={{ bottom: -2 }} />
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <View className="flex-row items-center gap-2">
            <View className={`w-2 h-2 rounded-full ${color}`} />
            <Text className="text-[11px] font-medium text-muted ml-1">{label}</Text>
        </View>
    );
}

function PhaseAccuracy({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <View className="flex-1 bg-black/40 rounded-2xl p-2 flex-row items-center justify-center gap-2 border border-white/5 mx-1">
            <View className="w-8 h-8 items-center justify-center rounded-full border-2" style={{ borderColor: color }}>
                <Text className="text-[10px] font-bold text-white">{score}</Text>
            </View>
            <Text className="text-[11px] font-medium text-muted ml-1">{label}</Text>
        </View>
    );
}
