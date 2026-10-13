import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/features/auth/AuthContext';
import { ThemeProvider, useTheme } from '../src/design/ThemeContext';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, stagedShare } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inShareTarget = segments[0] === 'share-target';
    const isRootLanding = !(segments as any)?.[0] || (segments as any)?.[0] === 'index';
    const isAuthRoute = inAuthGroup || isRootLanding;

    if (!user && !isAuthRoute && !inShareTarget) {
      // Redirect to login if trying to access private routes
      router.replace('/');
    } else if (user && isAuthRoute) {
      if (stagedShare) {
        // Restore staged share after authentication
        router.replace('/share-target');
      } else {
        router.replace('/(app)/(tabs)/bank');
      }
    }
  }, [user, loading, segments, stagedShare]);

  return <>{children}</>;
}

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'none', // Strict editorial flat feel
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="share-target" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationGuard>
            <RootNavigator />
          </NavigationGuard>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
