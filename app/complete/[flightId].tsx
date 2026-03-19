import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Wifi } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function FlightCompleteScreen() {
    const router = useRouter();
    const { flightId } = useLocalSearchParams();
    const displayId = Array.isArray(flightId) ? flightId[0] : (flightId || 'AI 101');

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View style={{ flex: 1, padding: 24 }}>
                {/* Success Icon */}
                <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 40 }}>
                    <View style={{
                        width: 96,
                        height: 96,
                        borderRadius: 48,
                        backgroundColor: 'rgba(0,230,118,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 24,
                    }}>
                        <CheckCircle2 color="#00E676" size={48} />
                    </View>
                    <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                        Flight Complete
                    </Text>
                    <Text style={{ color: '#8E8E93', fontWeight: '500' }}>
                        {displayId} · DEL → BOM · 2h 07m
                    </Text>
                </View>

                {/* Stats Card */}
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 24,
                    padding: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    marginBottom: 40,
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Departed</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>08:45 AM</Text>
                        </View>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Landed</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>10:52 AM</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Distance</Text>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18, marginTop: 4 }}>1,136 km</Text>
                        </View>
                        <View>
                            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Est. Accuracy</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '600', fontSize: 18, marginTop: 4 }}>—</Text>
                        </View>
                    </View>
                </View>

                {/* Sync Section */}
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                        <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: 'rgba(74,158,255,0.2)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 16,
                        }}>
                            <Wifi size={22} color="#4A9EFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>Sync actual flight data</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                                Download real ADS-B track to{'\n'}compare with your estimate
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push(`/comparison/${displayId}`)}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: '#4A9EFF',
                            borderRadius: 50,
                            paddingVertical: 16,
                            alignItems: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Sync Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/')}
                        activeOpacity={0.6}
                        style={{ paddingVertical: 16, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#8E8E93', fontSize: 16, fontWeight: '600' }}>Skip for now</Text>
                    </TouchableOpacity>

                    <Text style={{ textAlign: 'center', color: 'rgba(142,142,147,0.5)', fontSize: 11, marginTop: 8, fontWeight: '500' }}>
                        Data available ~1 hour after landing
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}