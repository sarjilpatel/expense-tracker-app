import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAllLocalTransactions, retainLocalTransactions, clearAllLocalTransactions } from './local/localTransactionService';
import { getAllLocalCategories, retainLocalCategories, clearLocalCategories } from './local/localCategoryService';
import { getAllLocalBudgets, retainLocalBudgets, clearLocalBudgets } from './local/localBudgetService';
import {
  getLocalAccounts, getLocalTxAccountMap, setLocalTxAccountMap,
  retainLocalAccounts, clearLocalAccounts, clearLocalTxAccountMap,
} from './local/localAccountService';
import * as localTrip from './local/localTripService';
import apiClient, { LONG_TIMEOUT_MS } from './apiClient';
import * as remoteBudg from './budgetApi';
import * as remoteGrp  from './groupApi';
import * as remoteAcct from './accountApi';
import * as remoteTrip from './tripApi';

const LAST_SYNC_KEY = '@last_sync_at';

/** Server caps /transactions/import-json at 500 rows per call. */
const IMPORT_CHUNK = 250;

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
  accounts: number;
  trips: number;
  total: number;
}

export interface SyncResult {
  /** True only when every single item was accepted by the server. */
  success: boolean;
  synced: number;
  /** Items still held locally because they failed — never silently discarded. */
  failed: number;
  error?: string;
}

export async function getSyncSummary(): Promise<SyncSummary> {
  const [txs, cats, budgets, accounts, trips] = await Promise.all([
    getAllLocalTransactions(),
    getAllLocalCategories(),
    getAllLocalBudgets(),
    getLocalAccounts(),
    localTrip.getTrips(),
  ]);
  const customCats = cats.filter(c => !c._id.startsWith('dc_'));
  return {
    transactions: txs.length,
    categories:   customCats.length,
    budgets:      budgets.length,
    accounts:     accounts.length,
    trips:        trips.length,
    total:        txs.length + customCats.length + budgets.length + accounts.length + trips.length,
  };
}

export async function hasPendingLocalData(): Promise<boolean> {
  const { total } = await getSyncSummary();
  return total > 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Pushes guest data to the server, then clears ONLY what the server accepted.
 *
 * Anything that fails stays on the device and is reported back, so a dropped connection or a
 * rejected row can be retried instead of vanishing. Transactions go through the bulk import
 * endpoint in chunks rather than one request each — the API is rate limited to 60 req/min, and
 * the old per-item loop blew straight through it and lost everything past the limit.
 */
export async function syncLocalToServer(
  onProgress?: (step: string, done: number, total: number) => void
): Promise<SyncResult> {
  try {
    const [txs, cats, budgets, accounts, trips, txAccountMap] = await Promise.all([
      getAllLocalTransactions(),
      getAllLocalCategories(),
      getAllLocalBudgets(),
      getLocalAccounts(),
      localTrip.getTrips(),
      getLocalTxAccountMap(),
    ]);
    const customCats = cats.filter(c => !c._id.startsWith('dc_'));
    const totalItems = txs.length + customCats.length + budgets.length + accounts.length + trips.length;

    // The account this sync is for — read the same way AuthContext stored it. Only trips need it:
    // it is what links a guest trip's self-member to the person now signed in.
    const myUserId = await SecureStore.getItemAsync('user')
      .then(raw => (raw ? String(JSON.parse(raw)?._id ?? '') : ''))
      .catch(() => '');

    if (totalItems === 0) {
      await setLastSyncTime();
      return { success: true, synced: 0, failed: 0 };
    }

    const failedCatIds:     string[] = [];
    const failedTxIds:      string[] = [];
    const failedBudgetIds:  string[] = [];
    const failedAccountIds: string[] = [];
    const failedTripIds:    string[] = [];
    let   firstError: string | undefined;
    let   done = 0;

    const note = (err: any) => {
      if (!firstError) {
        firstError = err?.msg || err?.message || (typeof err === 'string' ? err : 'Upload failed');
      }
    };

    // Categories first — transactions reference them by name, and the server rejects a
    // transaction whose category is not in the group.
    for (const cat of customCats) {
      try {
        await remoteGrp.addCategory(cat.name, cat.icon, (cat.type as any) || 'expense');
      } catch (err) {
        failedCatIds.push(cat._id);
        note(err);
      }
      done++;
      onProgress?.('categories', done, totalItems);
    }

    // Accounts before transactions: the server hands back a guest-id → server-id map, and the
    // transaction import below uses it to preserve which account each transaction was filed under.
    // Without this the accounts would arrive but every transaction would land unassigned.
    let accountIdMap: Record<string, string> = {};
    if (accounts.length > 0) {
      try {
        const result = await remoteAcct.importAccounts(accounts);
        accountIdMap = result.idMap || {};
        // Anything the server didn't map stays on the device rather than vanishing.
        for (const acc of accounts) {
          if (!accountIdMap[acc.id]) failedAccountIds.push(acc.id);
        }
        if (failedAccountIds.length > 0) {
          note({ msg: `Server accepted ${result.imported} of ${accounts.length} accounts` });
        }

        // Rewrite the stored map to server ids straight away. If the transaction upload below
        // fails, the rows stay on the device and are retried later — by which point the guest
        // account ids no longer exist anywhere, so a map still holding them would be dead weight
        // and every retried transaction would land unassigned.
        const remapped: Record<string, string> = {};
        for (const [txId, accId] of Object.entries(txAccountMap)) {
          const mapped = accountIdMap[accId];
          if (mapped) { remapped[txId] = mapped; txAccountMap[txId] = mapped; }
          else if (accId) remapped[txId] = accId;
        }
        await setLocalTxAccountMap(remapped);
      } catch (err) {
        failedAccountIds.push(...accounts.map(a => a.id));
        note(err);
      }
      done += accounts.length;
      onProgress?.('accounts', done, totalItems);
    }

    // Transactions in bulk. A chunk is all-or-nothing from the client's point of view, so a
    // failed chunk keeps every row in it.
    for (const batch of chunk(txs, IMPORT_CHUNK)) {
      try {
        const payload = batch.map(({ _id, createdAt, ...data }) => {
          // txAccountMap was rewritten to server ids above. The server drops any id that isn't
          // one of the caller's accounts, so a stale value is harmless.
          const accountId = txAccountMap[_id];
          return accountId ? { ...data, accountId } : data;
        });
        const { data: result } = await apiClient.post('/transactions/import-json',
          { transactions: payload }, { timeout: LONG_TIMEOUT_MS });

        // The server skips rows it considers invalid (non-positive amounts). If it took fewer
        // than we sent, hold the whole chunk rather than guess which rows were dropped.
        if (typeof result?.imported === 'number' && result.imported < batch.length) {
          failedTxIds.push(...batch.map(t => t._id));
          note({ msg: `Server accepted ${result.imported} of ${batch.length} transactions` });
        }
      } catch (err) {
        failedTxIds.push(...batch.map(t => t._id));
        note(err);
      }
      done += batch.length;
      onProgress?.('transactions', done, totalItems);
    }

    for (const budget of budgets) {
      try {
        const { _id, createdAt, ...data } = budget;
        await remoteBudg.setBudget(data);
      } catch (err) {
        failedBudgetIds.push(budget._id);
        note(err);
      }
      done++;
      onProgress?.('budgets', done, totalItems);
    }

    // Trips last. Each one is several requests rather than a row in a bulk import, so if the rate
    // limit is going to cut the run short it should cut it here, where a trip either arrives whole
    // or is rolled back — not somewhere the failure is half an import.
    for (const trip of trips) {
      let createdId: string | null = null;
      try {
        // Member ids go up verbatim and the server keeps them, so the expenses below still name
        // their payer and participants correctly with no remapping. The member marked `isSelf` is
        // sent with the account's own id, and the server links *that* one rather than seeding a
        // second "you" beside it — a duplicate would carry a zero balance while the real one held
        // every debt, and deleting the wrong one cascades through every expense it paid for.
        // (A trip made before `isSelf` existed has no marked member; the server then seeds one.)
        const created = await remoteTrip.createTrip({
          name:     trip.name,
          currency: trip.currency,
          members:  trip.members.map(m => ({
            id: m.id, name: m.name, ...(m.isSelf && myUserId ? { userId: myUserId } : {}),
          })),
        });
        createdId = created.id;

        for (const e of trip.expenses) {
          await remoteTrip.addExpense(created.id, {
            description:    e.description,
            amountMinor:    e.amountMinor,
            paidById:       e.paidById,
            participantIds: e.participantIds,
            sharesMinor:    e.sharesMinor ?? null,
          });
        }
        for (const st of trip.settlements) {
          await remoteTrip.recordSettlement(created.id, {
            fromId:      st.fromId,
            toId:        st.toId,
            amountMinor: st.amountMinor,
          });
        }
      } catch (err) {
        // The trip stays on the device, so a half-uploaded one has to come back off the server —
        // otherwise the retry adds a second copy alongside the incomplete first. If even the delete
        // fails there is nothing further to do from here; the local copy is still intact, which is
        // the invariant that matters.
        if (createdId) { try { await remoteTrip.deleteTrip(createdId); } catch {} }
        failedTripIds.push(trip.id);
        note(err);
      }
      done++;
      onProgress?.('trips', done, totalItems);
    }

    // Keep exactly what did not land; drop the rest.
    await Promise.all([
      retainLocalCategories(failedCatIds),
      retainLocalTransactions(failedTxIds),
      retainLocalBudgets(failedBudgetIds),
      retainLocalAccounts(failedAccountIds),
      localTrip.retainTrips(failedTripIds),
    ]);

    // The map is only safe to drop once nothing is left waiting to reference it.
    if (failedAccountIds.length === 0 && failedTxIds.length === 0) await clearLocalTxAccountMap();

    const failed = failedCatIds.length + failedTxIds.length + failedBudgetIds.length
                 + failedAccountIds.length + failedTripIds.length;
    const synced = totalItems - failed;

    if (failed === 0) await setLastSyncTime();

    return {
      success: failed === 0,
      synced,
      failed,
      error: failed > 0
        ? `${failed} item${failed === 1 ? '' : 's'} could not be uploaded and are still on this device. ${firstError ?? ''}`.trim()
        : undefined,
    };
  } catch (error: any) {
    // Nothing was cleared — the local copy is intact and the user can retry.
    return {
      success: false,
      synced: 0,
      failed: -1,
      error: error?.message || 'Sync failed',
    };
  }
}

export async function discardLocalData(): Promise<void> {
  await Promise.all([
    clearAllLocalTransactions(),
    clearLocalCategories(),
    clearLocalBudgets(),
    clearLocalAccounts(),
    localTrip.clearAllTrips(),
  ]);
}
