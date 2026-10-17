export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: Record<string, T>): T => obj.ios ?? obj.default,
};

export const Alert = {
  alert: jest.fn(),
  prompt: jest.fn(),
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};

export const Linking = {
  openURL: jest.fn().mockResolvedValue(true),
  canOpenURL: jest.fn().mockResolvedValue(true),
};

export const View = 'View';
export const Text = 'Text';
export const ScrollView = 'ScrollView';

export default {
  Platform,
  Alert,
  StyleSheet,
  Linking,
  View,
  Text,
  ScrollView,
};
