import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getBudgets, deleteBudget, getTransactions } from '@/src/services/dataService';
import { getPeriodRange, getCalendarMonthsForPeriod, filterByPeriod } from '@/src/utils/dateUtils';
import { CATEGORY_EMOJIS } from '@/constants/maps';

export default function BudgetScreen() {
  const { theme } = useTheme();
  const { prefs, formatAmount } = usePreferences();

  const [budgets, setBudgets]           = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const monthlyStart = prefs.monthlyStart;
      let txData: any[];

      if (monthlyStart > 1) {
        const months = getCalendarMonthsForPeriod(month, year, monthlyStart);
        const results = await Promise.all(months.map(m => getTransactions(m.month, m.year)));
        const combined = (results as any[][]).flat();
        const { start, end } = getPeriodRange(month, year, monthlyStart);
        txData = filterByPeriod(combined, start, end);
      } else {
        txData = await getTransactions(month, year);
      }

      const budgetData = await getBudgets(month, year);
      setBudgets(budgetData || []);
      setTransactions(txData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, prefs.monthlyStart]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [fetchData]));

  const getSpent = (category: string | null) => {
    return transactions
      .filter(tx => tx.type === 'expense' && (category === null || tx.category === category))
      .reduce((s, tx) => s + tx.amount, 0);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Remove this budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteBudget(id); fetchData(); }
          catch { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Budget</Text>
        <TouchableOpacity onPress={() => router.push('/add-budget')} style={styles.iconBtn}>
          <Ionicons name="add" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={[styles.banner, { borderBottomColor: theme.border }]}>
        <View style={[styles.bannerIcon, { backgroundColor: theme.expense }]}>
          <Ionicons name="wallet-outline" size={20} color='#FFF' />
        </View>
        <Text style={[styles.bannerText, { color: theme.secondaryText }]}>
          You can check out the budget status in{' '}
          <Text style={{ color: theme.text, fontWeight: '700' }}>Trans. tab › Total page.</Text>
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={theme.tint} style={{ marginTop: 60 }} />
      ) : budgets.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcons}>
            <Ionicons name="bag-outline"                 size={60} color={theme.secondaryText} style={{ opacity: 0.35 }} />
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={theme.secondaryText} style={{ opacity: 0.35, marginLeft: -10, marginTop: -22 }} />
          </View>
          <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No data available.</Text>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const spent  = getSpent(item.category);
            const pct    = item.amount > 0 ? Math.min((spent / item.amount) * 100, 100) : 0;
            const isOver = spent > item.amount;
            const label  = item.category ?? 'Monthly Total';
            const emoji  = item.category ? (CATEGORY_EMOJIS[item.category] ?? '🏷️') : '📊';

            return (
              <View style={[styles.card, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardEmoji}>{emoji}</Text>
                    <Text style={[styles.cardLabel, { color: theme.text }]}>{label}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.cardLimit, { color: theme.text }]}>
                      {formatAmount(item.amount)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(item._id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={theme.secondaryText} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={[styles.track, { backgroundColor: `${theme.border}` }]}>
                  <View style={[
                    styles.fill,
                    { width: `${pct}%`, backgroundColor: isOver ? theme.expense : theme.tint },
                  ]} />
                </View>

                <View style={styles.cardBottom}>
                  <Text style={[styles.spentLabel, { color: theme.secondaryText }]}>
                    Spent  {formatAmount(spent)}
                  </Text>
                  <Text style={[styles.remainLabel, { color: isOver ? theme.expense : theme.income }]}>
                    {isOver
                      ? `Over  ${formatAmount(spent - item.amount)}`
                      : `Left  ${formatAmount(item.amount - spent)}`}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingBottom:     12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn:     { width: 36, alignItems: 'center' },

  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bannerIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  emptyIcons: { flexDirection: 'row', alignItems: 'flex-end' },
  emptyText:  { fontSize: 14 },

  card: {
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardEmoji: { fontSize: 22 },
  cardLabel: { fontSize: 15, fontWeight: '600' },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardLimit: { fontSize: 14, fontWeight: '600' },

  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },

  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between' },
  spentLabel:   { fontSize: 12 },
  remainLabel:  { fontSize: 12, fontWeight: '600' },
});
