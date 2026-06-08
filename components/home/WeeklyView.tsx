import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';

interface Props {
  transactions: any[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SCREEN_W = Dimensions.get('window').width;

export function WeeklyView({ transactions }: Props) {
  const { theme } = useTheme();
  const { formatAmount } = usePreferences();

  const { weekTx, weekStart, weekEnd, totals, barData } = useMemo(() => {
    const now = new Date();
    // Monday-start ISO week
    const dow = now.getDay(); // 0=Sun
    const diff = (dow === 0 ? -6 : 1 - dow);
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59);

    const weekTx = transactions.filter(tx => {
      const d = new Date(tx.date || tx.createdAt);
      return d >= mon && d <= sun;
    });

    const dailyIncome  = Array(7).fill(0);
    const dailyExpense = Array(7).fill(0);

    weekTx.forEach(tx => {
      const d = new Date(tx.date || tx.createdAt);
      const dow = d.getDay(); // 0=Sun
      const idx = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
      if (tx.type === 'income')  dailyIncome[idx]  += tx.amount;
      else                       dailyExpense[idx] += tx.amount;
    });

    const pairs = DAY_LABELS.flatMap((label, i) => [
      {
        value: dailyIncome[i],
        label,
        frontColor: theme.income,
        spacing: 2,
        labelTextStyle: { color: theme.secondaryText, fontSize: 10 },
      },
      {
        value: dailyExpense[i],
        frontColor: theme.expense,
        spacing: 14,
      },
    ]);

    const income  = weekTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const expense = weekTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);

    return {
      weekTx,
      weekStart: mon,
      weekEnd: sun,
      totals: { income, expense, balance: income - expense },
      barData: pairs,
    };
  }, [transactions, theme]);

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.wrap}>
      {/* Period label */}
      <Text style={[styles.period, { color: theme.secondaryText }]}>
        {fmt(weekStart)} — {fmt(weekEnd)}
      </Text>

      {/* Totals strip */}
      <View style={[styles.strip, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.stripCol}>
          <Text style={[styles.stripLabel, { color: theme.secondaryText }]}>Income</Text>
          <Text style={[styles.stripVal, { color: theme.income }]}>{formatAmount(totals.income)}</Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />
        <View style={styles.stripCol}>
          <Text style={[styles.stripLabel, { color: theme.secondaryText }]}>Expense</Text>
          <Text style={[styles.stripVal, { color: theme.expense }]}>{formatAmount(totals.expense)}</Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />
        <View style={styles.stripCol}>
          <Text style={[styles.stripLabel, { color: theme.secondaryText }]}>Balance</Text>
          <Text style={[styles.stripVal, { color: totals.balance >= 0 ? theme.income : theme.expense }]}>
            {formatAmount(totals.balance)}
          </Text>
        </View>
      </View>

      {/* Bar chart */}
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {weekTx.length === 0 ? (
          <Text style={[styles.empty, { color: theme.secondaryText }]}>No transactions this week</Text>
        ) : (
          <ErrorBoundary fallback={<Text style={[styles.empty, { color: theme.secondaryText }]}>Chart unavailable</Text>}>
            <BarChart
              data={barData}
              width={SCREEN_W - 80}
              height={160}
              barWidth={14}
              spacing={2}
              noOfSections={3}
              barBorderRadius={5}
              yAxisThickness={0}
              xAxisThickness={0}
              hideRules
              yAxisTextStyle={{ color: theme.secondaryText, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
            />
          </ErrorBoundary>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.income }]} />
          <Text style={[styles.legendText, { color: theme.secondaryText }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.expense }]} />
          <Text style={[styles.legendText, { color: theme.secondaryText }]}>Expense</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { flex: 1, paddingHorizontal: 12 },
  period:      { fontSize: 12, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  strip: {
    flexDirection: 'row', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 16,
  },
  stripCol:     { flex: 1, paddingVertical: 14, alignItems: 'center' },
  stripLabel:   { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  stripVal:     { fontSize: 15, fontWeight: '800' },
  stripDivider: { width: StyleSheet.hairlineWidth },
  chartCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    padding: 16, alignItems: 'center',
  },
  empty:   { fontSize: 13, paddingVertical: 40, textAlign: 'center' },
  legend:  { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
});
