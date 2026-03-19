import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ComparisonScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI101');
    const [activeTab, setActiveTab] = useState('Both');

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>

            {/* ── MAP AREA ── */}
            <View style={{ height: 300, backgroundColor: '#080D18' }}>

                {/* Subtle grid */}
                {[20, 40, 60, 80].map(pct => (
                    <View key={pct} style={{ position: 'absolute', top: `${pct}%` as any, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                ))}
                {[20, 40, 60, 80].map(pct => (
                    <View key={pct} style={{ position: 'absolute', left: `${pct}%` as any, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                ))}

                {/* Route visualisation */}
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 40, right: 40, justifyContent: 'center' }}>

                    {/* Actual route - slightly wavy using segments */}
                    {(activeTab === 'Actual' || activeTab === 'Both') && (
                        <>
                            <View style={{ position: 'absolute', top: '38%', left: 0, right: 0, height: 2.5, backgroundColor: '#00E676', borderRadius: 2, opacity: 0.9 }} />
                        </>
                    )}

                    {/* Estimated route */}
                    {(activeTab === 'Estimated' || activeTab === 'Both') && (
                        <View style={{ position: 'absolute', top: '48%', left: 0, right: 0, height: 2, backgroundColor: '#4A9EFF', borderRadius: 2, opacity: 0.75 }} />
                    )}

                    {/* Deviation dots with connecting lines */}
                    {activeTab === 'Both' && (
                        <>
                            {/* DEL start */}
                            <View style={{ position: 'absolute', top: '35%', left: -8, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4A9EFF', borderWidth: 2, borderColor: '#0A0A0F' }} />
                            {/* Waypoint 1 - green (< 10km) */}
                            <View style={{ position: 'absolute', top: '30%', left: '28%', width: 12, height: 12, borderRadius: 6, backgroundColor: '#00E676', borderWidth: 2, borderColor: '#0A0A0F' }} />
                            <View style={{ position: 'absolute', top: '31%', left: '28.6%', width: 1.5, height: '18%', backgroundColor: 'rgba(0,230,118,0.3)' }} />
                            {/* Waypoint 2 - orange (10-50km) */}
                            <View style={{ position: 'absolute', top: '28%', left: '56%', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF9800', borderWidth: 2, borderColor: '#0A0A0F' }} />
                            <View style={{ position: 'absolute', top: '29%', left: '56.6%', width: 1.5, height: '20%', backgroundColor: 'rgba(255,152,0,0.3)' }} />
                            {/* Waypoint 3 - red (> 50km) */}
                            <View style={{ position: 'absolute', top: '26%', left: '78%', width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336', borderWidth: 2, borderColor: '#0A0A0F' }} />
                            <View style={{ position: 'absolute', top: '27%', left: '78.6%', width: 1.5, height: '22%', backgroundColor: 'rgba(244,67,54,0.3)' }} />
                            {/* BOM end */}
                            <View style={{ position: 'absolute', top: '35%', right: -8, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00E676', borderWidth: 2, borderColor: '#0A0A0F' }} />
                        </>
                    )}

                    {/* Labels */}
                    <Text style={{ position: 'absolute', bottom: '15%', left: -8, color: '#8E8E93', fontSize: 10, fontWeight: '600' }}>DEL</Text>
                    <Text style={{ position: 'absolute', bottom: '15%', right: -8, color: '#8E8E93', fontSize: 10, fontWeight: '600' }}>BOM</Text>
                </View>

                {/* Legend */}
                <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 20, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    {activeTab !== 'Actual' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 18, height: 2, backgroundColor: '#4A9EFF', borderRadius: 1 }} />
                            <Text style={{ color: '#4A9EFF', fontSize: 11, fontWeight: '500' }}>Estimated</Text>
                        </View>
                    )}
                    {activeTab !== 'Estimated' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 18, height: 2, backgroundColor: '#00E676', borderRadius: 1 }} />
                            <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '500' }}>Actual</Text>
                        </View>
                    )}
                </View>

                {/* Overlaid controls */}
                <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <ArrowLeft color="#FFF" size={18} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 50, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        {['Estimated', 'Actual', 'Both'].map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, backgroundColor: activeTab === tab ? '#4A9EFF' : 'transparent' }}
                            >
                                <Text style={{ color: activeTab === tab ? '#FFFFFF' : '#8E8E93', fontSize: 12, fontWeight: '600' }}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* ── BOTTOM SHEET ── */}
            <ScrollView style={{ flex: 1, backgroundColor: '#0A0A0F' }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
                <View style={{ width: 48, height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, alignSelf: 'center', marginVertical: 16 }} />

                {/* Title + Score */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Flight Comparison</Text>
                    <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(74,158,255,0.15)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)' }}>
                        <Text style={{ color: '#4A9EFF', fontWeight: '700', fontSize: 15 }}>Score: 84</Text>
                    </View>
                </View>

                {/* Deviation legend */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <LegendItem color="#00E676" label="< 10km" />
                    <LegendItem color="#FF9800" label="10–50km" />
                    <LegendItem color="#F44336" label="> 50km" />
                </View>

                {/* Timeline */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: '40%', height: '100%', backgroundColor: '#4A9EFF', borderRadius: 2 }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ color: '#8E8E93', fontSize: 11 }}>08:45 DEL</Text>
                        <Text style={{ color: '#8E8E93', fontSize: 11 }}>10:52 BOM</Text>
                    </View>
                </View>

                {/* Phase cards */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                    <PhaseAccuracy label="Climb" score={91} color="#00E676" />
                    <PhaseAccuracy label="Cruise" score={82} color="#4A9EFF" />
                    <PhaseAccuracy label="Descent" score={79} color="#FF9800" />
                </View>

                <TouchableOpacity
                    onPress={() => router.push(`/accuracy/${displayId}`)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingVertical: 16, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>View Full Report</Text>
                    <ChevronRight size={18} color="#8E8E93" />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

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
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{score}</Text>
            </View>
            <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500' }}>{label}</Text>
        </View>
    );
}