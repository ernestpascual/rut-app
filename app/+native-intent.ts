import { Platform } from 'react-native';
import { extractInstagramUrl, extractUrlFromText } from '../src/utils/url';

// Native intent handler for Expo Router
// Rewrites mobile deep links and Instagram share-to actions directly to /(app)/inspiration/new
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  // CRITICAL: Only handle intents on native mobile apps (iOS/Android). Never on web!
  if (Platform.OS === 'web' || !path) {
    return path;
  }

  try {
    // If already targeting inspiration/new, let it proceed
    if (path.includes('inspiration/new')) {
      return path.startsWith('/') ? path : `/${path}`;
    }

    // Decode path if URL encoded
    let decoded = path;
    try {
      if (path.includes('%3A') || path.includes('%2F')) {
        decoded = decodeURIComponent(path);
      }
    } catch {}

    // 1. Instagram direct share detection (URL or text containing Instagram link)
    if (decoded.includes('instagram.com') || decoded.includes('instagr.am')) {
      const igUrl = extractInstagramUrl(decoded);
      if (igUrl) {
        const remainingText = decoded
          .replace(igUrl, '')
          .replace(/^rut:\/\/?/, '')
          .replace(/^https?:\/\/rut\.local\/?/, '')
          .replace(/[?&](?:url|text)=/g, '')
          .trim();

        const params = new URLSearchParams();
        params.set('url', igUrl);
        if (remainingText && remainingText.length > 2) {
          params.set('text', remainingText);
        }
        return `/(app)/inspiration/new?${params.toString()}`;
      }
    }

    // 2. General social or web URL in intent (TikTok, Pinterest, Threads, X, YouTube, or HTTP link)
    const extractedUrl = extractUrlFromText(decoded);
    if (extractedUrl && (path.startsWith('rut://') || path.includes('share') || !path.startsWith('/'))) {
      const remainingText = decoded
        .replace(extractedUrl, '')
        .replace(/^rut:\/\/?/, '')
        .replace(/[?&](?:url|text)=/g, '')
        .trim();

      const params = new URLSearchParams();
      params.set('url', extractedUrl);
      if (remainingText && remainingText.length > 2) {
        params.set('text', remainingText);
      }
      return `/(app)/inspiration/new?${params.toString()}`;
    }

    // 3. Deep link with query parameters (e.g. rut://share?text=..., rut://?url=...)
    if (path.startsWith('rut://') || path.includes('share') || path.includes('url=') || path.includes('text=')) {
      const normalizedPath = path.startsWith('rut://')
        ? path.replace('rut://', 'https://rut.local/')
        : path.startsWith('/')
        ? `https://rut.local${path}`
        : `https://rut.local/${path}`;

      const fakeUrl = new URL(normalizedPath, 'https://rut.local');
      const searchParams = fakeUrl.searchParams;

      if (searchParams.has('url') || searchParams.has('text') || searchParams.has('title')) {
        return `/(app)/inspiration/new?${searchParams.toString()}`;
      }

      if (path.includes('share')) {
        return '/(app)/inspiration/new';
      }
    }
  } catch (e) {
    // Graceful fallback to original path
  }

  return path;
}
