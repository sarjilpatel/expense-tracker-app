// Guest-mode accounts. This is the AsyncStorage implementation that used to be the *only*
// implementation — `src/services/accountService.ts` now holds just the shared types and the
// balance maths, and `dataService` picks between this and `accountApi` per auth mode.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Account } from '../accountService';

const ACCOUNTS_KEY   = '@accounts_v2';
const TX_ACCOUNT_KEY = '@tx_account_map_v2';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Account CRUD ──────────────────────────────────────────────────────────────

export async function getLocalAccounts(): Promise<Account[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveLocalAccount(
  data: Omit<Account, 'id' | 'createdAt'> & { id?: string }
): Promise<Account> {
  const accounts = await getLocalAccounts();

  if (data.id) {
    const idx = accounts.findIndex(a => a.id === data.id);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...data } as Account;
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      return accounts[idx];
    }
  }

  const newAccount: Account = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  } as Account;
  accounts.push(newAccount);
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return newAccount;
}

export async function deleteLocalAccount(id: string): Promise<void> {
  const accounts = await getLocalAccounts();
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter(a => a.id !== id)));
  const map = await getLocalTxAccountMap();
  const cleaned: Record<string, string> = {};
  for (const [txId, accId] of Object.entries(map)) {
    if (accId !== id) cleaned[txId] = accId;
  }
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(cleaned));
}

// ── Transaction ↔ Account mapping ────────────────────────────────────────────

export async function getLocalTxAccountMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(TX_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function setLocalTxAccount(txId: string, accountId: string): Promise<void> {
  const map = await getLocalTxAccountMap();
  map[txId] = accountId;
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(map));
}

export async function removeLocalTxAccount(txId: string): Promise<void> {
  const map = await getLocalTxAccountMap();
  delete map[txId];
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(map));
}

/** Replaces the whole map. Sync uses it to rewrite guest account ids to server ids. */
export async function setLocalTxAccountMap(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(map));
}

// ── Sync support ──────────────────────────────────────────────────────────────

export async function clearLocalAccounts(): Promise<void> {
  await AsyncStorage.multiRemove([ACCOUNTS_KEY, TX_ACCOUNT_KEY]);
}

export async function clearLocalTxAccountMap(): Promise<void> {
  await AsyncStorage.removeItem(TX_ACCOUNT_KEY);
}

/**
 * Keeps only the given ids — used by sync to hold on to whatever failed to upload.
 *
 * Deliberately leaves the tx→account map alone. Once accounts have synced, sync rewrites the
 * map's values to the new server ids so that transactions still waiting to upload keep their
 * links; wiping the map here would strand them. Sync clears it explicitly once everything lands.
 */
export async function retainLocalAccounts(ids: string[]): Promise<void> {
  const keep = new Set(ids);
  const all  = await getLocalAccounts();
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all.filter(a => keep.has(a.id))));
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────
// Rows arrive from other devices and other group members through the changes feed; the engine
// upserts them here by clientId (which *is* the local id) and removes tombstones. Reads filter on
// the active group when signed in: a row with no groupId is this device's own, not yet pushed.

export async function upsertLocalAccount(row: Account): Promise<void> {
  const all = await getLocalAccounts();
  const idx = all.findIndex(a => a.id === row.id);
  if (idx === -1) all.push(row); else all[idx] = { ...all[idx], ...row };
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
}

export async function removeLocalAccount(id: string): Promise<void> {
  const all = await getLocalAccounts();
  const next = all.filter(a => a.id !== id);
  if (next.length !== all.length) await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
}
