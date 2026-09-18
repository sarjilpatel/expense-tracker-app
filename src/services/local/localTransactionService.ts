import { getSyncMeta } from '@/src/sync/meta';
import { JsonStore } from './jsonStore';

const KEY = '@local_transactions_v1';

export interface LocalTransaction {
  _id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  note?: string;
  date: string;
  createdAt: string;
  accountId?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: string;
  isPrivate?: boolean;
  currency?: string;
  /** The savings goal this transaction contributes to, when it is a goal contribution. */
  goalId?: string | null;
  // Present on rows that have been through the server: who wrote it and which group it is in.
  userId?: string | { _id: string; name?: string; profilePhoto?: string } | null;
  groupId?: string | null;
  updatedAt?: string;
  /** Set by the server once a receipt is uploaded; the file itself is fetched on demand. */
  receiptKey?: string | null;
  serverId?: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const store = new JsonStore<LocalTransaction[]>(KEY, () => []);
const load    = () => store.get();
const persist = (data: LocalTransaction[]) => store.set(data);

/**
 * Splits a note the same way the server's blind index does (W1-28), so a query returns the same
 * rows before and after signing in.
 *
 * The server cannot substring-match a note: it stores AES-GCM ciphertext and searches a keyed
 * hash of each word instead. Guest data is plaintext on the device and *could* be substring
 * matched — but then "cof" would find the coffee row as a guest and silently stop finding it the
 * day the user creates an account, with no way to tell which behaviour is the real one. Matching
 * the narrower rule in both places is the only version that is explainable. Category is untouched:
 * it is not encrypted, and the server still matches it as a substring.
 */
function noteWords(text?: string | null): string[] {
  return String(text ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The rows the signed-in user should see: the active group's, plus anything not yet pushed. */
async function inScope(rows: LocalTransaction[]): Promise<LocalTransaction[]> {
  const { activeGroupId } = await getSyncMeta();
  if (!activeGroupId) return rows;
  return rows.filter(tx => !tx.groupId || String(tx.groupId) === activeGroupId);
}

export async function getLocalTransactions(
  month?: number, year?: number, search?: string
): Promise<LocalTransaction[]> {
  let all = await inScope(await load());

  if (month && year) {
    all = all.filter(tx => {
      const d = new Date(tx.date || tx.createdAt);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  }
  if (search?.trim()) {
    const q    = search.trim().toLowerCase();
    const term = noteWords(search)[0];
    all = all.filter(tx =>
      tx.category?.toLowerCase().includes(q) ||
      (!!term && noteWords(tx.note).includes(term))
    );
  }
  return sortNewest(all);
}

const when = (tx: LocalTransaction) => new Date(tx.date || tx.createdAt).getTime();

// Parse each date once, not twice per comparison — on a few thousand rows the difference is
// tens of milliseconds of JS time, spent while a screen is trying to animate in.
function sortNewest(rows: LocalTransaction[]): LocalTransaction[] {
  return rows
    .map(tx => ({ t: when(tx), tx }))
    .sort((a, b) => b.t - a.t)
    .map(x => x.tx);
}

/**
 * The categories used most recently, newest first, at most `limit` per type. One pass over the
 * list; the add form shows these as chips and used to sort the whole history to get them.
 */
export async function getLocalRecentCategories(limit = 6): Promise<{ income: string[]; expense: string[] }> {
  const rows = await inScope(await load());
  const latest = new Map<string, number>();
  for (const tx of rows) {
    if (!tx.category || (tx.type !== 'income' && tx.type !== 'expense')) continue;
    const key = tx.type + '|' + tx.category;
    const t = when(tx);
    if (t > (latest.get(key) ?? -Infinity)) latest.set(key, t);
  }
  const ranked = [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const out = { income: [] as string[], expense: [] as string[] };
  for (const key of ranked) {
    const [type, category] = key.split('|') as ['income' | 'expense', string];
    if (out[type].length < limit) out[type].push(category);
  }
  return out;
}

export async function addLocalTransaction(
  data: Omit<LocalTransaction, '_id' | 'createdAt'>
): Promise<LocalTransaction> {
  const all = await load();
  const tx: LocalTransaction = {
    ...data,
    _id: genId(),
    createdAt: new Date().toISOString(),
  };
  all.unshift(tx);
  await persist(all);
  return tx;
}

export async function updateLocalTransaction(
  id: string, data: Partial<LocalTransaction>
): Promise<LocalTransaction> {
  const all = await load();
  const idx = all.findIndex(t => t._id === id);
  if (idx === -1) throw new Error('Transaction not found');
  all[idx] = { ...all[idx], ...data };
  await persist(all);
  return all[idx];
}

export async function deleteLocalTransaction(id: string): Promise<{ message: string }> {
  const all = await load();
  await persist(all.filter(t => t._id !== id));
  return { message: 'Deleted' };
}

export async function computeLocalAnalytics(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? (now.getMonth() + 1);
  const y = year ?? now.getFullYear();

  const txs = await getLocalTransactions(m, y);
  let totalIncome = 0;
  let totalExpense = 0;
  const expMap: Record<string, number> = {};
  const incMap: Record<string, number> = {};

  txs.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
      incMap[tx.category] = (incMap[tx.category] || 0) + amt;
    } else {
      totalExpense += amt;
      expMap[tx.category] = (expMap[tx.category] || 0) + amt;
    }
  });

  const toBreakdown = (map: Record<string, number>, total: number) =>
    Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? ((amount / total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.amount - a.amount);

  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevTxs = await getLocalTransactions(prevM, prevY);
  let prevIncome = 0, prevExpense = 0;
  prevTxs.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') prevIncome += amt;
    else prevExpense += amt;
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryBreakdown: toBreakdown(expMap, totalExpense),
    incomeBreakdown: toBreakdown(incMap, totalIncome),
    previousMonth: { totalIncome: prevIncome, totalExpense: prevExpense },
    memberBreakdown: [],
  };
}

export async function computeLocalTrend(months = 6) {
  const all = await inScope(await load());
  const now = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    let income = 0, expense = 0;
    all
      .filter(tx => {
        const td = new Date(tx.date || tx.createdAt);
        return td.getMonth() + 1 === m && td.getFullYear() === y;
      })
      .forEach(tx => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') income += amt;
        else expense += amt;
      });
    result.push({
      month: m, year: y,
      monthLabel: d.toLocaleString('default', { month: 'short' }),
      income, expense, net: income - expense,
    });
  }
  return result;
}

export async function getAllLocalTransactions(): Promise<LocalTransaction[]> {
  return load();
}

export async function clearAllLocalTransactions(): Promise<void> {
  await store.clear();
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────
// Rows arrive from other devices and other group members through the changes feed; the engine
// upserts them here by clientId (which *is* the local id) and removes tombstones. Reads filter on
// the active group when signed in: a row with no groupId is this device's own, not yet pushed.

export async function upsertLocalTransaction(row: LocalTransaction): Promise<void> {
  const all = await load();
  const idx = all.findIndex(t => t._id === row._id);
  if (idx === -1) all.unshift(row); else all[idx] = { ...all[idx], ...row };
  await persist(all);
}

export async function removeLocalTransaction(id: string): Promise<void> {
  const all = await load();
  const next = all.filter(t => t._id !== id);
  if (next.length !== all.length) await persist(next);
}

/** Every row on the device regardless of group — what a full local export or a group switch reads. */
export async function getLocalTransactionById(id: string): Promise<LocalTransaction | null> {
  return (await load()).find(t => t._id === id) ?? null;
}
