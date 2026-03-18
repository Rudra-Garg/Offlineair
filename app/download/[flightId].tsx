import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, ArrowLeft, CheckCircle2, Map, Minus, Navigation, Thermometer } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

export default function PreFlightScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const idValue = Array.isArray(flightId) ? flightId[0] : flightId;
    const displayId = idValue?.replace("%20", " ") || "AI 101";

    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState(0);

    useEffect(() => {
        let currentProgress = 0;
        const interval = setInterval(() => {
            currentProgress += 1;
            setProgress((prev) => {
                const next = prev + 1;
                if (next > 100) return 100;
                return next;
            });

            if (currentProgress >= 25) setStep(1);
            if (currentProgress >= 50) setStep(2);
            if (currentProgress >= 75) setStep(3);
            if (currentProgress >= 100) {
                setStep(4);
                clearInterval(interval);
            }
        }, 40);

        return () => clearInterval(interval);
    }, []);

    const steps = [
        { label: "Route & Waypoints", icon: Navigation },
        { label: "Speed Profile", icon: Activity },
        { label: "Weather SIGMETs", icon: Thermometer },
        { label: "Offline Map Tiles", icon: Map },
    ];

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <View className="flex-1 px-6 pt-12 pb-4">
                <View className="flex-row items-center mb-12">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
                        <ArrowLeft color="#FFF" size={24} />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-white font-semibold text-lg mr-6 tracking-wide">
                        {displayId} · DEL → BOM
                    </Text>
                </View>

                <View className="flex-1 items-center justify-center w-full max-w-sm mx-auto">
                    {/* Circular Progress Placeholder */}
                    <View className="w-56 h-56 mb-12 items-center justify-center rounded-full border-8 border-white/5 relative">
                        <View className="absolute items-center justify-center">
                            <View className="flex-row items-baseline">
                                <Text className="text-white text-6xl font-bold tracking-tighter">
                                    {Math.round(progress)}
                                </Text>
                                <Text className="text-muted text-2xl ml-1">%</Text>
                            </View>
                        </View>
                    </View>

                    <View className="w-full bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
                        {steps.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <View key={i} className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center">
                                        <View
                                            className={`p-2 rounded-xl mr-3 ${i < step
                                                    ? "bg-primary/20"
                                                    : i === step
                                                        ? "bg-white/10"
                                                        : "bg-white/5"
                                                }`}
                                        >
                                            <Icon
                                                size={20}
                                                color={
                                                    i < step ? "#4A9EFF" : i === step ? "#FFF" : "#8E8E93"
                                                }
                                            />
                                        </View>
                                        <Text
                                            className={`text-[15px] font-medium ${i < step ? "text-white" : i === step ? "text-white/90" : "text-muted"
                                                }`}
                                        >
                                            {s.label}
                                        </Text>
                                    </View>
                                    <View className="items-center">
                                        {i < step ? (
                                            <CheckCircle2 size={20} color="#00E676" />
                                        ) : i === step ? (
                                            <ActivityIndicator size="small" color="#4A9EFF" />
                                        ) : (
                                            <Minus size={20} color="rgba(142, 142, 147, 0.5)" />
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View className="mt-auto pt-6">
                    <View className="flex-row justify-center mb-6">
                        <View className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <Text className="text-xs font-medium text-muted">
                                {step === 4 ? "All steps complete" : `Downloading... ${step} of 4`}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        disabled={step < 4}
                        onPress={() => router.push(`/live-map/${displayId.replace(" ", "")}`)}
                        className={`w-full py-4 items-center justify-center rounded-full ${step === 4 ? "bg-primary" : "bg-white/10"
                            }`}
                        activeOpacity={0.8}
                    >
                        <Text
                            className={`text-lg font-semibold ${step === 4 ? "text-white" : "text-muted"
                                }`}
                        >
                            Ready to Fly
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}