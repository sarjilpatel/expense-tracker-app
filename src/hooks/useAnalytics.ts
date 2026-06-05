import { useState, useCallback, useRef } from 'react';
import { getAnalytics } from '../services/transactionApi';

export interface AnalyticsData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryBreakdown: { category: string; amount: number; percentage: string }[];
  incomeBreakdown: { category: string; amount: number; percentage: string }[];
  weeklyTrends: { week: number; type: string; amount: number }[];
  memberBreakdown: { user: any; type: string; amount: number; percentage: string }[];
}

export function useAnalytics(month: number, year: number) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, AnalyticsData>>({});

  const fetch = useCallback(async (silent = false) => {
    const key = `${month}-${year}`;
    if (!silent && cache.current[key]) {
      setData(cache.current[key]);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await getAnalytics(month, year);
      cache.current[key] = result;
      setData(result);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  return { data, loading, refreshing, error, fetch };
}
