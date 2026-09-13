import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Goal } from '../goalApi';
import { getSyncMeta } from '@/src/sync/meta';

/**
 * Goals on the device (W3-13). Goals were the one collection with no local branch — a guest could
 * not have them and a signed-in user fetched them every time. They are ordinary rows now, filed
 * under the active group when signed in like everything else, and synced through the outbox.
 */
const KEY = '@local_goals_v1';

export type LocalGoal = Omit<Goal, 'groupId' | 'userId'> & { groupId?: string | null; userId?: string | null; updatedAt?: string };

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function load(): Promise<LocalGoal[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function persist(rows: LocalGoal[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(rows));
}

async function inScope(rows: LocalGoal[]): Promise<LocalGoal[]> {
  const { activeGroupId } = await getSyncMeta();
  if (!activeGroupId) return rows;
  return rows.filter(g => !g.groupId || String(g.groupId) === activeGroupId);
}

export async function getLocalGoals(): Promise<LocalGoal[]> {
  const rows = await inScope(await load());
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createLocalGoal(data: {
  name: string; targetAmount: number; savedAmount?: number; deadline?: string | null; icon?: string; color?: string;
}): Promise<LocalGoal> {
  const all = await load();
  const { activeGroupId } = await getSyncMeta();
  const goal: LocalGoal = {
    _id: genId(),
    name: data.name,
    targetAmount: data.targetAmount,
    savedAmount: data.savedAmount ?? 0,
    deadline: data.deadline ?? null,
    icon: data.icon ?? 'flag-outline',
    color: data.color ?? '#6366F1',
    groupId: activeGroupId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all.push(goal);
  await persist(all);
  return goal;
}

export async function updateLocalGoal(
  id: string,
  data: Partial<{ name: string; targetAmount: number; savedAmount: number; deadline: string | null; icon: string; color: string; addAmount: number }>,
): Promise<LocalGoal> {
  const all = await load();
  const idx = all.findIndex(g => g._id === id);
  if (idx === -1) throw new Error('Goal not found');
  const { addAmount, ...rest } = data;
  const next = { ...all[idx], ...rest, updatedAt: new Date().toISOString() };
  if (addAmount) next.savedAmount = Math.max(0, (next.savedAmount || 0) + addAmount);
  all[idx] = next;
  await persist(all);
  return next;
}

export async function deleteLocalGoal(id: string): Promise<void> {
  const all = await load();
  await persist(all.filter(g => g._id !== id));
}

export async function getAllLocalGoals(): Promise<LocalGoal[]> {
  return load();
}

export async function clearLocalGoals(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────

export async function upsertLocalGoal(row: LocalGoal): Promise<void> {
  const all = await load();
  const idx = all.findIndex(g => g._id === row._id);
  if (idx === -1) all.push(row); else all[idx] = { ...all[idx], ...row };
  await persist(all);
}

export async function removeLocalGoal(id: string): Promise<void> {
  const all = await load();
  const next = all.filter(g => g._id !== id);
  if (next.length !== all.length) await persist(next);
}
