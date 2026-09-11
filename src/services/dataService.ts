// Unified data service — routes to local (guest) or remote (logged-in) based on auth mode.
// AuthContext calls setMode() on startup and on login/logout.

import * as remoteTx   from './transactionApi';
import { getInsights as remoteGetInsights } from './transactionApi';
import * as localTx    from './local/localTransactionService';
import * as remoteGrp  from './groupApi';
import * as localCat   from './local/localCategoryService';
import * as remoteBudg from './budgetApi';
import * as localBudg  from './local/localBudgetService';
import * as remoteAcct from './accountApi';
import type { Account }    from './accountService';
import * as localAcct  from './local/localAccountService';
import * as remoteGoal from './goalApi';
import type { Goal }    from './goalApi';
import * as remoteTrip from './tripApi';
import * as localTrip  from './local/localTripService';

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

// ── Transactions ──────────────────────────────────────────────────────────────

export const getTransactions = (month?: number, year?: number, search?: string) =>
  _isGuest
    ? localTx.getLocalTransactions(month, year, search)
    : remoteTx.getTransactions(month, year, search);

/**
 * Every matching transaction, paging past the server's 50-row default.
 * Use for exports, backups and balance sums — anywhere a truncated list is a wrong answer.
 * Guest mode already returns everything, so the local branch is the same call.
 */
export const getAllTransactions = (month?: number, year?: number, search?: string) =>
  _isGuest
    ? localTx.getLocalTransactions(month, year, search)
    : remoteTx.getAllTransactions(month, year, search);

/** Search across ALL time periods — no month/year filter. */
export const searchAllTransactions = (query: string) =>
  _isGuest
    ? localTx.getLocalTransactions(undefined, undefined, query)
    : remoteTx.getTransactions(undefined, undefined, query);

export const addTransaction = (data: any) =>
  _isGuest
    ? localTx.addLocalTransaction(data)
    : remoteTx.addTransaction(data);

export const updateTransaction = (id: string, data: any) =>
  _isGuest
    ? localTx.updateLocalTransaction(id, data)
    : remoteTx.updateTransaction(id, data);

export const deleteTransaction = (id: string) =>
  _isGuest
    ? localTx.deleteLocalTransaction(id)
    : remoteTx.deleteTransaction(id);

export const restoreTransaction = (id: string) =>
  _isGuest
    ? Promise.resolve()
    : remoteTx.restoreTransaction(id);

export const getAnalytics = (month?: number, year?: number) =>
  _isGuest
    ? localTx.computeLocalAnalytics(month, year)
    : remoteTx.getAnalytics(month, year);

export const getTrend = (months = 6) =>
  _isGuest
    ? localTx.computeLocalTrend(months)
    : remoteTx.getTrend(months);

export const getInsights = (month: number, year: number) =>
  _isGuest
    ? Promise.resolve({ insights: [], month, year, noData: true })
    : remoteGetInsights(month, year);

// ── Categories (via group or local) ──────────────────────────────────────────

export const getCurrentGroup = () =>
  _isGuest
    ? localCat.getLocalCategories()
    : remoteGrp.getCurrentGroup();

export const addCategory = (name: string, icon: string, type: 'income' | 'expense' | 'both' = 'expense', emoji?: string) =>
  _isGuest
    ? localCat.addLocalCategory(name, icon, type, emoji)
    : remoteGrp.addCategory(name, icon, type, emoji);

export const removeCategory = (id: string) =>
  _isGuest
    ? localCat.removeLocalCategory(id)
    : remoteGrp.removeCategory(id);

// Category presets — named packs, so a wedding or a trip is one tap instead of typing twelve
// categories in. A guest applies them against the bundled catalogue; signed in, the server holds
// the list and does the merge.
export const getCategoryPresets = () =>
  _isGuest
    ? localCat.getLocalPresets()
    : remoteGrp.getCategoryPresets();

export const applyCategoryPreset = (key: string) =>
  _isGuest
    ? localCat.applyLocalPreset(key)
    : remoteGrp.applyCategoryPreset(key);

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

export const getBudgets = (month?: number, year?: number) =>
  _isGuest
    ? localBudg.getLocalBudgets(month, year)
    : remoteBudg.getBudgets(month, year);

export const setBudget = (data: { amount: number; month?: number; year?: number; category?: string | null }) =>
  _isGuest
    ? localBudg.setLocalBudget(data)
    : remoteBudg.setBudget(data);

export const deleteBudget = (id: string) =>
  _isGuest
    ? localBudg.deleteLocalBudget(id)
    : remoteBudg.deleteBudget(id);

// ── Accounts ──────────────────────────────────────────────────────────────────
// Accounts were local-only until now, so a signed-in user lost every one of them on reinstall or
// on a second device. Both sides are AsyncStorage-shaped: an account has an `id`, and the
// transaction→account links are a `{ [txId]: accountId }` map.

export const getAccounts = () =>
  _isGuest
    ? localAcct.getLocalAccounts()
    : remoteAcct.getAccounts();

export const saveAccount = (data: Omit<Account, 'id' | 'createdAt'> & { id?: string }) =>
  _isGuest
    ? localAcct.saveLocalAccount(data)
    : remoteAcct.saveAccount(data);

export const deleteAccount = (id: string) =>
  _isGuest
    ? localAcct.deleteLocalAccount(id)
    : remoteAcct.deleteAccount(id);

export const getTxAccountMap = () =>
  _isGuest
    ? localAcct.getLocalTxAccountMap()
    : remoteAcct.getTxAccountMap();

export const setTxAccount = (txId: string, accountId: string) =>
  _isGuest
    ? localAcct.setLocalTxAccount(txId, accountId)
    : remoteAcct.setTxAccount(txId, accountId);

export const removeTxAccount = (txId: string) =>
  _isGuest
    ? localAcct.removeLocalTxAccount(txId)
    : remoteAcct.removeTxAccount(txId);


// ── Goals (account required) ─────────────────────────────────────────────────
// Goals have no local implementation and should not have one: they are group-scoped server-side,
// and there is nothing coherent to store for a guest who has no group.
//
// They route through here anyway, rather than being imported straight from `goalApi`, so that
// "a guest reaches the network" is impossible by construction instead of depending on every screen
// remembering its own `isGuest` check. Reads answer empty — a guest genuinely has none. Writes
// reject, because silently swallowing a write the user asked for is worse than a visible failure.
// Screens still show a sign-in prompt instead of the feature; this is the backstop for the day one
// forgets.
//
// Splits used to be listed here for the same reason and are not any more. That argument was right
// about splits and wrong about the need: a shared bill does not actually require a group, it
// requires people, and W2-28 replaced splits with trips, whose members are names that may or may
// not have accounts behind them. A guest can keep a whole trip on their device, and `syncService`
// hands it to the server when they sign in — which is the one thing splits could never do.

export class GuestUnsupportedError extends Error {
  constructor(feature: string) {
    super(`${feature} require an account.`);
    this.name = 'GuestUnsupportedError';
  }
}

const guestReject = (feature: string) => Promise.reject(new GuestUnsupportedError(feature));

export const getGoals = () =>
  _isGuest
    ? Promise.resolve([] as Goal[])
    : remoteGoal.getGoals();

export const createGoal = (data: Parameters<typeof remoteGoal.createGoal>[0]) =>
  _isGuest
    ? guestReject('Savings goals')
    : remoteGoal.createGoal(data);

export const updateGoal = (id: string, data: Parameters<typeof remoteGoal.updateGoal>[1]) =>
  _isGuest
    ? guestReject('Savings goals')
    : remoteGoal.updateGoal(id, data);

export const deleteGoal = (id: string) =>
  _isGuest
    ? guestReject('Savings goals')
    : remoteGoal.deleteGoal(id);

// ── Trips (works either way) ────────────────────────────────────────────────

export const getTrips = () =>
  _isGuest
    ? localTrip.getTrips()
    : remoteTrip.getTrips();

export const getTrip = (id: string) =>
  _isGuest
    ? localTrip.getTrip(id)
    : remoteTrip.getTrip(id);

export const createTrip = (data: Parameters<typeof remoteTrip.createTrip>[0]) =>
  _isGuest
    ? localTrip.createTrip(data)
    : remoteTrip.createTrip(data);

export const renameTrip = (id: string, name: string) =>
  _isGuest
    ? localTrip.renameTrip(id, name)
    : remoteTrip.renameTrip(id, name);

export const deleteTrip = (id: string) =>
  _isGuest
    ? localTrip.deleteTrip(id)
    : remoteTrip.deleteTrip(id);

// `userId` links the member to a real account, which is what makes a payment confirmable by the
// person who received it. A guest has no accounts to link to, so the local branch ignores it.
export const addTripMember = (tripId: string, name: string, userId?: string | null) =>
  _isGuest
    ? localTrip.addMember(tripId, name)
    : remoteTrip.addMember(tripId, name, userId);

export const renameTripMember = (tripId: string, memberId: string, name: string) =>
  _isGuest
    ? localTrip.renameMember(tripId, memberId, name)
    : remoteTrip.renameMember(tripId, memberId, name);

export const removeTripMember = (tripId: string, memberId: string) =>
  _isGuest
    ? localTrip.removeMember(tripId, memberId)
    : remoteTrip.removeMember(tripId, memberId);

export const addTripExpense = (tripId: string, data: remoteTrip.ExpenseInput) =>
  _isGuest
    ? localTrip.addExpense(tripId, data)
    : remoteTrip.addExpense(tripId, data);

export const updateTripExpense = (tripId: string, expenseId: string, data: remoteTrip.ExpenseInput) =>
  _isGuest
    ? localTrip.updateExpense(tripId, expenseId, data)
    : remoteTrip.updateExpense(tripId, expenseId, data);

export const deleteTripExpense = (tripId: string, expenseId: string) =>
  _isGuest
    ? localTrip.deleteExpense(tripId, expenseId)
    : remoteTrip.deleteExpense(tripId, expenseId);

export const recordTripSettlement = (
  tripId: string,
  data: { fromId: string; toId: string; amountMinor: number },
) =>
  _isGuest
    ? localTrip.recordSettlement(tripId, data)
    : remoteTrip.recordSettlement(tripId, data);

export const deleteTripSettlement = (tripId: string, settlementId: string) =>
  _isGuest
    ? localTrip.deleteSettlement(tripId, settlementId)
    : remoteTrip.deleteSettlement(tripId, settlementId);
