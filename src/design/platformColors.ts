import { SourcePlatform } from '../types';

export interface PlatformStyleConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Platform color mapping:
 * - behance: blue (#0057FF)
 * - dribble / dribbble: pink (#EA4C89)
 * - pinterest: red (#E60023)
 * - instagram: light purple (#C084FC)
 * - tiktok: cyan (#00F2FE)
 * - youtube: maroon (#800000)
 */
export const PLATFORM_COLOR_MAP: Record<string, PlatformStyleConfig> = {
  behance: {
    backgroundColor: '#0057FF', // Blue
    textColor: '#FFFFFF',
    borderColor: '#0057FF',
  },
  dribble: {
    backgroundColor: '#EA4C89', // Pink
    textColor: '#FFFFFF',
    borderColor: '#EA4C89',
  },
  dribbble: {
    backgroundColor: '#EA4C89', // Pink (standard spelling)
    textColor: '#FFFFFF',
    borderColor: '#EA4C89',
  },
  pinterest: {
    backgroundColor: '#E60023', // Red
    textColor: '#FFFFFF',
    borderColor: '#E60023',
  },
  instagram: {
    backgroundColor: '#C084FC', // Light purple
    textColor: '#000000',
    borderColor: '#C084FC',
  },
  tiktok: {
    backgroundColor: '#00F2FE', // Cyan
    textColor: '#000000',
    borderColor: '#00F2FE',
  },
  youtube: {
    backgroundColor: '#800000', // Maroon
    textColor: '#FFFFFF',
    borderColor: '#800000',
  },
};

/**
 * Known social and content platforms to distinguish from generic content tags.
 */
export const KNOWN_PLATFORMS = new Set<string>([
  'behance',
  'dribble',
  'dribbble',
  'pinterest',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'x',
  'twitter',
  'threads',
  'arena',
  'are.na',
  'github',
  'vimeo',
  'medium',
  'substack',
  'web',
  'note',
  'other',
]);

/**
 * Checks whether a given tag string matches a platform name (to prevent duplicate tag display).
 */
export function isPlatformTag(tag?: string | null, sourcePlatform?: string | null): boolean {
  if (!tag) return false;
  const clean = tag
    .trim()
    .toLowerCase()
    .replace(/^[#@]/, '')
    .trim();
  if (sourcePlatform && clean === sourcePlatform.trim().toLowerCase()) {
    return true;
  }
  return KNOWN_PLATFORMS.has(clean);
}

/**
 * Returns platform styling if the platform (or label/tag) matches a configured platform.
 * Automatically cleans leading '#', '@' and trailing counts/crosses like '(5)' or '✕'.
 */
export function getPlatformBadgeStyle(
  platformOrLabel?: string | SourcePlatform | null
): PlatformStyleConfig | null {
  if (!platformOrLabel) return null;
  const key = platformOrLabel
    .trim()
    .toLowerCase()
    .replace(/^[#@]/, '')
    .replace(/\s*([✕x×]|\(\d+\))$/i, '')
    .trim();
  return PLATFORM_COLOR_MAP[key] || null;
}
