export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: Record<string, T>): T => obj.ios ?? obj.default,
};

export const Alert = {
  alert: jest.fn(),
  prompt: jest.fn(),
};

export default {
  Platform,
  Alert,
};
