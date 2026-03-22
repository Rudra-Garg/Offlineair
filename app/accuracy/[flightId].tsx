/**
 * app/accuracy/[flightId].tsx
 * Accuracy Report Card — final post-flight summary.
 *
 * Reads DeviationReport from the Zustand store (populated by FlightComparator
 * which runs automatically after AdsbSync on the complete screen).
 *
 * If the report is not yet available (e.g. user navigated here directly),
 * shows a clear "pending" state rather than fake hardcoded numbers.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, TrendingDown, TrendingUp, Minus } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeviationReport, useMapViewModel } from '../../store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
    if (score >= 80) return '#00E676';
    if (score >= 60) return '#FF9800';
    return '#F44336';
}

function scoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Great';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
}

function fmt(km: number | undefined | null): string {
    if (km == null) return '--';
    return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <View style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
        }}>
            <Text style={{ color: '#8E8E93', fontSize: 11, fontWeight: '500', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {label}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{value}</Text>
            {sub && <Text style={{ color: '#8E8E93', fontSize: 11, marginTop: 4 }}>{sub}</Text>}
        </View>
    );
}

function PhaseBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
    const color = scoreColor(score);
    return (
        <View style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 16, padding: 16, marginBottom: 10,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {icon}
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>{label}</Text>
                </View>
                <Text style={{ color, fontWeight: '700', fontSize: 15 }}>{Math.round(score)}</Text>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${Math.min(100, score)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
            </View>
        </View>
    );
}

function ScoreRing({ score }: { score: number }) {
    const color = scoreColor(score);
    const rounded = Math.round(score);
    return (
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 32 }}>
            <View style={{
                width: 160, height: 160, borderRadius: 80,
                borderWidth: 14, borderColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <View style={{
                    position: 'absolute', width: 160, height: 160, borderRadius: 80,
                    borderWidth: 14,
                    borderTopColor:    rounded >= 10  ? color : 'transparent',
                    borderRightColor:  rounded >= 35  ? color : 'transparent',
                    borderBottomColor: rounded >= 60  ? color : 'transparent',
                    borderLeftColor:   rounded >= 85  ? color : 'transparent',
                    transform: [{ rotate: '-45deg' }],
                }} />
                <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 44, fontWeight: '800', letterSpacing: -2 }}>
                        {rounded}
                    </Text>
                    <Text style={{ color, fontSize: 13, fontWeight: '600', marginTop: -2 }}>
                        {scoreLabel(score)}
                    </Text>
                </View>
            </View>
            <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 12 }}>Accuracy Score</Text>
        </View>
    );
}

// ─── Pending state ────────────────────────────────────────────────────────────

function PendingState({ onBack }: { onBack: () => void }) {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <TouchableOpacity
                    onPress={onBack}
                    style={{ position: 'absolute', top: 16, left: 16, padding: 8 }}
                >
                    <ArrowLeft color="#FFF" size={22} />
                </TouchableOpacity>
                <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(74,158,255,0.1)',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 24,
                }}>
                    <TrendingUp size={36} color="#4A9EFF" />
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
                    Report not ready
                </Text>
                <Text style={{ color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                    Sync your flight data first to generate an accuracy report. Go back and tap "Sync Now".
                </Text>
            </View>
        </SafeAreaView>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccuracyReportScreen() {
    const router        = useRouter();
    const { flightId }  = useLocalSearchParams();
    const displayId     = Array.isArray(flightId) ? flightId[0] : (flightId ?? 'AI101');

    const report        = useDeviationReport();
    const activeFlight  = useMapViewModel(s => s.activeFlight);

    if (!report) {
        return <PendingState onBack={() => router.back()} />;
    }

    const {
        accuracyScore,
        rmseKm,
        maxDeviationKm,
        avgDeviationKm,
        phaseAccuracy,
    } = report;

    const handleShare = async () => {
        try {
            await Share.share({
                message:
                    `OfflineAir — ${displayId} Accuracy Report\n` +
                    `Score: ${Math.round(accuracyScore)}/100 (${scoreLabel(accuracyScore)})\n` +
                    `RMSE: ${fmt(rmseKm)} | Max deviation: ${fmt(maxDeviationKm)}\n` +
                    `Climb: ${Math.round(phaseAccuracy.climb)} | ` +
                    `Cruise: ${Math.round(phaseAccuracy.cruise)} | ` +
                    `Descent: ${Math.round(phaseAccuracy.descent)}`,
                title: `${displayId} Accuracy Report`,
            });
        } catch {
            // user dismissed share sheet
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 8, marginLeft: -8, marginRight: 8 }}
                    >
                        <ArrowLeft color="#FFF" size={22} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Accuracy Report</Text>
                        <Text style={{ color: '#8E8E93', fontSize: 13 }}>
                            {displayId}
                            {activeFlight ? ` · ${activeFlight.origin} → ${activeFlight.destination}` : ''}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleShare}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            backgroundColor: 'rgba(74,158,255,0.15)',
                            paddingHorizontal: 14, paddingVertical: 8,
                            borderRadius: 50, borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)',
                        }}
                    >
                        <Share2 size={15} color="#4A9EFF" />
                        <Text style={{ color: '#4A9EFF', fontWeight: '600', fontSize: 13 }}>Share</Text>
                    </TouchableOpacity>
                </View>

                {/* Score ring */}
                <ScoreRing score={accuracyScore} />

                {/* Stat cards */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                    <StatCard label="RMSE"    value={fmt(rmseKm)}         sub="root mean sq error" />
                    <StatCard label="Max Dev" value={fmt(maxDeviationKm)} sub="worst single point"  />
                    <StatCard label="Avg Dev" value={fmt(avgDeviationKm)} sub="mean deviation"      />
                </View>

                {/* Phase breakdown */}
                <Text style={{
                    color: '#8E8E93', fontSize: 11, fontWeight: '500',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14,
                }}>
                    Phase Breakdown
                </Text>

                <PhaseBar label="Climb"   score={phaseAccuracy.climb}   icon={<TrendingUp   size={16} color="#8E8E93" />} />
                <PhaseBar label="Cruise"  score={phaseAccuracy.cruise}  icon={<Minus        size={16} color="#8E8E93" />} />
                <PhaseBar label="Descent" score={phaseAccuracy.descent} icon={<TrendingDown size={16} color="#8E8E93" />} />

                {/* Formula note */}
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 12, padding: 14, marginTop: 8,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                }}>
                    <Text style={{ color: '#8E8E93', fontSize: 11, lineHeight: 18 }}>
                        Score = clamp(100 − RMSE × 2, 0, 100){'\n'}
                        Score {'>'} 80 means RMSE {'<'} 10 km — excellent dead reckoning accuracy.{'\n'}
                        Generated {new Date(report.generatedAt * 1000).toLocaleString('en-IN', {
                            dateStyle: 'medium', timeStyle: 'short',
                        })}.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}