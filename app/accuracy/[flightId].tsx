import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function AccuracyScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || "AI 101");
    const score = 84;

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
                {/* Top Navigation */}
                <View className="flex-row items-center justify-between mb-10 mt-6">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
                        <ArrowLeft color="#FFF" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-lg font-semibold tracking-wide">Accuracy Report</Text>
                    <TouchableOpacity className="p-2 -mr-2 rounded-full">
                        <Share color="#FFF" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Hero Section */}
                <View className="items-center justify-center mb-10">
                    {/* Circular Progress Placeholder */}
                    <View className="w-40 h-40 mb-6 items-center justify-center rounded-full border-[8px] border-primary">
                        <View className="items-center justify-center">
                            <Text className="text-white text-5xl font-bold tracking-tighter">{score}</Text>
                            <Text className="text-muted text-sm font-medium">/ 100</Text>
                        </View>
                    </View>
                    <View className="px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30">
                        <Text className="text-primary text-sm font-semibold tracking-wider uppercase">Good Accuracy</Text>
                    </View>
                </View>

                {/* Stats Grid */}
                <View className="flex-row flex-wrap justify-between mb-8">
                    <StatCard label="Avg Deviation" value="18.4 km" />
                    <StatCard label="Max Deviation" value="41.2 km" />
                    <View className="w-full h-3" />
                    <StatCard label="RMSE" value="21.7 km" />
                    <StatCard label="Track Points" value="248" />
                </View>

                {/* Phase Breakdown */}
                <View className="space-y-5 flex-1 mb-8">
                    <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2">Phase Breakdown</Text>
                    <PhaseBar label="Climb" score={91} color="bg-[#00E676]" />
                    <PhaseBar label="Cruise" score={82} color="bg-primary" />
                    <PhaseBar label="Descent" score={79} color="bg-[#FF9800]" />
                </View>

                {/* Bottom Section */}
                <View className="mt-auto">
                    <Text className="text-center text-muted text-sm mb-6 font-medium">
                        {displayId} · DEL → BOM · Mar 14 2026
                    </Text>
                    <TouchableOpacity className="w-full bg-primary flex-row items-center justify-center rounded-full py-4 mb-4" activeOpacity={0.8}>
                        <Share color="#FFF" size={20} className="mr-2" />
                        <Text className="text-white text-lg font-semibold">Share Report</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({ label, value }: { label: string, value: string }) {
    return (
        <View className="w-[48%] bg-white/5 rounded-2xl p-4 border border-white/10">
            <Text className="text-xs font-medium text-muted mb-1">{label}</Text>
            <Text className="text-lg font-semibold text-white">{value}</Text>
        </View>
    );
}

function PhaseBar({ label, score, color }: { label: string, score: number, color: string }) {
    return (
        <View className="flex-row items-center justify-between mb-4">
            <Text className="w-16 text-sm font-medium text-muted">{label}</Text>
            <View className="flex-1 mx-4 h-2 bg-white/5 rounded-full overflow-hidden">
                <View className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
            </View>
            <Text className="w-8 text-right font-semibold text-white">{score}</Text>
        </View>
    );
}