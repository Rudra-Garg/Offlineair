/**
 * app/index.tsx
 *
 * Home screen — flight search + history from real DB.
 *
 * On mount: loads all past flights from SQLite via repo.getAllFlights()
 * Search:   navigates to /download/[flightId] for any entered flight number
 * History:  shows real DB rows with real status badges
 */

import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plane, Search, Clock, CheckCircle2, Radio, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { repo } from '../db/SQLiteRepository';
import type { Flight, FlightStatus } from '../db/types';

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusLabel(status: FlightStatus): string {
    switch (status) {
        case 'PENDING':   return 'Ready';
        case 'IN_FLIGHT': return 'In Flight';
        case 'LANDED':    return 'Landed';
        case 'SYNCED':    return 'Synced';
    }
}

function statusColor(status: FlightStatus): string {
    switch (status) {
        case 'PENDING':   return '#4A9EFF';
        case 'IN_FLIGHT': return '#00E676';
        case 'LANDED':    return '#FF9800';
        case 'SYNCED':    return '#8E8E93';
    }
}

function StatusIcon({ status, size = 16 }: { status: FlightStatus; size?: number }) {
    const color = statusColor(status);
    switch (status) {
        case 'PENDING':   return <Clock size={size} color={color} />;
        case 'IN_FLIGHT': return <Radio size={size} color={color} />;
        case 'LANDED':    return <XCircle size={size} color={color} />;
        case 'SYNCED':    return <CheckCircle2 size={size} color={color} />;
    }
}

// ─── Flight card ──────────────────────────────────────────────────────────────

function FlightCard({
    flight,
    onPress,
}: {
    flight: Flight;
    onPress: () => void;
}) {
    const color = statusColor(flight.status);
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
            }}
        >
            <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 16,
            }}>
                <Plane size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>
                    {flight.flightNumber.replace(/([A-Za-z]+)(\d+)/, '$1 $2')}
                </Text>
                <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 2 }}>
                    {flight.origin} → {flight.destination}
                    {flight.aircraftType ? ` · ${flight.aircraftType}` : ''}
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 50,
                }}>
                    <StatusIcon status={flight.status} size={11} />
                    <Text style={{ color, fontSize: 11, fontWeight: '500' }}>
                        {statusLabel(flight.status)}
                    </Text>
                </View>
                <Text style={{ color: '#8E8E93', fontSize: 11, marginTop: 6 }}>
                    {new Date(flight.createdAt * 1000).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                    })}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FlightSearchScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery]     = useState('');
    const [flights, setFlights]             = useState<Flight[]>([]);
    const [loading, setLoading]             = useState(true);
    const [refreshing, setRefreshing]       = useState(false);

    const loadFlights = useCallback(async () => {
        try {
            const all = await repo.getAllFlights();
            setFlights(all);
        } catch (e) {
            console.warn('[Home] Failed to load flights:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadFlights(); }, [loadFlights]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadFlights();
    };

    const handleSearch = () => {
        const query = searchQuery.trim();
        if (!query) return;
        // Normalise spacing: "AI 101" → "AI101"
        const normalised = query.replace(/\s+/g, '').toUpperCase();
        router.push(`/download/${normalised}`);
    };

    const handleFlightPress = (flight: Flight) => {
        switch (flight.status) {
            case 'PENDING':
                // Re-enter the live map (bundle already downloaded)
                router.push(`/live-map/${flight.flightNumber}`);
                break;
            case 'IN_FLIGHT':
                router.push(`/live-map/${flight.flightNumber}`);
                break;
            case 'LANDED':
                // Offer sync
                router.push(`/complete/${flight.flightNumber}`);
                break;
            case 'SYNCED':
                // Jump straight to comparison
                router.push(`/comparison/${flight.flightNumber}`);
                break;
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16 }}>

                {/* Header */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '600', marginBottom: 8, lineHeight: 44 }}>
                        Where are{'\n'}you flying?
                    </Text>
                    <Text style={{ color: '#8E8E93', fontSize: 18 }}>Enter any flight number</Text>
                </View>

                {/* Search bar */}
                <View style={{ marginBottom: 40 }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20, paddingVertical: 16,
                        borderRadius: 50,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                    }}>
                        <Search size={22} color="#4A9EFF" style={{ marginRight: 12 }} />
                        <TextInput
                            placeholder="e.g. AI101, BA234, 6E201"
                            placeholderTextColor="#8E8E93"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            style={{ flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '500' }}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                                <XCircle size={18} color="#8E8E93" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Flight history */}
                <View style={{ flex: 1 }}>
                    <Text style={{
                        color: '#8E8E93', fontSize: 12, fontWeight: '500',
                        marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1,
                    }}>
                        {flights.length > 0 ? 'Recent Flights' : 'No flights yet'}
                    </Text>

                    {loading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color="#4A9EFF" />
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    tintColor="#4A9EFF"
                                />
                            }
                        >
                            {flights.map((flight, i) => (
                                <View key={flight.id}>
                                    <FlightCard
                                        flight={flight}
                                        onPress={() => handleFlightPress(flight)}
                                    />
                                    {i < flights.length - 1 && <View style={{ height: 12 }} />}
                                </View>
                            ))}

                            {flights.length === 0 && (
                                <View style={{
                                    alignItems: 'center', paddingTop: 40,
                                    paddingHorizontal: 24,
                                }}>
                                    <Plane size={40} color="rgba(142,142,147,0.3)" />
                                    <Text style={{
                                        color: '#8E8E93', fontSize: 15,
                                        marginTop: 16, textAlign: 'center', lineHeight: 22,
                                    }}>
                                        Search for a flight above to get started.{'\n'}
                                        Your history will appear here.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>

                {/* CTA */}
                <View style={{ paddingTop: 24 }}>
                    <TouchableOpacity
                        onPress={handleSearch}
                        activeOpacity={searchQuery.trim() ? 0.8 : 0.4}
                        style={{
                            backgroundColor: searchQuery.trim() ? '#4A9EFF' : 'rgba(74,158,255,0.3)',
                            borderRadius: 50, paddingVertical: 16, alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                            Find Flight
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}