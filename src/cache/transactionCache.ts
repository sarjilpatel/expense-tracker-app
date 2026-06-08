import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@txcache_v1';

function txKey(month?: number, year?: number) {
  if (!month && !year) return `${PREFIX}_all`;
  if (!month && year)  return `${PREFIX}_y${year}`;
  return `${PREFIX}_m${month}_y${year}`;
}

const BUDGET_KEY = '@budgetcache_v1';

// ── Transactions ─────────────────────────────────────────────────────────────

export async function getCachedTransactions(month?: number, year?: number): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(txKey(month, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedTransactions(data: any[], month?: number, year?: number): Promise<void> {
  try {
    const safe = Array.isArray(data) ? data : [];
    await AsyncStorage.setItem(txKey(month, year), JSON.stringify(safe));
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

const GROUP_KEY = '@groupcache_v1';

export async function getCachedGroup(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(GROUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedGroup(data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(GROUP_KEY, JSON.stringify(data));
  } catch {}
}

export async function invalidateCachedGroup(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GROUP_KEY);
  } catch {}
}

// ── Profile ───────────────────────────────────────────────────────────────────

const PROFILE_KEY = '@profilecache_v1';

export async function getCachedProfile(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedProfile(data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  } catch {}
}

export async function invalidateCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {}
}

// ── Analytics ────────────────────────────────────────────────────────────────

const ANALYTICS_PREFIX = '@analyticscache_v1';
const TREND_KEY        = '@trendcache_v1';

function analyticsKey(month: number, year: number) {
  return `${ANALYTICS_PREFIX}_m${month}_y${year}`;
}

export async function getCachedAnalytics(month: number, year: number): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(analyticsKey(month, year));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedAnalytics(data: any, month: number, year: number): Promise<void> {
  try {
    await AsyncStorage.setItem(analyticsKey(month, year), JSON.stringify(data));
  } catch {}
}

export async function getCachedTrend(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(TREND_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedTrend(data: any[]): Promise<void> {
  try {
    const safe = Array.isArray(data) ? data : [];
    await AsyncStorage.setItem(TREND_KEY, JSON.stringify(safe));
  } catch {}
}

// ── AI Insights (6-hour TTL) ──────────────────────────────────────────────────

const INSIGHT_PREFIX = '@insightcache_v1';
const INSIGHT_TTL_MS = 6 * 60 * 60 * 1000;

function insightKey(month: number, year: number) {
  return `${INSIGHT_PREFIX}_m${month}_y${year}`;
}

export async function getCachedInsights(month: number, year: number): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(insightKey(month, year));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > INSIGHT_TTL_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function setCachedInsights(data: any[], month: number, year: number): Promise<void> {
  try {
    await AsyncStorage.setItem(insightKey(month, year), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function getCachedBudgets(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(BUDGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedBudgets(data: any[]): Promise<void> {
  try {
    const safe = Array.isArray(data) ? data : [];
    await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(safe));
  } catch {}
}
