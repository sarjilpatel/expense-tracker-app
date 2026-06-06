import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function load(): Promise<LocalTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function persist(data: LocalTransaction[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function getLocalTransactions(
  month?: number, year?: number, search?: string
): Promise<LocalTransaction[]> {
  let all = await load();

  if (month && year) {
    all = all.filter(tx => {
      const d = new Date(tx.date || tx.createdAt);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  }
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    all = all.filter(tx =>
      tx.category?.toLowerCase().includes(q) || tx.note?.toLowerCase().includes(q)
    );
  }
  return all.sort(
    (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
  );
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
  const txs = await getLocalTransactions(month, year);
  let totalIncome = 0;
  let totalExpense = 0;
  const catMap: Record<string, { total: number; count: number; type: string }> = {};

  txs.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') totalIncome += amt;
    else totalExpense += amt;
    if (!catMap[tx.category]) catMap[tx.category] = { total: 0, count: 0, type: tx.type };
    catMap[tx.category].total += amt;
    catMap[tx.category].count += 1;
  });

  const byCategory = Object.entries(catMap)
    .map(([name, v]) => ({ name, total: v.total, count: v.count, type: v.type }))
    .sort((a, b) => b.total - a.total);

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory, count: txs.length };
}

export async function computeLocalTrend(months = 6) {
  const all = await load();
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
  await AsyncStorage.removeItem(KEY);
}
