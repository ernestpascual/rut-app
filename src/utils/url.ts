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
  'igsh',
  'ig_mid',
  'img_index',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'si',
  'feature',
];

/**
 * Extracts the first valid HTTP/HTTPS URL from a string, stripping trailing punctuation.
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  if (!match) return null;
  try {
    const cleanCandidate = match[0].replace(/[.,)\]"'>]+$/, '').trim();
    const parsed = new URL(cleanCandidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return cleanCandidate;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Detects and normalizes an Instagram URL from text or raw link.
 */
export function extractInstagramUrl(input: string): string | null {
  if (!input) return null;
  const match = input.match(/(https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+)/i);
  if (match) {
    const cleaned = match[0].replace(/[.,)\]"'>]+$/, '').trim();
    return normalizeUrl(cleaned) || cleaned;
  }
  const noProto = input.match(/((?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+)/i);
  if (noProto) {
    const cleaned = `https://${noProto[0].replace(/[.,)\]"'>]+$/, '').trim()}`;
    return normalizeUrl(cleaned) || cleaned;
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
  if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) {
    return 'facebook';
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
  if (lower.includes('behance.net')) {
    return 'behance';
  }
  if (lower.includes('dribbble.com') || lower.includes('dribble.com')) {
    return 'dribbble';
  }
  if (lower.includes('are.na')) {
    return 'arena';
  }
  if (lower.includes('github.com')) {
    return 'github';
  }
  if (lower.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (lower.includes('medium.com')) {
    return 'medium';
  }
  if (lower.includes('substack.com')) {
    return 'substack';
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
