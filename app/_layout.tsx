import React, { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/features/auth/AuthContext';
import { ThemeProvider, useTheme } from '../src/design/ThemeContext';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { stagePendingShare } from '../src/features/capture/stagingStorage';
import { extractInstagramUrl, extractUrlFromText, detectPlatform } from '../src/utils/url';
import { IncomingSharePayload } from '../src/types';

import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import { redirectSystemPath } from './+native-intent';

function ShareIntentHandler() {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const lastProcessedKey = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!hasShareIntent) return;

    const currentKey = JSON.stringify({
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      type: shareIntent.type,
      files: shareIntent.files?.map((f) => f.path || f.fileName),
    });

    if (lastProcessedKey.current === currentKey) {
      return;
    }
    lastProcessedKey.current = currentKey;

    const rawText = shareIntent.text || '';
    const extractedUrl =
      shareIntent.webUrl ||
      extractInstagramUrl(rawText) ||
      extractUrlFromText(rawText);
    const title = shareIntent.meta?.title || '';
    const cleanNote = extractedUrl && rawText ? rawText.replace(extractedUrl, '').trim() : rawText.trim();

    const isBinaryOnly =
      (shareIntent.type === 'media' || shareIntent.type === 'file') &&
      !extractedUrl &&
      !cleanNote;

    if (isBinaryOnly) {
      Alert.alert(
        'File capture not supported',
        'File capture (images/videos) is not supported in this version. You can save text notes and links.'
      );
      resetShareIntent();
      return;
    }

    if (extractedUrl || cleanNote) {
      const payload: IncomingSharePayload = {
        url: extractedUrl || undefined,
        text: cleanNote || undefined,
        title: title || undefined,
      };

      if (user) {
        const queryParams: Record<string, string> = {};
        if (payload.url) queryParams.url = payload.url;
        if (payload.text) queryParams.text = payload.text;
        if (payload.title) queryParams.title = payload.title;

        const isAlreadyOnNew = segments[0] === '(app)' && segments[1] === 'inspiration' && segments[2] === 'new';
        const isNotFound = (segments as any)?.[0] === '+not-found';

        if (isAlreadyOnNew || isNotFound) {
          router.replace({
            pathname: '/(app)/inspiration/new',
            params: queryParams,
          });
        } else {
          router.push({
            pathname: '/(app)/inspiration/new',
            params: queryParams,
          });
        }
      } else {
        stagePendingShare(payload);
        router.replace('/');
      }
    }

    resetShareIntent();
  }, [hasShareIntent, shareIntent, user, router, resetShareIntent, segments]);

  return null;
}

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Only listen for deep link shares on native mobile (iOS/Android). Never on web!
    if (Platform.OS === 'web') return;

    const handleUrl = (event: { url: string }) => {
      if (!event.url) return;
      // Internal iOS share extension data transfers are handled natively by ShareIntentHandler
      if (event.url.includes('dataUrl=')) return;
      try {
        const redirected = redirectSystemPath({ path: event.url, initial: false });
        if (redirected && (redirected.includes('inspiration/new') || redirected.startsWith('/(app)/inspiration/new'))) {
          const isAlreadyOnNew = segments[0] === '(app)' && segments[1] === 'inspiration' && segments[2] === 'new';
          const isNotFound = (segments as any)?.[0] === '+not-found';
          if (isAlreadyOnNew || isNotFound) {
            router.replace(redirected as any);
          } else {
            router.push(redirected as any);
          }
        }
      } catch {}
    };

    const sub = Linking.addEventListener('url', handleUrl);
    return () => {
      sub.remove();
    };
  }, [router, segments]);

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
  useFonts({
    ...(Feather.font || {}),
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ShareIntentProvider options={{ resetOnBackground: false, disabled: Platform.OS === 'web' }}>
            <NavigationGuard>
              <ShareIntentHandler />
              <RootNavigator />
            </NavigationGuard>
          </ShareIntentProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
