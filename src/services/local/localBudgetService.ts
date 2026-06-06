import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@local_budgets_v1';

export interface LocalBudget {
  _id: string;
  amount: number;
  month: number;
  year: number;
  category?: string | null;
  createdAt: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function load(): Promise<LocalBudget[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function persist(data: LocalBudget[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function getLocalBudgets(month?: number, year?: number): Promise<LocalBudget[]> {
  const all = await load();
  if (!month || !year) return all;
  return all.filter(b => b.month === month && b.year === year);
}

export async function setLocalBudget(data: {
  amount: number;
  month?: number;
  year?: number;
  category?: string | null;
}): Promise<LocalBudget> {
  const all = await load();
  const now = new Date();
  const month = data.month ?? now.getMonth() + 1;
  const year  = data.year  ?? now.getFullYear();

  const idx = all.findIndex(
    b => b.month === month && b.year === year && (b.category ?? null) === (data.category ?? null)
  );

  if (idx !== -1) {
    all[idx] = { ...all[idx], amount: data.amount };
    await persist(all);
    return all[idx];
  }

  const budget: LocalBudget = {
    _id: genId(),
    amount: data.amount,
    month, year,
    category: data.category ?? null,
    createdAt: new Date().toISOString(),
  };
  all.push(budget);
  await persist(all);
  return budget;
}

export async function deleteLocalBudget(id: string): Promise<void> {
  const all = await load();
  await persist(all.filter(b => b._id !== id));
}

export async function getAllLocalBudgets(): Promise<LocalBudget[]> {
  return load();
}

export async function clearLocalBudgets(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
