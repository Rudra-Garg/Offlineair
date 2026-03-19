import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { DatabaseProvider } from '../db/DatabaseProvider';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="download/[flightId]" />
          <Stack.Screen name="live-map/[flightId]" />
          <Stack.Screen name="complete/[flightId]" />
          <Stack.Screen name="comparison/[flightId]" />
          <Stack.Screen name="accuracy/[flightId]" />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </DatabaseProvider>
  );
}