import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/features/auth/AuthContext';
import { ThemeProvider, useTheme } from '../src/design/ThemeContext';

import * as Linking from 'expo-linking';
import { redirectSystemPath } from './+native-intent';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Only listen for deep link shares on native mobile (iOS/Android). Never on web!
    if (Platform.OS === 'web') return;

    const handleUrl = (event: { url: string }) => {
      if (!event.url) return;
      try {
        const redirected = redirectSystemPath({ path: event.url, initial: false });
        if (redirected && (redirected.includes('inspiration/new') || redirected.startsWith('/(app)/inspiration/new'))) {
          router.push(redirected as any);
        }
      } catch {}
    };

    const sub = Linking.addEventListener('url', handleUrl);
    return () => {
      sub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isRootLanding = !(segments as any)?.[0] || (segments as any)?.[0] === 'index';
    const isAuthRoute = inAuthGroup || isRootLanding;

    if (!user && !isAuthRoute) {
      // Redirect to login if trying to access private routes
      router.replace('/');
    } else if (user && isAuthRoute) {
      router.replace('/(app)/(tabs)/bank');
    }
  }, [user, loading, segments]);

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
