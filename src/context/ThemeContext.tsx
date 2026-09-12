import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors, THEME_PRESETS, getContrastText, withContrastText } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STORAGE_KEY = '@theme_overrides_v1';

export interface ThemeOverrides {
  presetName?: string;
  tint?:    string;
  tintText?: string;
  income?:  string;
  expense?: string;
  themeMode?: 'light' | 'dark' | 'system';
}

interface ThemeContextType {
  theme:       ThemeColors;
  /** The scheme actually in force after the user's override and the system setting. */
  scheme:      'light' | 'dark';
  isDark:      boolean;
  overrides:   ThemeOverrides;
  setOverride: (key: keyof ThemeOverrides, value: any) => void;
  resetTheme:  () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme:       withContrastText(Colors.light),
  scheme:      'light',
  isDark:      false,
  overrides:   {},
  setOverride: () => {},
  resetTheme:  () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [overrides, setOverrides] = useState<ThemeOverrides>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try { setOverrides(JSON.parse(raw)); }
          catch { AsyncStorage.removeItem(STORAGE_KEY).catch(() => {}); }
        }
      })
      .catch(() => {});
  }, []);

  const setOverride = useCallback((key: keyof ThemeOverrides, value: any) => {
    setOverrides(prev => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setOverrides({});
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const systemScheme = useColorScheme();
  const activeScheme = overrides.themeMode && overrides.themeMode !== 'system'
    ? overrides.themeMode
    : (systemScheme ?? 'light');

  const base  = Colors[activeScheme];
  const activePreset = overrides.presetName ? THEME_PRESETS.find(p => p.name === overrides.presetName) : undefined;
  const activePresetColors = activePreset ? activePreset[activeScheme] : undefined;

  // One rule for every foreground, with no exceptions: compute it from the background it sits on.
  // The presets used to be trusted to declare their own, and 25 of their 48 pairs were below
  // 4.5:1 — white on Graphite's #22C55E income is 2.28:1 — with getContrastText beating the
  // declared value in every one of the 25. Never read a *Text token from `base` either.
  const currentTint        = overrides.tint    ?? activePresetColors?.accent  ?? base.tint;
  const currentTintText    = getContrastText(currentTint);
  const currentIncome      = overrides.income  ?? activePresetColors?.income  ?? base.income;
  const currentIncomeText  = getContrastText(currentIncome);
  const currentExpense     = overrides.expense ?? activePresetColors?.expense ?? base.expense;
  const currentExpenseText = getContrastText(currentExpense);

  const theme: ThemeColors = {
    ...base,
    tint:            currentTint,
    tintText:        currentTintText,
    income:          currentIncome,
    incomeText:      currentIncomeText,
    expense:         currentExpense,
    expenseText:     currentExpenseText,
    tabIconSelected: currentTint,
    primary:         currentTint,
    success:         base.success,
    danger:          currentExpense,
    warningText:     getContrastText(base.warning),
  };

  return (
    <ThemeContext.Provider value={{ theme, scheme: activeScheme, isDark: activeScheme === 'dark', overrides, setOverride, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
