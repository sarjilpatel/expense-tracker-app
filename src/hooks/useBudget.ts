import { useState, useCallback } from 'react';
import { getBudgets } from '../services/budgetApi';

export function useBudget(month: number, year: number) {
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const budgets = await getBudgets(month, year);
      const main = (budgets || []).find((b: any) => !b.category) || null;
      setBudget(main);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  return { budget, loading, error, fetch };
}
