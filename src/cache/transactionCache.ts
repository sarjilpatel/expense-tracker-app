import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What is left of the read-through cache from before local-first (W3). Data lives in the local
 * store now and the screens read it directly, so the transaction, budget, analytics and trend
 * entries are gone. Three things are still fetched from the server and worth remembering between
 * launches: the AI insights (an LLM call — 6 h), the profile, and the group's membership
 * details (24 h, both invalidated by the calls that change them).
 */
const GROUP_KEY        = '@groupcache_v1';
const PROFILE_KEY      = '@profilecache_v1';
const INSIGHT_PREFIX   = '@insightcache_v1';

// Keys the retired caches used; swept on logout so an old install leaves nothing behind.
const LEGACY_PREFIXES  = ['@txcache_v1', '@budgetcache', '@analyticscache_v1', '@trendcache_v1'];

const CACHE_TTL_MS    = 24 * 60 * 60 * 1000;
const INSIGHT_TTL_MS  =  6 * 60 * 60 * 1000;

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

// ── Group ─────────────────────────────────────────────────────────────────────

export async function getCachedGroup(): Promise<any | null> {
  try {
    return unwrap<any>(await AsyncStorage.getItem(GROUP_KEY), CACHE_TTL_MS);
  } catch {
    return null;
  }
}

export async function setCachedGroup(data: any): Promise<void> {
  try { await AsyncStorage.setItem(GROUP_KEY, wrap(data)); } catch {}
}

export async function invalidateCachedGroup(): Promise<void> {
  try { await AsyncStorage.removeItem(GROUP_KEY); } catch {}
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getCachedProfile(): Promise<any | null> {
  try {
    return unwrap<any>(await AsyncStorage.getItem(PROFILE_KEY), CACHE_TTL_MS);
  } catch {
    return null;
  }
}

export async function setCachedProfile(data: any): Promise<void> {
  try { await AsyncStorage.setItem(PROFILE_KEY, wrap(data)); } catch {}
}

export async function invalidateCachedProfile(): Promise<void> {
  try { await AsyncStorage.removeItem(PROFILE_KEY); } catch {}
}

// ── AI Insights (6-hour TTL) ──────────────────────────────────────────────────

function insightKey(month: number, year: number) {
  return `${INSIGHT_PREFIX}_m${month}_y${year}`;
}

export async function getCachedInsights(month: number, year: number): Promise<any[] | null> {
  try {
    const result = unwrap<any[]>(await AsyncStorage.getItem(insightKey(month, year)), INSIGHT_TTL_MS);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

export async function setCachedInsights(data: any[], month: number, year: number): Promise<void> {
  try { await AsyncStorage.setItem(insightKey(month, year), wrap(data)); } catch {}
}

// ── Full logout wipe ──────────────────────────────────────────────────────────

/** Wipes every user-specific cache key from the device, the retired ones included. Call on logout. */
export async function clearAllUserCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k =>
      k.startsWith(INSIGHT_PREFIX) || k === GROUP_KEY || k === PROFILE_KEY ||
      LEGACY_PREFIXES.some(p => k.startsWith(p)));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
