// Guest-mode accounts. This is the AsyncStorage implementation that used to be the *only*
// implementation — `src/services/accountService.ts` now holds just the shared types and the
// balance maths, and `dataService` picks between this and `accountApi` per auth mode.

import type { Account } from '../accountService';
import { JsonStore } from './jsonStore';

const accounts = new JsonStore<Account[]>('@accounts_v2', () => []);
const txMap    = new JsonStore<Record<string, string>>('@tx_account_map_v2', () => ({}));

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Account CRUD ──────────────────────────────────────────────────────────────

export async function getLocalAccounts(): Promise<Account[]> {
  return accounts.get();
}

export async function saveLocalAccount(
  data: Omit<Account, 'id' | 'createdAt'> & { id?: string }
): Promise<Account> {
  const all = await getLocalAccounts();

  if (data.id) {
    const idx = all.findIndex(a => a.id === data.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...data } as Account;
      await accounts.set(all);
      return all[idx];
    }
  }

  const newAccount: Account = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  } as Account;
  all.push(newAccount);
  await accounts.set(all);
  return newAccount;
}

export async function deleteLocalAccount(id: string): Promise<void> {
  const all = await getLocalAccounts();
  await accounts.set(all.filter(a => a.id !== id));
  const map = await getLocalTxAccountMap();
  const cleaned: Record<string, string> = {};
  for (const [txId, accId] of Object.entries(map)) {
    if (accId !== id) cleaned[txId] = accId;
  }
  await txMap.set(cleaned);
}

// ── Transaction ↔ Account mapping ────────────────────────────────────────────

export async function getLocalTxAccountMap(): Promise<Record<string, string>> {
  return txMap.get();
}

export async function setLocalTxAccount(txId: string, accountId: string): Promise<void> {
  const map = await getLocalTxAccountMap();
  map[txId] = accountId;
  await txMap.set(map);
}

export async function removeLocalTxAccount(txId: string): Promise<void> {
  const map = await getLocalTxAccountMap();
  delete map[txId];
  await txMap.set(map);
}

export async function clearLocalAccounts(): Promise<void> {
  await Promise.all([accounts.clear(), txMap.clear()]);
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────
// Rows arrive from other devices and other group members through the changes feed; the engine
// upserts them here by clientId (which *is* the local id) and removes tombstones. Reads filter on
// the active group when signed in: a row with no groupId is this device's own, not yet pushed.

export async function upsertLocalAccount(row: Account): Promise<void> {
  const all = await getLocalAccounts();
  const idx = all.findIndex(a => a.id === row.id);
  if (idx === -1) all.push(row); else all[idx] = { ...all[idx], ...row };
  await accounts.set(all);
}

export async function removeLocalAccount(id: string): Promise<void> {
  const all = await getLocalAccounts();
  const next = all.filter(a => a.id !== id);
  if (next.length !== all.length) await accounts.set(next);
}
