import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { CATEGORY_ICONS, CHART_COLORS } from '@/constants/maps';

interface Summary { income: number; expense: number; balance: number; }

interface Props {
  transactions: any[];
  summary: Summary;
  theme: any;
  t: (key: string) => string;
}

export function MonthlyView({ transactions, summary, theme, t }: Props) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');

  const categoryData = useMemo(() => {
    const m: Record<string, { amount: number; count: number }> = {};
    const filtered = transactions.filter((tx: any) => tx.type === tab);
    const total = filtered.reduce((s: number, tx: any) => s + tx.amount, 0);
    filtered.forEach((tx: any) => {
      if (!m[tx.category]) m[tx.category] = { amount: 0, count: 0 };
      m[tx.category].amount += tx.amount;
      m[tx.category].count++;
    });
    return Object.entries(m)
      .map(([cat, d], i) => ({
        category: cat,
        amount: d.amount,
        count: d.count,
        pct: total > 0 ? (d.amount / total) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, tab]);

  return (
    <View>
      <View style={[styles.tabWrap, { backgroundColor: 'rgba(150,150,150,0.08)' }]}>
        {(['expense', 'income'] as const).map(k => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={[styles.tab, tab === k && { backgroundColor: k === 'expense' ? theme.expense : theme.income }]}
          >
            <Text style={[styles.tabText, { color: tab === k ? '#FFF' : theme.secondaryText }]}>
              {k === 'expense' ? 'Expenses' : 'Income'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: theme.secondaryText }]}>
          Total {tab === 'expense' ? 'Spent' : 'Earned'}
        </Text>
        <Text style={[styles.totalVal, { color: tab === 'expense' ? theme.expense : theme.income }]}>
          {Currency.format(tab === 'expense' ? summary.expense : summary.income)}
        </Text>
      </View>

      {categoryData.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={40} color={theme.secondaryText} style={{ opacity: 0.2, marginBottom: 8 }} />
          <Text style={{ color: theme.secondaryText, fontSize: 13, opacity: 0.5 }}>No {tab} this month</Text>
        </View>
      ) : (
        categoryData.map((item, i) => (
          <Animated.View key={item.category} entering={FadeInDown.delay(i * 40).duration(250)} style={styles.catItem}>
            <View style={styles.catRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.catIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={(CATEGORY_ICONS[item.category] || 'receipt-outline') as any} size={16} color={item.color} />
                </View>
                <View>
                  <Text style={[styles.catName, { color: theme.text }]}>{t(item.category)}</Text>
                  <Text style={[styles.catCount, { color: theme.secondaryText }]}>
                    {item.count} transaction{item.count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.catAmount, { color: item.color }]}>{Currency.format(item.amount)}</Text>
                <Text style={[styles.catPct, { color: theme.secondaryText }]}>{Math.round(item.pct)}%</Text>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: `${item.color}18` }]}>
              <View style={[styles.fill, { backgroundColor: item.color, width: `${item.pct}%` as any }]} />
            </View>
          </Animated.View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    marginBottom: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalVal: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  catItem: {
    marginBottom: 14,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
  },
  catCount: {
    fontSize: 10,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  catPct: {
    fontSize: 10,
    fontWeight: '600',
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
