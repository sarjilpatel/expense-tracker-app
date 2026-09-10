// Shared account types and pure maths. The data functions that used to live here moved out:
// AsyncStorage into src/services/local/localAccountService.ts, the API calls into accountApi.ts,
// and the guest/remote switch into dataService.ts — the pattern CONTEXT.md describes for every
// other data feature. Screens import getAccounts/saveAccount/... from dataService, and only the
// types and computeAccountBalance from here.

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
  cash:        { label: 'Cash',         icon: 'cash-outline',         color: '#92400E', emoji: '💵' },
  bank:        { label: 'Bank Account', icon: 'business-outline',     color: '#1E3A5F', emoji: '🏦' },
  credit_card: { label: 'Credit Card',  icon: 'card-outline',         color: '#134E4A', emoji: '💳' },
  savings:     { label: 'Savings',      icon: 'wallet-outline',       color: '#14532D', emoji: '🏪' },
  investment:  { label: 'Investment',   icon: 'trending-up-outline',  color: '#4C1D95', emoji: '📈' },
  wallet:      { label: 'Wallet',       icon: 'wallet-outline',       color: '#7C2D12', emoji: '👛' },
  other:       { label: 'Other',        icon: 'ellipse-outline',      color: '#374151', emoji: '📁' },
};

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
