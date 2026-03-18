import { useRouter } from 'expo-router';
import { Plane, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function FlightSearchScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/download/${searchQuery}`);
        } else {
            router.push('/download/AI101');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-dark">
            <View className="flex-1 px-6 pt-12 pb-4">
                <View className="mb-8">
                    <Text className="text-white text-4xl font-semibold mb-2 tracking-tight">
                        Where are{'\n'}you flying?
                    </Text>
                    <Text className="text-muted text-lg">Search your flight number</Text>
                </View>

                <View className="mb-10">
                    <View className="relative flex-row items-center px-5 py-4 rounded-full border border-white/10 bg-white/5">
                        <Search size={24} color="#4A9EFF" className="mr-3" />
                        <TextInput
                            placeholder="e.g. AI101"
                            placeholderTextColor="#8E8E93"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            className="flex-1 text-white text-lg font-medium"
                            autoCapitalize="characters"
                            returnKeyType="search"
                        />
                    </View>
                </View>

                <View className="flex-1">
                    <Text className="text-muted text-sm font-medium mb-4 uppercase tracking-wider">
                        Recent Flights
                    </Text>
                    <ScrollView className="space-y-4">
                        <FlightCard
                            flightNum="AI 101"
                            route="DEL → BOM"
                            time="08:45 AM"
                            status="On Time"
                            statusColor="text-[#00E676]"
                            onClick={() => router.push('/download/AI101')}
                        />
                        <View className="h-4" />
                        <FlightCard
                            flightNum="BA 234"
                            route="LHR → JFK"
                            time="14:20 PM"
                            status="Delayed"
                            statusColor="text-[#FF9800]"
                            onClick={() => router.push('/download/BA234')}
                        />
                    </ScrollView>
                </View>

                <View className="mt-auto pt-6">
                    <TouchableOpacity
                        onPress={handleSearch}
                        className="w-full bg-primary rounded-full py-4 items-center justify-center"
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-lg font-semibold">Find Flight</Text>
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
            className="w-full rounded-2xl p-4 flex-row items-center bg-white/5 border border-white/10"
        >
            <View className="w-12 h-12 rounded-full bg-white/10 items-center justify-center mr-4">
                <Plane size={24} color="#FFF" />
            </View>
            <View className="flex-1">
                <Text className="text-white font-semibold text-lg">{flightNum}</Text>
                <Text className="text-muted text-sm mt-1">{route}</Text>
            </View>
            <View className="items-end">
                <Text className="text-primary font-semibold">{time}</Text>
                <View className="bg-white/10 px-2 py-1 rounded-full mt-1">
                    <Text className={`${statusColor} text-xs font-medium`}>{status}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}