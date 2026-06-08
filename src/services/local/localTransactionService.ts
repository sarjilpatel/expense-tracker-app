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
