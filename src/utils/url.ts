import { SourcePlatform } from '../types';

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'si',
  'feature',
];

/**
 * Extracts the first valid HTTP/HTTPS URL from a string.
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  if (!match) return null;
  try {
    const parsed = new URL(match[0]);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return match[0];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Normalizes a URL by stripping tracking query parameters, trimming, and lowercasing hostname.
 */
export function normalizeUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    url.hostname = url.hostname.toLowerCase();

    // Strip common tracking parameters
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Strip trailing slash if path is just /
    let normalized = url.toString();
    if (normalized.endsWith('/') && url.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Detects the source social platform from a URL hostname.
 */
export function detectPlatform(urlOrDomain: string): SourcePlatform {
  if (!urlOrDomain) return 'other';
  const lower = urlOrDomain.toLowerCase();

  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    return 'instagram';
  }
  if (lower.includes('pinterest.com') || lower.includes('pin.it')) {
    return 'pinterest';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lower.includes('twitter.com') || lower.includes('x.com') || lower.includes('t.co')) {
    return 'x';
  }
  if (lower.includes('threads.net') || lower.includes('threads.com')) {
    return 'threads';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return 'web';
  }
  return 'other';
}

/**
 * Extracts clean domain name from URL.
 */
export function extractDomain(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Deterministic hash generator for duplicate detection.
 * Simple cross-platform hash implementation (djb2 + hex).
 */
export function generateContentHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}
