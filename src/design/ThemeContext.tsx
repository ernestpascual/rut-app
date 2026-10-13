import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ThemeColors } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = '@rut_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  isDark: false,
  colors: lightColors,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
      })
      .catch((err) => {
        console.warn('Failed to load theme preference from storage:', err);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) => {
      console.warn('Failed to persist theme preference:', err);
    });
  };

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const toggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  const currentColors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  const value = useMemo(
    () => ({
      themeMode,
      isDark,
      colors: currentColors,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, isDark, currentColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  return useContext(ThemeContext);
};
