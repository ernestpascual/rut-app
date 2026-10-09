// Design tokens strictly conforming to DESIGN.md
import { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  ink: '#000000',
  inkSoft: '#767676',
  inkMid: '#cccccc',
  inkPure: '#000000',
  canvas: '#ffffff',
  surfaceContent: '#ffffff',
  surfaceGrade: '#f4f4f4',
  surfaceOnInk: '#ffffff',
  surfaceOverlay: '#000000',
  hairline: '#000000',
  hairlineSoft: '#cccccc',
  hairlineGrade: '#f4f4f4',
  onInk: '#ffffff',
  onCanvas: '#000000',
  gradeDivider: '#767676',
  gradeMute: '#cccccc',
  gradeBand: '#f4f4f4',
  // Error red is reserved strictly for validation errors and out-of-stock badges. Never on CTAs.
  statusError: '#db1215',
  statusErrorText: '#db1215',
  statusErrorBorder: '#db1215',
} as const;

export const rounded = {
  none: 0,
  pill: 24, // Single rounded element permitted in the system (announcement pill)
  full: 9999,
} as const;

export const spacing = {
  zero: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
  '5xl': 128,
  '6xl': 192,
} as const;

export const typography = {
  displayXl: {
    fontSize: 48,
    fontWeight: '400' as const,
    lineHeight: 56,
    letterSpacing: -0.48, // Negative tracking signature
  },
  displayMd: {
    fontSize: 24,
    fontWeight: '400' as const,
    lineHeight: 32,
    letterSpacing: 0,
  },
  bodyLg: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  navLink: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  captionMd: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  captionCap: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
    textTransform: 'uppercase' as const,
  },
  captionSm: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  inputMd: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 0,
  },
} as const satisfies Record<string, TextStyle>;

export const componentStyles = {
  buttonPrimary: {
    backgroundColor: colors.ink,
    borderRadius: rounded.none,
    height: 46,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  } as ViewStyle,
  buttonSecondary: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.none,
    height: 46,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ink,
  } as ViewStyle,
  textInput: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.none,
    height: 46,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    color: colors.ink,
  } as ViewStyle,
  announcementBar: {
    backgroundColor: colors.surfaceOverlay,
    height: 32,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  announcementPill: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.pill,
    height: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
};
