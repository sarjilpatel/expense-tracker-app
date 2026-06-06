import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY    = '@accounts_v2';
const TX_ACCOUNT_KEY  = '@tx_account_map_v2';

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'savings' | 'investment' | 'wallet' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  color: string;
  icon: string;
  createdAt: string;
}

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: string; color: string; emoji: string }> = {
  cash:        { label: 'Cash',        icon: 'cash-outline',         color: '#10B981', emoji: '💵' },
  bank:        { label: 'Bank Account', icon: 'business-outline',    color: '#3B82F6', emoji: '🏦' },
  credit_card: { label: 'Credit Card',  icon: 'card-outline',        color: '#EF4444', emoji: '💳' },
  savings:     { label: 'Savings',      icon: 'wallet-outline',      color: '#F59E0B', emoji: '🏪' },
  investment:  { label: 'Investment',   icon: 'trending-up-outline', color: '#8B5CF6', emoji: '📈' },
  wallet:      { label: 'Wallet',       icon: 'wallet-outline',      color: '#EC4899', emoji: '👛' },
  other:       { label: 'Other',        icon: 'ellipse-outline',     color: '#6B7280', emoji: '📁' },
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Account CRUD ──────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveAccount(
  data: Omit<Account, 'id' | 'createdAt'> & { id?: string }
): Promise<Account> {
  const accounts = await getAccounts();

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

export async function deleteAccount(id: string): Promise<void> {
  const accounts = await getAccounts();
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter(a => a.id !== id)));
  const map = await getTxAccountMap();
  const cleaned: Record<string, string> = {};
  for (const [txId, accId] of Object.entries(map)) {
    if (accId !== id) cleaned[txId] = accId;
  }
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(cleaned));
}

// ── Transaction ↔ Account mapping ────────────────────────────────────────────

export async function getTxAccountMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(TX_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function setTxAccount(txId: string, accountId: string): Promise<void> {
  const map = await getTxAccountMap();
  map[txId] = accountId;
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(map));
}

export async function removeTxAccount(txId: string): Promise<void> {
  const map = await getTxAccountMap();
  delete map[txId];
  await AsyncStorage.setItem(TX_ACCOUNT_KEY, JSON.stringify(map));
}

// ── Balance computation ───────────────────────────────────────────────────────

export function computeAccountBalance(
  account: Account,
  transactions: any[],
  txAccountMap: Record<string, string>
): number {
  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (txAccountMap[tx._id] !== account.id) continue;
    if (tx.type === 'income')  balance += tx.amount;
    else                        balance -= tx.amount;
  }
  return balance;
}
