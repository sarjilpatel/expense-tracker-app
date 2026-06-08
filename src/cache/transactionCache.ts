import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX           = '@txcache_v1';
const BUDGET_KEY       = '@budgetcache_v1';
const GROUP_KEY        = '@groupcache_v1';
const PROFILE_KEY      = '@profilecache_v1';
const ANALYTICS_PREFIX = '@analyticscache_v1';
const TREND_KEY        = '@trendcache_v1';
const INSIGHT_PREFIX   = '@insightcache_v1';

const CACHE_TTL_MS    = 24 * 60 * 60 * 1000; // 24 hours for all caches
const INSIGHT_TTL_MS  =  6 * 60 * 60 * 1000; // 6 hours for AI insights

function wrap(data: any): string {
  return JSON.stringify({ data, ts: Date.now() });
}

function unwrap<T>(raw: string | null, ttl: number): T | null {
  if (!raw) return null;
  try {
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data as T;
  } catch {
    return null;
  }
}

function txKey(month?: number, year?: number) {
  if (!month && !year) return `${PREFIX}_all`;
  if (!month && year)  return `${PREFIX}_y${year}`;
  return `${PREFIX}_m${month}_y${year}`;
}

// ── Transactions ─────────────────────────────────────────────────────────────

export async function getCachedTransactions(month?: number, year?: number): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(txKey(month, year));
    const result = unwrap<any[]>(raw, CACHE_TTL_MS);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

export async function setCachedTransactions(data: any[], month?: number, year?: number): Promise<void> {
  try {
    await AsyncStorage.setItem(txKey(month, year), wrap(Array.isArray(data) ? data : []));
  } catch {}
}

export async function invalidateCachedTransactions(month?: number, year?: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(txKey(month, year));
  } catch {}
}

export async function invalidateAllTransactionCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(PREFIX) || k.startsWith('@budgetcache'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}

// ── Group ─────────────────────────────────────────────────────────────────────

export async function getCachedGroup(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(GROUP_KEY);
    return unwrap<any>(raw, CACHE_TTL_MS);
  } catch {
    return null;
  }
}

export async function setCachedGroup(data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(GROUP_KEY, wrap(data));
  } catch {}
}

export async function invalidateCachedGroup(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GROUP_KEY);
  } catch {}
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getCachedProfile(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return unwrap<any>(raw, CACHE_TTL_MS);
  } catch {
    return null;
  }
}

export async function setCachedProfile(data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, wrap(data));
  } catch {}
}

export async function invalidateCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {}
}

// ── Analytics ────────────────────────────────────────────────────────────────

function analyticsKey(month: number, year: number) {
  return `${ANALYTICS_PREFIX}_m${month}_y${year}`;
}

export async function getCachedAnalytics(month: number, year: number): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(analyticsKey(month, year));
    return unwrap<any>(raw, CACHE_TTL_MS);
  } catch {
    return null;
  }
}

export async function setCachedAnalytics(data: any, month: number, year: number): Promise<void> {
  try {
    await AsyncStorage.setItem(analyticsKey(month, year), wrap(data));
  } catch {}
}

export async function getCachedTrend(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(TREND_KEY);
    const result = unwrap<any[]>(raw, CACHE_TTL_MS);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

export async function setCachedTrend(data: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TREND_KEY, wrap(Array.isArray(data) ? data : []));
  } catch {}
}

// ── AI Insights (6-hour TTL) ──────────────────────────────────────────────────

function insightKey(month: number, year: number) {
  return `${INSIGHT_PREFIX}_m${month}_y${year}`;
}

export async function getCachedInsights(month: number, year: number): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(insightKey(month, year));
    const result = unwrap<any[]>(raw, INSIGHT_TTL_MS);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

export async function setCachedInsights(data: any[], month: number, year: number): Promise<void> {
  try {
    await AsyncStorage.setItem(insightKey(month, year), wrap(data));
  } catch {}
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function getCachedBudgets(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(BUDGET_KEY);
    const result = unwrap<any[]>(raw, CACHE_TTL_MS);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

export async function setCachedBudgets(data: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BUDGET_KEY, wrap(Array.isArray(data) ? data : []));
  } catch {}
}

// ── Full logout wipe ──────────────────────────────────────────────────────────

/** Wipes every user-specific cache key from the device. Call on logout. */
export async function clearAllUserCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k =>
      k.startsWith(PREFIX) ||
      k.startsWith('@budgetcache') ||
      k.startsWith(ANALYTICS_PREFIX) ||
      k.startsWith(INSIGHT_PREFIX) ||
      k === GROUP_KEY ||
      k === PROFILE_KEY ||
      k === TREND_KEY ||
      k === '@daily_reminder_id' ||
      k === '@daily_reminder_time' ||
      // Guest-mode local data — clear on logout so residual data never persists
      k === '@local_transactions_v1' ||
      k === '@local_categories_v1' ||
      k === '@local_budgets_v1'
    );
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
