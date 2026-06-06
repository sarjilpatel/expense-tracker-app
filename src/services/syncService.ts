import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLocalTransactions, clearAllLocalTransactions } from './local/localTransactionService';
import { getAllLocalCategories, clearLocalCategories } from './local/localCategoryService';
import { getAllLocalBudgets, clearLocalBudgets } from './local/localBudgetService';
import * as remoteTx   from './transactionApi';
import * as remoteBudg from './budgetApi';
import * as remoteGrp  from './groupApi';

const LAST_SYNC_KEY = '@last_sync_at';

export async function getLastSyncTime(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LAST_SYNC_KEY); }
  catch { return null; }
}

async function setLastSyncTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export interface SyncSummary {
  transactions: number;
  categories: number;
  budgets: number;
  total: number;
}

export async function getSyncSummary(): Promise<SyncSummary> {
  const [txs, cats, budgets] = await Promise.all([
    getAllLocalTransactions(),
    getAllLocalCategories(),
    getAllLocalBudgets(),
  ]);
  const customCats = cats.filter(c => !c._id.startsWith('dc_'));
  return {
    transactions: txs.length,
    categories:   customCats.length,
    budgets:      budgets.length,
    total:        txs.length + customCats.length + budgets.length,
  };
}

export async function hasPendingLocalData(): Promise<boolean> {
  const { total } = await getSyncSummary();
  return total > 0;
}

export async function syncLocalToServer(
  onProgress?: (step: string, done: number, total: number) => void
): Promise<{ success: boolean; synced: number; error?: string }> {
  try {
    const [txs, cats, budgets] = await Promise.all([
      getAllLocalTransactions(),
      getAllLocalCategories(),
      getAllLocalBudgets(),
    ]);
    const customCats = cats.filter(c => !c._id.startsWith('dc_'));
    const totalItems = txs.length + customCats.length + budgets.length;
    let done = 0;

    for (const cat of customCats) {
      try { await remoteGrp.addCategory(cat.name, cat.icon, (cat.type as any) || 'expense'); } catch {}
      done++;
      onProgress?.('categories', done, totalItems);
    }

    for (const tx of txs) {
      const { _id, createdAt, ...data } = tx;
      try { await remoteTx.addTransaction(data); } catch {}
      done++;
      onProgress?.('transactions', done, totalItems);
    }

    for (const budget of budgets) {
      const { _id, createdAt, ...data } = budget;
      try { await remoteBudg.setBudget(data); } catch {}
      done++;
      onProgress?.('budgets', done, totalItems);
    }

    await discardLocalData();
    await setLastSyncTime();
    return { success: true, synced: totalItems };
  } catch (error: any) {
    return { success: false, synced: 0, error: error?.message || 'Sync failed' };
  }
}

export async function discardLocalData(): Promise<void> {
  await Promise.all([
    clearAllLocalTransactions(),
    clearLocalCategories(),
    clearLocalBudgets(),
  ]);
}
