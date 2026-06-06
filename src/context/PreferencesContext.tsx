import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppPrefs, CurrencyCode, CURRENCY_META,
  getPrefs, setPrefs,
} from '@/src/services/preferencesService';
import { applyCurrency } from '@/constants/theme';

interface PreferencesContextType {
  prefs: AppPrefs;
  updatePrefs: (partial: Partial<AppPrefs>) => Promise<void>;
  /** Reactive currency formatter — re-renders subscribers when currency changes */
  formatAmount: (amount: number) => string;
  /** 0 = Sunday, 1 = Monday */
  weekStartIndex: 0 | 1;
}

const DEFAULTS: AppPrefs = {
  currency:      'INR',
  monthlyStart:  1,
  weekStart:     'Sun',
  notifications: false,
};

const PreferencesContext = createContext<PreferencesContextType>({
  prefs:          DEFAULTS,
  updatePrefs:    async () => {},
  formatAmount:   (n) => `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  weekStartIndex: 0,
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<AppPrefs>(DEFAULTS);

  const applyAndSet = useCallback((p: AppPrefs) => {
    const meta = CURRENCY_META[p.currency as CurrencyCode];
    if (meta) applyCurrency(meta.symbol, meta.locale);
    setPrefsState(p);
  }, []);

  useEffect(() => {
    getPrefs().then(applyAndSet).catch(() => {});
  }, [applyAndSet]);

  const updatePrefs = useCallback(async (partial: Partial<AppPrefs>) => {
    const next = await setPrefs(partial);
    applyAndSet(next);
  }, [applyAndSet]);

  const formatAmount = useCallback((amount: number): string => {
    const meta = CURRENCY_META[prefs.currency as CurrencyCode];
    const symbol = meta?.symbol ?? '₹';
    const locale = meta?.locale ?? 'en-IN';
    return `${symbol} ${(amount || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [prefs.currency]);

  const weekStartIndex: 0 | 1 = prefs.weekStart === 'Mon' ? 1 : 0;

  return (
    <PreferencesContext.Provider value={{ prefs, updatePrefs, formatAmount, weekStartIndex }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
