// Native intent handler for Expo Router
// Rewrites deep links and system share intents to /share-target

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    // If the path contains an incoming share intent
    if (path.includes('share') || path.startsWith('rut://share')) {
      const url = new URL(path.startsWith('rut://') ? path.replace('rut://', 'https://rut.local/') : path, 'https://rut.local');
      const searchParams = url.searchParams.toString();
      return `/share-target?${searchParams}`;
    }
  } catch (e) {
    // Fallback
  }
  return path;
}
