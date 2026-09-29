import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colour } from '../src/theme';

/**
 * The shell. One scheme, because the brand is dark (docs/brand.md), and no
 * header of the router's own: every screen carries its own bar, which is what
 * lets the walk take the whole display.
 */
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colour.ink },
        }}
      />
    </SafeAreaProvider>
  );
}
