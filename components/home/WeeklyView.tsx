import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePreferences } from '@/src/context/PreferencesContext';

interface Props {
  transactions: any[];
  month: number;
  year: number;
  theme: any;
}

const pad = (value: number) => String(value).padStart(2, '0');

function formatRange(start: Date, end: Date) {
  return `${pad(start.getDate())}.${pad(start.getMonth() + 1)} — ${pad(end.getDate())}.${pad(end.getMonth() + 1)}`;
}

export function WeeklyView({ transactions, month, year, theme }: Props) {
  const { formatAmount } = usePreferences();

  const { monthTx, weeks, totals } = useMemo(() => {
    const monthTx = transactions.filter(tx => {
      const date = new Date(tx.date || tx.createdAt);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const weeks: Array<{ start: Date; end: Date; income: number; expense: number; balance: number }> = [];
    const lastDay = new Date(year, month, 0).getDate();
    for (let day = 1; day <= lastDay; day += 7) {
      const start = new Date(year, month - 1, day);
      const end = new Date(year, month - 1, Math.min(day + 6, lastDay));
      let income = 0;
      let expense = 0;
      monthTx.forEach(tx => {
        const date = new Date(tx.date || tx.createdAt);
        if (date >= start && date <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)) {
          if (tx.type === 'income') income += tx.amount;
          else expense += tx.amount;
        }
      });
      weeks.push({ start, end, income, expense, balance: income - expense });
    }

    const income = monthTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const expense = monthTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

    return { monthTx, weeks, totals: { income, expense, balance: income - expense } };
  }, [transactions, month, year]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Weekly breakdown</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>{monthLabel}</Text>
        </View>
        <View style={[styles.totalPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.totalLabel, { color: theme.secondaryText }]}>Net</Text>
          <Text style={[styles.totalValue, { color: totals.balance >= 0 ? theme.income : theme.expense }]}>
            {formatAmount(totals.balance)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.income + '0F' }]}>
          <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Income</Text>
          <Text style={[styles.summaryValue, { color: theme.income }]}>{formatAmount(totals.income)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.expense + '0F' }]}>
          <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Expense</Text>
          <Text style={[styles.summaryValue, { color: theme.expense }]}>{formatAmount(totals.expense)}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {weeks.map((week, index) => {
          const hasData = week.income > 0 || week.expense > 0;
          return (
            <View key={`${week.start.toISOString()}-${index}`} style={[styles.weekCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.weekTop}>
                <Text style={[styles.weekLabel, { color: theme.text }]}>Week {index + 1}</Text>
                <Text style={[styles.weekRange, { color: theme.secondaryText }]}>{formatRange(week.start, week.end)}</Text>
              </View>
              <View style={styles.weekAmounts}>
                <View>
                  <Text style={[styles.weekAmtLabel, { color: theme.secondaryText }]}>Income</Text>
                  <Text style={[styles.weekAmt, { color: theme.income }]}>{formatAmount(week.income)}</Text>
                </View>
                <View style={styles.divider} />
                <View>
                  <Text style={[styles.weekAmtLabel, { color: theme.secondaryText }]}>Expense</Text>
                  <Text style={[styles.weekAmt, { color: theme.expense }]}>{formatAmount(week.expense)}</Text>
                </View>
                <View style={styles.divider} />
                <View>
                  <Text style={[styles.weekAmtLabel, { color: theme.secondaryText }]}>Balance</Text>
                  <Text style={[styles.weekAmt, { color: week.balance >= 0 ? theme.income : theme.expense }]}>
                    {formatAmount(week.balance)}
                  </Text>
                </View>
              </View>
              {!hasData && <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No transactions in this week</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4 },
  totalPill: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    minWidth: 104,
  },
  totalLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  list: { gap: 10 },
  weekCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
  },
  weekTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  weekLabel: { fontSize: 14, fontWeight: '800' },
  weekRange: { fontSize: 11, fontWeight: '600' },
  weekAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(127,127,127,0.2)' },
  weekAmtLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  weekAmt: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  emptyText: { fontSize: 12, marginTop: 10 },
});
