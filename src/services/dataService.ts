/**
 * The data layer every screen goes through — and since W3-18 the device is the source of truth
 * for all of it. Every read here is a local read, signed in or not; every write lands locally,
 * appends to the sync outbox, and returns. The server only ever hears about it from the sync
 * engine (`src/sync/engine.ts`), on the user's schedule.
 *
 * This file used to be a `_isGuest ? local : remote` switch. The guest half *was* the local-first
 * app; the signed-in half fetched on every focus and hit the rate limit. Now there is one half.
 * The `*Api.ts` modules are still imported by the engine, by auth and group membership, and by
 * the two things that genuinely need a server: AI insights and the profile photo.
 *
 * Every mutator does three things in order: local write → outbox → `bumpDataVersion` (so the
 * screens refetch on focus) and `noteLocalWrite` (so an instant schedule pushes shortly). A new
 * data feature adds its local service, its `Collection` in the outbox, and its row shape to
 * `engine.applyRow`. Nothing else.
 */

import * as localTx    from './local/localTransactionService';
import * as localCat   from './local/localCategoryService';
import * as localBudg  from './local/localBudgetService';
import * as localAcct  from './local/localAccountService';
import * as localGoal  from './local/localGoalService';
import * as localTrip  from './local/localTripService';
import { getInsights as remoteGetInsights } from './transactionApi';
import type { Account }    from './accountService';
import type { Goal }       from './goalApi';
import type { ExpenseInput } from './tripApi';
import type { Trip }       from './tripService';
import { bumpDataVersion } from './dataVersion';
import * as outbox from '@/src/sync/outbox';
import { getSyncMeta } from '@/src/sync/meta';
import { noteLocalWrite } from '@/src/sync/scheduler';

export type { Category } from './groupApi';
export type { Account, AccountType } from './accountService';
export type { Goal } from './goalApi';
export type { Trip, TripMember, TripExpense, TripSettlement } from './tripService';

let _isGuest = true;

export function setMode(guest: boolean): void {
  _isGuest = guest;
}

export function isGuestMode(): boolean {
  return _isGuest;
}

// ── The write path ────────────────────────────────────────────────────────────

type Collection = outbox.Collection;

/** Queue a write for the server and tell the screens something changed. */
async function queue(collection: Collection, op: outbox.OutboxOp, clientId: string, payload: Record<string, unknown> = {}): Promise<void> {
  const { activeGroupId } = await getSyncMeta();
  await outbox.enqueue({ collection, op, clientId, payload, groupId: activeGroupId });
  bumpDataVersion();
  noteLocalWrite();
}

/** The fields of a transaction the server takes, in the shape it takes them. */
function txPayload(tx: Partial<localTx.LocalTransaction>, accountId?: string | null): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const k of ['amount', 'type', 'category', 'note', 'date', 'currency', 'isRecurring', 'recurrenceFrequency', 'isPrivate', 'goalId', 'createdAt'] as const) {
    if (tx[k] !== undefined) p[k] = tx[k];
  }
  if (accountId !== undefined) p.accountId = accountId;
  return p;
}

const tripPayload = (t: Trip): Record<string, unknown> => ({
  name: t.name, currency: t.currency, members: t.members, expenses: t.expenses, settlements: t.settlements, createdAt: t.createdAt,
});

// ── Transactions ──────────────────────────────────────────────────────────────

export const getTransactions = (month?: number, year?: number, search?: string) =>
  localTx.getLocalTransactions(month, year, search);

/** Recently used categories per type, for the add form's chips. */
export const getRecentCategories = (limit?: number) => localTx.getLocalRecentCategories(limit);

/** Every matching transaction. The local store has no pages, so this is the same read. */
export const getAllTransactions = (month?: number, year?: number, search?: string) =>
  localTx.getLocalTransactions(month, year, search);

/** Search across ALL time periods — no month/year filter. */
export const searchAllTransactions = (query: string) =>
  localTx.getLocalTransactions(undefined, undefined, query);

/** Contributions are ordinary transactions, so this history stays correct after edits or deletes. */
export const getGoalContributions = async (goalId: string) =>
  (await localTx.getLocalTransactions()).filter(tx => tx.goalId === goalId);

export const addTransaction = async (data: any) => {
  const { accountId, ...fields } = data;
  const tx = await localTx.addLocalTransaction({ ...fields, updatedAt: new Date().toISOString() });
  if (accountId) await localAcct.setLocalTxAccount(tx._id, accountId);
  await queue('transactions', 'create', tx._id, txPayload(tx, accountId ?? null));
  return tx;
};

export const updateTransaction = async (id: string, data: any) => {
  const { accountId, ...fields } = data;
  const tx = await localTx.updateLocalTransaction(id, { ...fields, updatedAt: new Date().toISOString() });
  await queue('transactions', 'update', id, txPayload(fields, accountId));
  return tx;
};

export const deleteTransaction = async (id: string) => {
  const result = await localTx.deleteLocalTransaction(id);
  await localAcct.removeLocalTxAccount(id);
  await queue('transactions', 'delete', id);
  return result;
};

/** Remove the transaction history from this device and queue matching server deletes when needed. */
export const clearTransactions = async () => {
  const transactions = await localTx.getAllLocalTransactions();
  await localTx.clearAllLocalTransactions();
  await localAcct.removeLocalTxAccounts(transactions.map(tx => tx._id));
  await outbox.enqueueMany(transactions.map(tx => ({
    collection: 'transactions' as const,
    op: 'delete' as const,
    clientId: tx._id,
    payload: {},
    groupId: tx.groupId ? String(tx.groupId) : null,
  })));
  bumpDataVersion();
  noteLocalWrite();
};

/**
 * Undo of a delete. The row is gone from the device — the delete queued above is a tombstone on
 * the server once pushed — so a restore re-creates it from what the caller still holds.
 */
export const restoreTransaction = async (id: string, row?: any) => {
  if (!row) return;
  const { _id, accountId, ...fields } = row;
  await localTx.upsertLocalTransaction({ ...fields, _id: id, updatedAt: new Date().toISOString() });
  if (accountId) await localAcct.setLocalTxAccount(id, accountId);
  await queue('transactions', 'update', id, txPayload(fields, accountId ?? null));
};

export const getAnalytics = (month?: number, year?: number) => localTx.computeLocalAnalytics(month, year);
export const getTrend     = (months = 6) => localTx.computeLocalTrend(months);

/** The one read that needs a server: insights come from an LLM. A guest has none. */
export const getInsights = (month: number, year: number) =>
  _isGuest
    ? Promise.resolve({ insights: [], month, year, noData: true })
    : remoteGetInsights(month, year);

// ── Categories ────────────────────────────────────────────────────────────────
// `getCurrentGroup` keeps its name and its `{ categories }` shape because six screens read it
// for exactly that. Group *membership* (name, members, join code) is not data — screens that
// need it call `groupApi.getCurrentGroup` directly, as they do for every membership operation.

export const getCurrentGroup = () => localCat.getLocalCategories();

export const addCategory = async (name: string, icon: string, type: 'income' | 'expense' | 'both' = 'expense', emoji?: string) => {
  const before = new Set((await localCat.getAllLocalCategories()).map(c => c._id));
  const cats = await localCat.addLocalCategory(name, icon, type, emoji);
  const added = cats.find(c => !before.has(c._id));
  if (added) {
    const { activeGroupId } = await getSyncMeta();
    if (activeGroupId) await localCat.upsertLocalCategory({ ...added, groupId: activeGroupId });
    await queue('categories', 'create', added._id, { name: added.name, icon: added.icon, emoji: added.emoji ?? '', type: added.type ?? 'expense' });
  }
  return (await localCat.getLocalCategories()).categories;
};

export const removeCategory = async (id: string) => {
  const cats = await localCat.removeLocalCategory(id);
  await queue('categories', 'delete', id);
  return cats;
};

export const getCategoryPresets = () => localCat.getLocalPresets();

export const applyCategoryPreset = async (key: string) => {
  const before = new Set((await localCat.getAllLocalCategories()).map(c => c._id));
  const result = await localCat.applyLocalPreset(key);
  const { activeGroupId } = await getSyncMeta();
  for (const c of result.categories) {
    if (before.has(c._id)) continue;
    if (activeGroupId) await localCat.upsertLocalCategory({ ...c, groupId: activeGroupId });
    await queue('categories', 'create', c._id, { name: c.name, icon: c.icon, emoji: c.emoji ?? '', type: c.type ?? 'expense' });
  }
  return { ...result, categories: (await localCat.getLocalCategories()).categories };
};

// ── Carry-forward ─────────────────────────────────────────────────────────────

/**
 * Computes the budget surplus from the previous month.
 * Returns 0 if no budget was set or if expenses exceeded budget.
 */
export async function getPrevMonthCarryForward(month: number, year: number): Promise<number> {
  try {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;

    const [prevBudgets, prevTxs] = await Promise.all([
      getBudgets(prevMonth, prevYear),
      getTransactions(prevMonth, prevYear),
    ]);

    const budgets = prevBudgets as any[];
    const txs     = prevTxs as any[];

    const mainBudget = budgets.find((b: any) => !b.category);
    if (!mainBudget) return 0;

    const expense = txs
      .filter((tx: any) => tx.type === 'expense')
      .reduce((s: number, tx: any) => s + tx.amount, 0);

    return Math.max(0, mainBudget.amount - expense);
  } catch {
    return 0;
  }
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export const getBudgets = (month?: number, year?: number) => localBudg.getLocalBudgets(month, year);

/**
 * Budgets are configured once, then apply to later monthly cycles until the user changes them.
 * A budget explicitly set for the requested cycle always wins over an older configuration.
 */
export async function getEffectiveBudgets(month: number, year: number) {
  const all = await localBudg.getAllLocalBudgets();
  const requestedPeriod = year * 12 + month;
  const latestByCategory = new Map<string, localBudg.LocalBudget>();

  [...all]
    .filter(b => b.year * 12 + b.month <= requestedPeriod)
    .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
    .forEach(b => {
      const key = b.category ?? '__monthly_total__';
      if (!latestByCategory.has(key)) latestByCategory.set(key, b);
    });

  return [...latestByCategory.values()];
}

export const setBudget = async (data: { amount: number; month?: number; year?: number; category?: string | null }) => {
  const before = new Set((await localBudg.getAllLocalBudgets()).map(b => b._id));
  const budget = await localBudg.setLocalBudget(data);
  await localBudg.upsertLocalBudget({ ...budget, updatedAt: new Date().toISOString() });
  await queue('budgets', before.has(budget._id) ? 'update' : 'create', budget._id,
    { amount: budget.amount, month: budget.month, year: budget.year, category: budget.category ?? null, createdAt: budget.createdAt });
  return budget;
};

export const deleteBudget = async (id: string) => {
  await localBudg.deleteLocalBudget(id);
  await queue('budgets', 'delete', id);
};

// ── Accounts ──────────────────────────────────────────────────────────────────

export const getAccounts = () => localAcct.getLocalAccounts();

export const saveAccount = async (data: Omit<Account, 'id' | 'createdAt'> & { id?: string }) => {
  const existed = !!data.id && (await localAcct.getLocalAccounts()).some(a => a.id === data.id);
  const account = await localAcct.saveLocalAccount(data);
  await queue('accounts', existed ? 'update' : 'create', account.id,
    { name: account.name, type: account.type, openingBalance: account.openingBalance, color: account.color, icon: account.icon, createdAt: account.createdAt });
  return account;
};

export const deleteAccount = async (id: string) => {
  await localAcct.deleteLocalAccount(id);
  await queue('accounts', 'delete', id);
};

export const getTxAccountMap = () => localAcct.getLocalTxAccountMap();

// The link lives on the transaction server-side, so changing it is an update of that row.
export const setTxAccount = async (txId: string, accountId: string) => {
  await localAcct.setLocalTxAccount(txId, accountId);
  await queue('transactions', 'update', txId, { accountId });
};

export const removeTxAccount = async (txId: string) => {
  await localAcct.removeLocalTxAccount(txId);
  await queue('transactions', 'update', txId, { accountId: null });
};

// ── Goals ─────────────────────────────────────────────────────────────────────
// Goals used to be the one collection with no local branch. A guest can keep them on the device
// now like everything else (W3-13); `GuestUnsupportedError` stays exported for the screens that
// still import it and is no longer thrown.

export class GuestUnsupportedError extends Error {
  constructor(feature: string) {
    super(`${feature} require an account.`);
    this.name = 'GuestUnsupportedError';
  }
}

export const getGoals = () => localGoal.getLocalGoals() as Promise<Goal[]>;

export const createGoal = async (data: { name: string; targetAmount: number; savedAmount?: number; deadline?: string | null; icon?: string; color?: string }) => {
  const goal = await localGoal.createLocalGoal(data);
  await queue('goals', 'create', goal._id,
    { name: goal.name, targetAmount: goal.targetAmount, savedAmount: goal.savedAmount, deadline: goal.deadline, icon: goal.icon, color: goal.color, createdAt: goal.createdAt });
  return goal as Goal;
};

export const updateGoal = async (id: string, data: Parameters<typeof localGoal.updateLocalGoal>[1]) => {
  const goal = await localGoal.updateLocalGoal(id, data);
  await queue('goals', 'update', id,
    { name: goal.name, targetAmount: goal.targetAmount, savedAmount: goal.savedAmount, deadline: goal.deadline, icon: goal.icon, color: goal.color });
  return goal as Goal;
};

export const deleteGoal = async (id: string) => {
  await localGoal.deleteLocalGoal(id);
  await queue('goals', 'delete', id);
};

// ── Trips ─────────────────────────────────────────────────────────────────────
// A trip syncs as one row — members, expenses and settlements together — so every mutation
// below queues the whole trip as an update. Ten edits on a trip are one item on the wire.

export const getTrips = () => localTrip.getTrips();
export const getTrip  = (id: string) => localTrip.getTrip(id);

async function queueTrip(trip: Trip | null, op: outbox.OutboxOp = 'update'): Promise<Trip | null> {
  if (trip) await queue('trips', op, trip.id, tripPayload(trip));
  return trip;
}

export const createTrip = async (data: Parameters<typeof localTrip.createTrip>[0]) =>
  (await queueTrip(await localTrip.createTrip(data), 'create')) as Trip;

export const renameTrip = (id: string, name: string) =>
  localTrip.renameTrip(id, name).then(t => queueTrip(t));

export const deleteTrip = async (id: string) => {
  await localTrip.deleteTrip(id);
  await queue('trips', 'delete', id);
};

export const addTripMember = (tripId: string, name: string, userId?: string | null) =>
  localTrip.addMember(tripId, name).then(async t => {
    // A member linked to an account is a server-side concept; the local service only knows names,
    // and a guest has nobody to link to — a stray id would claim the wrong account on push.
    if (t && userId && !_isGuest) {
      const m = t.members[t.members.length - 1];
      if (m) { m.userId = userId; await localTrip.upsertLocalTrip(t); }
    }
    return queueTrip(t);
  });

export const renameTripMember = (tripId: string, memberId: string, name: string) =>
  localTrip.renameMember(tripId, memberId, name).then(t => queueTrip(t));

export const removeTripMember = (tripId: string, memberId: string) =>
  localTrip.removeMember(tripId, memberId).then(t => queueTrip(t));

export const addTripExpense = (tripId: string, data: ExpenseInput) =>
  localTrip.addExpense(tripId, data).then(t => queueTrip(t));

export const updateTripExpense = (tripId: string, expenseId: string, data: ExpenseInput) =>
  localTrip.updateExpense(tripId, expenseId, data).then(t => queueTrip(t));

export const deleteTripExpense = (tripId: string, expenseId: string) =>
  localTrip.deleteExpense(tripId, expenseId).then(t => queueTrip(t));

export const recordTripSettlement = (tripId: string, data: { fromId: string; toId: string; amountMinor: number }) =>
  localTrip.recordSettlement(tripId, data).then(t => queueTrip(t));

export const deleteTripSettlement = (tripId: string, settlementId: string) =>
  localTrip.deleteSettlement(tripId, settlementId).then(t => queueTrip(t));
