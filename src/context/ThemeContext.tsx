import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STORAGE_KEY = '@theme_overrides_v1';

export interface ThemeOverrides {
  tint?:    string;
  income?:  string;
  expense?: string;
}

interface ThemeContextType {
  theme:       ThemeColors;
  overrides:   ThemeOverrides;
  setOverride: (key: keyof ThemeOverrides, value: string) => void;
  resetTheme:  () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme:       Colors.light,
  overrides:   {},
  setOverride: () => {},
  resetTheme:  () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [overrides, setOverrides] = useState<ThemeOverrides>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => { if (raw) setOverrides(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const setOverride = useCallback((key: keyof ThemeOverrides, value: string) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setOverrides({});
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const base  = Colors[colorScheme ?? 'light'];
  const theme: ThemeColors = {
    ...base,
    ...overrides,
    // keep derived tokens consistent when tint changes
    tabIconSelected: overrides.tint ?? base.tabIconSelected,
    primary:         overrides.tint ?? base.primary,
    success:         overrides.income ?? base.success,
    danger:          overrides.expense ?? base.danger,
  };

  return (
    <ThemeContext.Provider value={{ theme, overrides, setOverride, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
