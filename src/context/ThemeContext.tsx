import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors, THEME_PRESETS } from '@/constants/theme';
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
  overrides:   ThemeOverrides;
  setOverride: (key: keyof ThemeOverrides, value: any) => void;
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

  const currentTint = overrides.tint ?? activePresetColors?.accent ?? base.tint;
  const currentTintText = overrides.tintText ?? activePresetColors?.accentText ?? base.tintText;
  const currentIncome = overrides.income ?? activePresetColors?.income ?? base.income;
  const currentIncomeText = activePresetColors?.incomeText ?? base.incomeText;
  const currentExpense = overrides.expense ?? activePresetColors?.expense ?? base.expense;
  const currentExpenseText = activePresetColors?.expenseText ?? base.expenseText;

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
