import { ViewStyle, TextStyle } from 'react-native';
import { SourcePlatform } from '../types';

export interface PlatformStyleConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Platform color mapping:
 * - behance: blue
 * - dribble / dribbble: pink
 * - pinterest: red
 * - instagram: light purple
 * - tiktok: cyan
 * - youtube: maroon
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
 * Returns platform styling if the platform (or label) matches a configured platform.
 */
export function getPlatformBadgeStyle(
  platformOrLabel?: string | SourcePlatform | null
): PlatformStyleConfig | null {
  if (!platformOrLabel) return null;
  const key = platformOrLabel.trim().toLowerCase();
  return PLATFORM_COLOR_MAP[key] || null;
}
