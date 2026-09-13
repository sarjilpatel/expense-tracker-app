import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The outbox (W3-14): every local write appends a row here, and the sync engine drains it.
 *
 * `op` is finer than the wire's `upsert`/`delete` so entries can be coalesced before they are
 * ever sent: an edit of a row still waiting to be created rewrites the create; a delete of a row
 * the server never saw drops both; a delete after an edit is just the delete. Ten edits in a row
 * are one item on the wire.
 */
export type Collection = 'transactions' | 'budgets' | 'accounts' | 'goals' | 'trips' | 'categories' | 'attachments';
export type OutboxOp = 'create' | 'update' | 'delete';

export interface OutboxEntry {
  id: string;
  collection: Collection;
  op: OutboxOp;
  clientId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  groupId: string | null;
  attempts: number;
  lastError?: string;
}

const KEY = '@sync_outbox_v1';
const listeners = new Set<(count: number) => void>();

async function load(): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function persist(entries: OutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  listeners.forEach((fn) => fn(entries.length));
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Coalesce a new write into the pending entries for the same row. Pure; exported for tests. */
export function coalesce(entries: OutboxEntry[], next: OutboxEntry): OutboxEntry[] {
  const i = entries.findIndex((e) => e.collection === next.collection && e.clientId === next.clientId);
  if (i === -1) return [...entries, next];
  const prev = entries[i];
  const rest = entries.filter((_, k) => k !== i);

  if (next.op === 'delete') {
    // The server never saw a row that was created and deleted between two syncs.
    if (prev.op === 'create') return rest;
    return [...rest, { ...next, id: prev.id }];
  }
  if (prev.op === 'delete') {
    // Deleted and then re-added under the same id: the server has (or will have) a tombstone,
    // so this must be an upsert that revives it — an update, never a create.
    return [...rest, { ...next, op: 'update', id: prev.id }];
  }
  // create/update followed by update: the later payload wins, the earlier op is kept.
  return [...rest, { ...next, op: prev.op, id: prev.id, payload: { ...prev.payload, ...next.payload } }];
}

export async function enqueue(entry: Omit<OutboxEntry, 'id' | 'attempts' | 'updatedAt'> & { updatedAt?: string }): Promise<void> {
  const entries = await load();
  const full: OutboxEntry = { id: genId(), attempts: 0, updatedAt: new Date().toISOString(), ...entry };
  await persist(coalesce(entries, full));
}

/** Many at once — one load and one persist, not one per row (seeding after a sign-in). */
export async function enqueueMany(list: Array<Omit<OutboxEntry, 'id' | 'attempts' | 'updatedAt'> & { updatedAt?: string }>): Promise<void> {
  let entries = await load();
  const now = new Date().toISOString();
  for (const entry of list) entries = coalesce(entries, { id: genId(), attempts: 0, updatedAt: now, ...entry });
  await persist(entries);
}

export async function peek(limit = 200): Promise<OutboxEntry[]> {
  return (await load()).slice(0, limit);
}

export async function count(): Promise<number> {
  return (await load()).length;
}

/** Ids of rows with a pending write — a pull must not overwrite these; local wins until pushed. */
export async function pendingIds(): Promise<Set<string>> {
  return new Set((await load()).map((e) => `${e.collection}:${e.clientId}`));
}

export async function remove(ids: string[]): Promise<void> {
  const gone = new Set(ids);
  await persist((await load()).filter((e) => !gone.has(e.id)));
}

/** Record a failed attempt; an entry that has failed `maxAttempts` times is dropped. */
export async function markFailed(id: string, error: string, maxAttempts = 5): Promise<void> {
  const entries = await load();
  const next = entries
    .map((e) => (e.id === id ? { ...e, attempts: e.attempts + 1, lastError: error } : e))
    .filter((e) => e.attempts < maxAttempts);
  await persist(next);
}

export async function clear(): Promise<void> {
  await persist([]);
}

export function subscribe(fn: (count: number) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
