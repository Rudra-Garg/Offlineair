import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plane, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function FlightSearchScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = () => {
        const query = searchQuery.trim() || 'AI101';
        router.push(`/download/${query}`);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16 }}>
                {/* Header */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '600', marginBottom: 8, lineHeight: 44 }}>
                        Where are{'\n'}you flying?
                    </Text>
                    <Text style={{ color: '#8E8E93', fontSize: 18 }}>Search your flight number</Text>
                </View>

                {/* Search Bar */}
                <View style={{ marginBottom: 40 }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        borderRadius: 50,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                    }}>
                        <Search size={22} color="#4A9EFF" style={{ marginRight: 12 }} />
                        <TextInput
                            placeholder="e.g. AI101"
                            placeholderTextColor="#8E8E93"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            style={{ flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '500' }}
                            autoCapitalize="characters"
                            returnKeyType="search"
                        />
                    </View>
                </View>

                {/* Recent Flights */}
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Recent Flights
                    </Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FlightCard
                            flightNum="AI 101"
                            route="DEL → BOM"
                            time="08:45 AM"
                            status="On Time"
                            statusColor="#00E676"
                            onClick={() => router.push('/download/AI101')}
                        />
                        <View style={{ height: 12 }} />
                        <FlightCard
                            flightNum="BA 234"
                            route="LHR → JFK"
                            time="14:20 PM"
                            status="Delayed"
                            statusColor="#FF9800"
                            onClick={() => router.push('/download/BA234')}
                        />
                    </ScrollView>
                </View>

                {/* CTA Button */}
                <View style={{ paddingTop: 24 }}>
                    <TouchableOpacity
                        onPress={handleSearch}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: '#4A9EFF',
                            borderRadius: 50,
                            paddingVertical: 16,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Find Flight</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

function FlightCard({
    flightNum,
    route,
    time,
    status,
    statusColor,
    onClick,
}: {
    flightNum: string;
    route: string;
    time: string;
    status: string;
    statusColor: string;
    onClick: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onClick}
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
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
            }}>
                <Plane size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 18 }}>{flightNum}</Text>
                <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 2 }}>{route}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#4A9EFF', fontWeight: '600' }}>{time}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50, marginTop: 4 }}>
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: '500' }}>{status}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}