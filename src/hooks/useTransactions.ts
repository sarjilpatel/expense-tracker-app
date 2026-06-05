import { useState, useCallback, useRef } from 'react';
import { getTransactions } from '../services/transactionApi';

export interface Transaction {
  _id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  note?: string;
  date: string;
  createdAt: string;
  userId?: { _id: string; name: string; profilePhoto?: string };
  isRecurring?: boolean;
  recurrenceFrequency?: string;
  groupId?: string;
}

export function useTransactions(month: number, year: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, Transaction[]>>({});

  const fetch = useCallback(async (silent = false) => {
    const key = `${month}-${year}`;
    if (!silent && cache.current[key]) {
      setTransactions(cache.current[key]);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getTransactions(month, year);
      cache.current[key] = data;
      setTransactions(data);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  const invalidate = useCallback(() => {
    const key = `${month}-${year}`;
    delete cache.current[key];
  }, [month, year]);

  const updateLocally = useCallback((updater: (prev: Transaction[]) => Transaction[]) => {
    setTransactions(prev => {
      const next = updater(prev);
      cache.current[`${month}-${year}`] = next;
      return next;
    });
  }, [month, year]);

  return { transactions, loading, refreshing, error, fetch, invalidate, updateLocally };
}
