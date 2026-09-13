import AsyncStorage from '@react-native-async-storage/async-storage';
import * as outbox from './outbox';
import { updateSyncMeta } from './meta';
import { getAllLocalTransactions, clearAllLocalTransactions } from '@/src/services/local/localTransactionService';
import { getAllLocalBudgets, clearLocalBudgets } from '@/src/services/local/localBudgetService';
import { getLocalAccounts, clearLocalAccounts, getLocalTxAccountMap } from '@/src/services/local/localAccountService';
import { getAllLocalCategories, clearLocalCategories } from '@/src/services/local/localCategoryService';
import { getAllLocalGoals, clearLocalGoals } from '@/src/services/local/localGoalService';
import { getTrips, clearAllTrips } from '@/src/services/local/localTripService';
import { clearAllUserCaches } from '@/src/cache/transactionCache';
import { getReceiptMap } from '@/src/services/receiptService';

const SEEDED_KEY = '@sync_outbox_seeded_v1';

/**
 * Two housekeeping jobs around the local store (W3-19).
 *
 * `seedOutboxFromLocal` queues a create for every row the server has never heard of — rows
 * written as a guest before the outbox existed, or before this version of the app. A row that
 * has been through the server carries a `groupId` (or, for accounts, was pulled from it) and is
 * skipped. Runs once per sign-in; that is what makes "guest → sign in" the same path as any
 * other write: the local data simply *is* the outbox.
 *
 * `clearLocalData` empties every local collection, the outbox and the cursor — logout, or a
 * reset. Receipts stay: they are files, and the transaction that owns one is gone anyway.
 */
export async function seedOutboxFromLocal(): Promise<number> {
  try { if ((await AsyncStorage.getItem(SEEDED_KEY)) === 'true') return 0; } catch {}
  const batch: Parameters<typeof outbox.enqueueMany>[0] = [];
  const txMap = await getLocalTxAccountMap();

  for (const c of await getAllLocalCategories()) {
    if ((c as any).groupId || c._id.startsWith('dc_')) continue;   // defaults exist server-side already
    batch.push({ collection: 'categories', op: 'create', clientId: c._id, groupId: null,
      payload: { name: c.name, icon: c.icon, emoji: c.emoji ?? '', type: c.type ?? 'expense' } });
  }
  for (const a of await getLocalAccounts()) {
    if ((a as any).serverId) continue;
    batch.push({ collection: 'accounts', op: 'create', clientId: a.id, groupId: null,
      payload: { name: a.name, type: a.type, openingBalance: a.openingBalance, color: a.color, icon: a.icon, createdAt: a.createdAt } });
  }
  for (const b of await getAllLocalBudgets()) {
    if ((b as any).groupId !== undefined) continue;
    batch.push({ collection: 'budgets', op: 'create', clientId: b._id, groupId: null,
      payload: { amount: b.amount, month: b.month, year: b.year, category: b.category ?? null, createdAt: b.createdAt } });
  }
  for (const g of await getAllLocalGoals()) {
    if (g.groupId) continue;
    batch.push({ collection: 'goals', op: 'create', clientId: g._id, groupId: null,
      payload: { name: g.name, targetAmount: g.targetAmount, savedAmount: g.savedAmount, deadline: g.deadline, icon: g.icon, color: g.color, createdAt: g.createdAt } });
  }
  for (const tx of await getAllLocalTransactions()) {
    if (tx.groupId) continue;
    batch.push({ collection: 'transactions', op: 'create', clientId: tx._id, groupId: null,
      payload: { amount: tx.amount, type: tx.type, category: tx.category, note: tx.note, date: tx.date, currency: tx.currency,
                 isRecurring: tx.isRecurring, recurrenceFrequency: tx.recurrenceFrequency, isPrivate: tx.isPrivate,
                 createdAt: tx.createdAt, accountId: txMap[tx._id] ?? null } });
  }
  for (const t of await getTrips()) {
    if (t.groupId) continue;
    batch.push({ collection: 'trips', op: 'create', clientId: t.id, groupId: null,
      payload: { name: t.name, currency: t.currency, members: t.members, expenses: t.expenses, settlements: t.settlements, createdAt: t.createdAt } });
  }
  // Receipts already on the device for rows the server has no file for.
  const receipts = await getReceiptMap();
  const txs = await getAllLocalTransactions();
  for (const [txId, uri] of Object.entries(receipts)) {
    const row = txs.find(t => t._id === txId);
    if (row && !row.receiptKey) batch.push({ collection: 'attachments', op: 'create', clientId: txId, groupId: null, payload: { uri } });
  }
  await outbox.enqueueMany(batch);
  try { await AsyncStorage.setItem(SEEDED_KEY, 'true'); } catch {}
  return batch.length;
}

export async function clearLocalData(): Promise<void> {
  await Promise.all([
    clearAllLocalTransactions(), clearLocalBudgets(), clearLocalAccounts(),
    clearLocalCategories(), clearLocalGoals(), clearAllTrips(), clearAllUserCaches(),
  ]);
  await outbox.clear();
  await updateSyncMeta({ cursor: null, lastSyncAt: null, lastError: null, activeGroupId: null });
  try { await AsyncStorage.removeItem(SEEDED_KEY); } catch {}
}

/** Is there anything on the device the server does not have? */
export async function hasUnsyncedChanges(): Promise<boolean> {
  return (await outbox.count()) > 0;
}
