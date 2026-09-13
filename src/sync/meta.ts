import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The sync engine's own state (W3-17): the pull cursor, when the last run finished, the active
 * group (what the local reads filter on when signed in), and the user's backup settings. One
 * JSON blob under one key — it is small and always read whole.
 */
const KEY = '@sync_meta_v1';

export type BackupSchedule = 'instant' | 'hourly' | 'every4h' | 'every8h' | 'daily' | 'manual';

export interface SyncMeta {
  /** `syncedAt` of the last row applied from the changes feed; null means "never pulled". */
  cursor: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  /** The signed-in user's active group; null for a guest. Local reads filter on it. */
  activeGroupId: string | null;
  schedule: BackupSchedule;
  wifiOnly: boolean;
}

export const DEFAULT_META: SyncMeta = {
  cursor: null, lastSyncAt: null, lastError: null, activeGroupId: null, schedule: 'instant', wifiOnly: false,
};

let cache: SyncMeta | null = null;

export async function getSyncMeta(): Promise<SyncMeta> {
  if (cache) return cache;
  let loaded: SyncMeta;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    loaded = raw ? { ...DEFAULT_META, ...JSON.parse(raw) } : { ...DEFAULT_META };
  } catch {
    loaded = { ...DEFAULT_META };
  }
  cache = loaded;
  return loaded;
}

export async function updateSyncMeta(patch: Partial<SyncMeta>): Promise<SyncMeta> {
  const next = { ...(await getSyncMeta()), ...patch };
  cache = next;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** Forget the cursor and last-run stamps but keep the user's settings — a group change or logout. */
export async function resetSyncCursor(): Promise<void> {
  await updateSyncMeta({ cursor: null, lastSyncAt: null, lastError: null });
}

/** Test support. */
export function __resetSyncMetaCache(): void { cache = null; }
