import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/features/auth/AuthContext';

/**
 * Share Target Redirect
 * On mobile, forwards incoming shares directly to /(app)/inspiration/new (add new inspiration).
 * On web, safely routes to Bank if logged in, or Login if unauthenticated.
 * Prevents any infinite loops.
 */
export default function ShareTargetRedirect() {
  const router = useRouter();
  const { user, stagedShare, clearStagedShare } = useAuth();
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace(user ? '/(app)/(tabs)/bank' : '/');
      return;
    }

    const queryParams: Record<string, string> = {};
    if (params.url) queryParams.url = String(params.url);
    if (params.text) queryParams.text = String(params.text);
    if (params.title) queryParams.title = String(params.title);

    // If query params are empty but stagedShare exists (e.g., from login after sharing while signed out):
    if (!queryParams.url && !queryParams.text && stagedShare) {
      if (stagedShare.url) queryParams.url = stagedShare.url;
      if (stagedShare.text) queryParams.text = stagedShare.text;
      if (stagedShare.title) queryParams.title = stagedShare.title;
      clearStagedShare();
    }

    router.replace({
      pathname: '/(app)/inspiration/new',
      params: queryParams,
    });
  }, [user, params, stagedShare, clearStagedShare, router]);

  return null;
}
