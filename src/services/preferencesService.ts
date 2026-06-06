import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@app_prefs_v1';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY' | 'CAD' | 'AUD';
export type WeekStart   = 'Sun' | 'Mon';

export interface AppPrefs {
  currency:     CurrencyCode;
  monthlyStart: number;   // 1–28: day of month the "month" resets
  weekStart:    WeekStart;
  notifications: boolean;
}

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  INR: { symbol: '₹',    name: 'Indian Rupee',      locale: 'en-IN' },
  USD: { symbol: '$',    name: 'US Dollar',          locale: 'en-US' },
  EUR: { symbol: '€',    name: 'Euro',               locale: 'de-DE' },
  GBP: { symbol: '£',    name: 'British Pound',      locale: 'en-GB' },
  AED: { symbol: 'د.إ',  name: 'UAE Dirham',         locale: 'ar-AE' },
  JPY: { symbol: '¥',    name: 'Japanese Yen',       locale: 'ja-JP' },
  CAD: { symbol: 'C$',   name: 'Canadian Dollar',    locale: 'en-CA' },
  AUD: { symbol: 'A$',   name: 'Australian Dollar',  locale: 'en-AU' },
};

const DEFAULTS: AppPrefs = {
  currency:     'INR',
  monthlyStart: 1,
  weekStart:    'Sun',
  notifications: false,
};

export async function getPrefs(): Promise<AppPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function setPrefs(partial: Partial<AppPrefs>): Promise<AppPrefs> {
  const current = await getPrefs();
  const next = { ...current, ...partial };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function ordinalSuffix(n: number): string {
  if (n === 1 || n === 21) return `${n}st`;
  if (n === 2 || n === 22) return `${n}nd`;
  if (n === 3 || n === 23) return `${n}rd`;
  return `${n}th`;
}
