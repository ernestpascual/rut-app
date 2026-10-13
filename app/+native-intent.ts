import { extractInstagramUrl, extractUrlFromText } from '../src/utils/url';

// Native intent handler for Expo Router
// Rewrites deep links, Instagram share-to actions, and system share intents to /share-target

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  if (!path) return path;

  try {
    // 1. If already explicitly targeting /share-target, ensure clean leading slash
    if (path.startsWith('/share-target') || path.startsWith('share-target')) {
      return path.startsWith('/') ? path : `/${path}`;
    }

    // 2. Decode path if URL encoded
    let decoded = path;
    try {
      if (path.includes('%3A') || path.includes('%2F')) {
        decoded = decodeURIComponent(path);
      }
    } catch {}

    // 3. Instagram direct share detection (URL or text containing Instagram link)
    if (decoded.includes('instagram.com') || decoded.includes('instagr.am')) {
      const igUrl = extractInstagramUrl(decoded);
      if (igUrl) {
        // Check if there is also caption/text before or after the URL
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
        return `/share-target?${params.toString()}`;
      }
    }

    // 4. General social or web URL in intent (TikTok, Pinterest, Threads, X, YouTube, or HTTP link)
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
      return `/share-target?${params.toString()}`;
    }

    // 5. Deep link with query parameters (e.g. rut://share?text=..., rut://?url=..., rut://share-target?...)
    if (path.startsWith('rut://') || path.includes('share') || path.includes('url=') || path.includes('text=')) {
      const normalizedPath = path.startsWith('rut://')
        ? path.replace('rut://', 'https://rut.local/')
        : path.startsWith('/')
        ? `https://rut.local${path}`
        : `https://rut.local/${path}`;

      const fakeUrl = new URL(normalizedPath, 'https://rut.local');
      const searchParams = fakeUrl.searchParams;

      if (searchParams.has('url') || searchParams.has('text') || searchParams.has('title')) {
        return `/share-target?${searchParams.toString()}`;
      }

      if (path.includes('share')) {
        const sp = searchParams.toString();
        return sp ? `/share-target?${sp}` : '/share-target';
      }
    }
  } catch (e) {
    // Graceful fallback to original path
  }

  return path;
}
