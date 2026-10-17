import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Robustly opens an external URL across Web, iOS, and Android.
 * - On Web: uses window.open with fallback to DOM anchor click and window.location.
 * - On iOS/Android: uses WebBrowser.openBrowserAsync (SFSafariViewController / Chrome Custom Tabs)
 *   which avoids universal link failures on deleted/broken items and gives smooth in-app navigation.
 * - Falls back to Linking.openURL if WebBrowser fails.
 */
export async function openExternalUrl(rawUrl?: string | null): Promise<boolean> {
  if (!rawUrl) return false;
  let targetUrl = rawUrl.trim();
  if (!targetUrl) return false;

  // Ensure scheme is present
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  // 1. Web browser handling
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (opened) {
          opened.focus();
          return true;
        }

        // Popup blocker fallback: create invisible link and simulate click
        if (typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = targetUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return true;
        }

        window.location.assign(targetUrl);
        return true;
      }
    } catch {
      try {
        if (typeof window !== 'undefined') {
          window.location.assign(targetUrl);
          return true;
        }
      } catch {}
    }
  }

  // 2. Native Mobile handling (iOS & Android)
  try {
    const result = await WebBrowser.openBrowserAsync(targetUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#FFFFFF',
      toolbarColor: '#090909',
    });
    return result.type !== WebBrowser.WebBrowserResultType.CANCEL;
  } catch {
    try {
      const canOpen = await Linking.canOpenURL(targetUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(targetUrl);
        return true;
      }
      await Linking.openURL(targetUrl);
      return true;
    } catch (err) {
      console.warn('Failed to open external url:', targetUrl, err);
      return false;
    }
  }
}
