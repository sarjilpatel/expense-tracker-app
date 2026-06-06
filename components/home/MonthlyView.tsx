import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Currency } from '@/constants/theme';
import { MONTHS_SHORT } from '@/constants/maps';

interface Props {
  transactions: any[];
  summary?: { income: number; expense: number; balance: number };
  year: number;
  theme: any;
  t: (key: string) => string;
}

const fmtDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

function getWeeksForMonth(year: number, monthIdx: number): Array<{ start: Date; end: Date }> {
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay  = new Date(year, monthIdx + 1, 0);

  // Walk forward to the first Sunday on or after the 1st of the month
  const cur = new Date(firstDay);
  while (cur.getDay() !== 0) cur.setDate(cur.getDate() + 1);

  const weeks: Array<{ start: Date; end: Date }> = [];
  // Only include weeks whose Sunday falls within this month
  while (cur <= lastDay) {
    const start = new Date(cur);
    const end   = new Date(cur);
    end.setDate(end.getDate() + 6);
    weeks.push({ start, end });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function weekTotals(transactions: any[], start: Date, end: Date) {
  const endDay = new Date(end); endDay.setHours(23, 59, 59, 999);
  let income = 0, expense = 0;
  for (const tx of transactions) {
    const d = new Date(tx.date || tx.createdAt);
    if (d >= start && d <= endDay) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
  }
  return { income, expense, balance: income - expense };
}

function isCurWeek(start: Date, end: Date): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endDay = new Date(end); endDay.setHours(23, 59, 59, 999);
  return today >= start && today <= endDay;
}

export function MonthlyView({ transactions, year, theme }: Props) {
  const today         = new Date();
  const isCurrentYear = year === today.getFullYear();
  const currMonthIdx  = today.getMonth();

  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) =>
    setOverrides(p => ({ ...p, [idx]: !(p[idx] ?? (isCurrentYear && idx === currMonthIdx)) }));

  const isExpanded = (idx: number): boolean =>
    overrides[idx] ?? (isCurrentYear && idx === currMonthIdx);

  // Per-month income/expense
  const monthlyData = useMemo(() => {
    const m: Record<number, { income: number; expense: number }> = {};
    for (let i = 0; i < 12; i++) m[i] = { income: 0, expense: 0 };
    for (const tx of transactions) {
      const d = new Date(tx.date || tx.createdAt);
      if (d.getFullYear() !== year) continue;
      const mi = d.getMonth();
      if (tx.type === 'income') m[mi].income += tx.amount;
      else m[mi].expense += tx.amount;
    }
    return m;
  }, [transactions, year]);

  // Show months from current (or Dec) down to Jan
  const maxIdx       = isCurrentYear ? currMonthIdx : 11;
  const monthIndices = Array.from({ length: maxIdx + 1 }, (_, i) => maxIdx - i);

  const div = theme.border;

  return (
    <View>
      {monthIndices.map(mIdx => {
        const { income, expense } = monthlyData[mIdx];
        const balance  = income - expense;
        const expanded = isExpanded(mIdx);
        const weeks    = expanded ? getWeeksForMonth(year, mIdx) : [];

        // Compute date range for subtitle
        const monthTxs = transactions.filter(tx => {
          const d = new Date(tx.date || tx.createdAt);
          return d.getFullYear() === year && d.getMonth() === mIdx;
        });
        let rangeStrSubtitle = '';
        if (monthTxs.length > 0) {
          const dates = monthTxs.map(tx => new Date(tx.date || tx.createdAt).getTime());
          const minD = new Date(Math.min(...dates));
          const maxD = new Date(Math.max(...dates));
          rangeStrSubtitle = `${minD.getMonth() + 1}.${minD.getDate()} ~ ${maxD.getMonth() + 1}.${maxD.getDate()}`;
        } else {
          const lastDay = new Date(year, mIdx + 1, 0).getDate();
          rangeStrSubtitle = `${mIdx + 1}.1 ~ ${mIdx + 1}.${lastDay}`;
        }

        return (
          <View key={mIdx} style={[styles.monthBlock, { borderBottomColor: div }]}>

            {/* ── Month header row ── */}
            <TouchableOpacity
              onPress={() => toggle(mIdx)}
              activeOpacity={0.65}
              style={styles.row}
            >
              {/* Left: month name + subtitle */}
              <View style={styles.colLeft}>
                <Text style={[styles.monthName, { color: theme.text }]}>
                  {MONTHS_SHORT[mIdx]}
                </Text>
                <Text style={[styles.monthSubtitle, { color: theme.secondaryText }]}>
                  {rangeStrSubtitle}
                </Text>
              </View>

              {/* Center: income */}
              <Text style={[styles.incomeAmt, { color: theme.income }]}>
                {Currency.format(income)}
              </Text>

              {/* Right: expense + balance stacked */}
              <View style={styles.colRight}>
                <Text style={[styles.expenseAmt, { color: theme.expense }]}>
                  {Currency.format(expense)}
                </Text>
                <Text style={[styles.balanceAmt, { color: theme.text }]}>
                  {Currency.format(balance)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* ── Weekly breakdown rows ── */}
            {expanded && weeks.map(w => {
              const wt       = weekTotals(transactions, w.start, w.end);
              const isCur    = isCurWeek(w.start, w.end);
              const rangeStr = `${fmtDay(w.start)} ~ ${fmtDay(w.end)}`;

              return (
                <View
                  key={rangeStr}
                  style={[
                    styles.weekRow,
                    isCur && styles.curWeekBg,
                  ]}
                >
                  {/* Left: date range */}
                  <View style={styles.colLeft}>
                    <Text style={[
                      styles.weekRange,
                      { color: isCur ? '#eb5757' : theme.secondaryText },
                    ]}>
                      {rangeStr}
                    </Text>
                  </View>

                  {/* Center: income */}
                  <Text style={[styles.wkIncomeAmt, {
                    color: theme.income,
                  }]}>
                    {Currency.format(wt.income)}
                  </Text>

                  {/* Right: expense + balance */}
                  <View style={styles.colRight}>
                    <Text style={[styles.wkExpenseAmt, {
                      color: theme.expense,
                    }]}>
                      {Currency.format(wt.expense)}
                    </Text>
                    <Text style={[styles.wkBalanceAmt, {
                      color: theme.secondaryText,
                    }]}>
                      {isCur ? `Total ${Currency.format(wt.balance)}` : Currency.format(wt.balance)}
                    </Text>
                  </View>
                </View>
              );
            })}

          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  monthBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Month header
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  colLeft: {
    flex: 2.5,
  },
  colRight: {
    flex:        3,
    alignItems:  'flex-end',
  },
  monthName: {
    fontSize:   18,
    fontWeight: '700',
  },
  monthSubtitle: {
    fontSize:   11,
    marginTop:  2,
  },
  incomeAmt: {
    flex:       3,
    fontSize:   14,
    fontWeight: '600',
    textAlign:  'right',
    paddingRight: 16,
  },
  expenseAmt: {
    fontSize:   14,
    fontWeight: '600',
  },
  balanceAmt: {
    fontSize:   11,
    fontWeight: '600',
    marginTop:  2,
  },

  // Week rows
  weekRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   12,
    paddingLeft:       24,
  },
  curWeekBg: {
    backgroundColor: '#2d1a1c',
  },
  weekRange: {
    fontSize:   13,
    fontWeight: '500',
  },
  wkIncomeAmt: {
    flex:       3,
    fontSize:   13,
    fontWeight: '600',
    textAlign:  'right',
    paddingRight: 16,
  },
  wkExpenseAmt: {
    fontSize:   13,
    fontWeight: '600',
  },
  wkBalanceAmt: {
    fontSize:   10,
    fontWeight: '500',
    marginTop:  2,
  },
});
