// Unified data service — routes to local (guest) or remote (logged-in) based on auth mode.
// AuthContext calls setMode() on startup and on login/logout.

import * as remoteTx   from './transactionApi';
import { getInsights as remoteGetInsights } from './transactionApi';
import * as localTx    from './local/localTransactionService';
import * as remoteGrp  from './groupApi';
import * as localCat   from './local/localCategoryService';
import * as remoteBudg from './budgetApi';
import * as localBudg  from './local/localBudgetService';

export type { Category } from './groupApi';

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

export const addCategory = (name: string, icon: string, type: 'income' | 'expense' | 'both' = 'expense') =>
  _isGuest
    ? localCat.addLocalCategory(name, icon, type)
    : remoteGrp.addCategory(name, icon, type);

export const removeCategory = (id: string) =>
  _isGuest
    ? localCat.removeLocalCategory(id)
    : remoteGrp.removeCategory(id);

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
