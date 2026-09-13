import apiClient, { LONG_TIMEOUT_MS } from '@/src/services/apiClient';
import * as outbox from './outbox';
import { getSyncMeta, updateSyncMeta } from './meta';
import { isSignedIn } from './session';
import { bumpDataVersion } from '@/src/services/dataVersion';
import { reportError } from '@/src/utils/log';
import { normaliseTrip } from '@/src/services/tripService';
import { upsertLocalTransaction, removeLocalTransaction } from '@/src/services/local/localTransactionService';
import { upsertLocalBudget, removeLocalBudget } from '@/src/services/local/localBudgetService';
import { upsertLocalAccount, removeLocalAccount, setLocalTxAccount, removeLocalTxAccount } from '@/src/services/local/localAccountService';
import { upsertLocalGoal, removeLocalGoal } from '@/src/services/local/localGoalService';
import { upsertLocalTrip, removeLocalTrip } from '@/src/services/local/localTripService';
import { upsertLocalCategory, dropLocalCategory } from '@/src/services/local/localCategoryService';

/**
 * The sync engine (W3-15/16). One run = push the outbox, then pull the changes feed.
 *
 *   push  drain the outbox in batches through POST /sync/push; `applied` clears the entry (and the
 *         server's copy of the row is written back — it now carries its group and its owner);
 *         `superseded` clears it too and the server's row overwrites ours; `rejected` keeps it for
 *         another try, up to five, then drops it. A network failure stops the drain with the rest
 *         still queued, in order.
 *   pull  GET /sync/changes from the stored cursor until `hasMore` is false, applying every row
 *         except those with a pending outbox entry — local wins until pushed. The cursor is stored
 *         only after a whole page is applied, so a crash mid-page re-pulls and never skips.
 *
 * Only one run at a time; a second call while one is in flight waits on it. The engine never
 * decides *when* to run — that is `scheduler.ts`.
 */

export type SyncReason = 'manual' | 'schedule' | 'foreground' | 'login' | 'write' | 'signal' | 'restore';

export interface SyncStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  pending: number;
}

export interface SyncOutcome {
  pushed: number;
  pulled: number;
  rejected: number;
  error: string | null;
}

export interface Change {
  collection: outbox.Collection;
  clientId: string;
  serverId: string;
  updatedAt: string;
  deleted: boolean;
  row: any;
}

const PUSH_BATCH = 200;
const PULL_PAGE  = 500;

const listeners = new Set<(s: SyncStatus) => void>();
const changeListeners = new Set<(changes: Change[]) => void>();
let running: Promise<SyncOutcome> | null = null;
let status: SyncStatus = { running: false, lastSyncAt: null, lastError: null, pending: 0 };

async function publish(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
}

export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => { listeners.delete(fn); };
}

/** Rows a pull just applied — for a screen that is open while another device's edits land. */
export function subscribeChanges(fn: (changes: Change[]) => void): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const meta = await getSyncMeta();
  status = { ...status, lastSyncAt: meta.lastSyncAt, lastError: meta.lastError, pending: await outbox.count() };
  return status;
}

// ── Applying server rows to the local store ──────────────────────────────────

/** Write a server row into the local store under its clientId. Exported for tests. */
export async function applyRow(collection: outbox.Collection, clientId: string, row: any, serverId?: string): Promise<void> {
  switch (collection) {
    case 'transactions': {
      const { _id, noteTokens, ...rest } = row;
      await upsertLocalTransaction({ ...rest, _id: clientId, serverId: serverId ?? String(_id ?? '') });
      if (row.accountId) await setLocalTxAccount(clientId, String(row.accountId));
      else await removeLocalTxAccount(clientId);
      return;
    }
    case 'budgets': {
      const { _id, ...rest } = row;
      return upsertLocalBudget({ ...rest, _id: clientId });
    }
    case 'accounts': {
      const { _id, id, ...rest } = row;
      return upsertLocalAccount({ ...rest, id: clientId });
    }
    case 'goals': {
      const { _id, ...rest } = row;
      return upsertLocalGoal({ ...rest, _id: clientId });
    }
    case 'trips':
      return upsertLocalTrip(normaliseTrip({ ...row, id: clientId, _id: undefined }));
    case 'categories': {
      const { _id, clientId: _c, syncedAt, updatedAt, deletedAt, ...rest } = row;
      return upsertLocalCategory({ ...rest, _id: clientId });
    }
  }
}

async function removeRow(collection: outbox.Collection, clientId: string): Promise<void> {
  switch (collection) {
    case 'transactions': await removeLocalTransaction(clientId); await removeLocalTxAccount(clientId); return;
    case 'budgets':      return removeLocalBudget(clientId);
    case 'accounts':     return removeLocalAccount(clientId);
    case 'goals':        return removeLocalGoal(clientId);
    case 'trips':        return removeLocalTrip(clientId);
    case 'categories':   return dropLocalCategory(clientId);
  }
}

export async function applyChange(change: Change): Promise<void> {
  if (change.deleted) return removeRow(change.collection, change.clientId);
  return applyRow(change.collection, change.clientId, change.row, change.serverId);
}

// ── Push ─────────────────────────────────────────────────────────────────────

const toWire = (e: outbox.OutboxEntry) => ({
  collection: e.collection,
  op: e.op === 'delete' ? 'delete' : 'upsert',
  clientId: e.clientId,
  updatedAt: e.updatedAt,
  payload: e.payload,
  groupId: e.groupId ?? undefined,
});

async function push(outcome: SyncOutcome): Promise<void> {
  // Rows the server refused this run are left for the next one — sending them again now would
  // only burn their attempts.
  const refused = new Set<string>();
  for (;;) {
    const entries = (await outbox.peek(PUSH_BATCH + refused.size)).filter((e) => !refused.has(e.id)).slice(0, PUSH_BATCH);
    if (entries.length === 0) return;

    const { data } = await apiClient.post('/sync/push', { items: entries.map(toWire) }, { timeout: LONG_TIMEOUT_MS });
    const results: any[] = data.results || [];
    const done: string[] = [];
    let progressed = false;

    for (const entry of entries) {
      const r = results.find((x) => x.clientId === entry.clientId && x.collection === entry.collection);
      if (!r) continue;
      if (r.status === 'applied' || r.status === 'superseded') {
        done.push(entry.id);
        progressed = true;
        outcome.pushed += 1;
        if (r.row) {
          // Categories deduped by name come back as the row that already existed under another
          // id — ours goes, theirs is what the device keeps.
          if (entry.collection === 'categories' && r.status === 'superseded' && r.row.clientId && r.row.clientId !== entry.clientId) {
            await dropLocalCategory(entry.clientId);
            await applyRow('categories', r.row.clientId, r.row, r.serverId);
          } else if (entry.op !== 'delete') {
            await applyRow(entry.collection, entry.clientId, r.row, r.serverId);
          }
        }
      } else {
        outcome.rejected += 1;
        refused.add(entry.id);
        await outbox.markFailed(entry.id, r.error || 'rejected');
      }
    }
    await outbox.remove(done);
    if (!progressed) return;
  }
}

// ── Pull ─────────────────────────────────────────────────────────────────────

async function pull(outcome: SyncOutcome): Promise<void> {
  const pending = await outbox.pendingIds();
  let { cursor } = await getSyncMeta();

  for (let pages = 0; pages < 200; pages++) {
    const { data } = await apiClient.get('/sync/changes', {
      params: { since: cursor ?? undefined, limit: PULL_PAGE },
      timeout: LONG_TIMEOUT_MS,
    });
    const changes: Change[] = data.changes || [];
    const applied: Change[] = [];
    for (const change of changes) {
      if (pending.has(`${change.collection}:${change.clientId}`)) continue;
      await applyChange(change);
      applied.push(change);
      outcome.pulled += 1;
    }
    cursor = data.cursor ?? cursor ?? data.serverTime;
    const groups: { id: string; isPersonal: boolean }[] = data.groups || [];
    await updateSyncMeta({ cursor, sharedGroupIds: groups.filter((g) => !g.isPersonal).map((g) => g.id) });
    if (applied.length) changeListeners.forEach((fn) => fn(applied));
    if (!data.hasMore) return;
  }
}

// ── The run ──────────────────────────────────────────────────────────────────

export function runSync(reason: SyncReason = 'manual'): Promise<SyncOutcome> {
  if (running) return running;
  // A guest has nowhere to sync to; the outbox waits. Decided before the promise exists — an
  // early return inside it would run before `running` is even assigned.
  if (!isSignedIn()) return Promise.resolve({ pushed: 0, pulled: 0, rejected: 0, error: null });
  running = (async () => {
    const outcome: SyncOutcome = { pushed: 0, pulled: 0, rejected: 0, error: null };

    await publish({ running: true });
    try {
      await push(outcome);
      await pull(outcome);
      await updateSyncMeta({ lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (e: any) {
      outcome.error = e?.response?.data?.message || e?.message || 'Sync failed';
      await updateSyncMeta({ lastError: outcome.error });
      reportError('[sync]', reason, outcome.error);
    } finally {
      if (outcome.pushed || outcome.pulled) bumpDataVersion();
      const meta = await getSyncMeta();
      await publish({ running: false, lastSyncAt: meta.lastSyncAt, lastError: meta.lastError, pending: await outbox.count() });
      running = null;
    }
    return outcome;
  })();
  return running;
}

export function isSyncRunning(): boolean { return running !== null; }
