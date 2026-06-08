import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getBudgets, deleteBudget, getTransactions, getPrevMonthCarryForward } from '@/src/services/dataService';
import { getPeriodRange, getCalendarMonthsForPeriod, filterByPeriod } from '@/src/utils/dateUtils';
import { CATEGORY_EMOJIS } from '@/constants/maps';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { TYPE_SCALE } from '@/constants/theme';

export default function BudgetScreen() {
  const { theme } = useTheme();
  const { prefs, formatAmount } = usePreferences();
  const { top } = useSafeAreaInsets();

  const [budgets, setBudgets]           = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [carryForward, setCarryForward] = useState(0);

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

      const [budgetData, cf] = await Promise.all([
        getBudgets(month, year),
        getPrevMonthCarryForward(month, year),
      ]);
      setBudgets(budgetData || []);
      setTransactions(txData || []);
      setCarryForward(cf);
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
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: top + 8 }]}>

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
          <Ionicons name="wallet-outline" size={20} color={theme.expenseText} />
        </View>
        <Text style={[styles.bannerText, { color: theme.secondaryText }]}>
          You can check out the budget status in{' '}
          <Text style={{ color: theme.text, fontWeight: '700' }}>Records tab › Total page.</Text>
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonLoader rows={4} />
        </View>
      ) : budgets.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="wallet-outline" size={40} color={theme.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No budgets yet</Text>
          <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
            Set a monthly limit to track your spending and get alerts before you overspend.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/add-budget')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.tintText} />
            <Text style={[styles.emptyBtnText, { color: theme.tintText }]}>Add First Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          renderItem={({ item }) => {
            const isMain = !item.category;
            const effectiveBudget = isMain && carryForward > 0 ? item.amount + carryForward : item.amount;
            const spent  = getSpent(item.category);
            const pct    = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0;
            const isOver = spent > effectiveBudget;
            const label  = item.category ?? 'Monthly Total';
            const emoji  = item.category ? (CATEGORY_EMOJIS[item.category] ?? '🏷️') : '📊';

            return (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardEmoji}>{emoji}</Text>
                    <Text style={[styles.cardLabel, { color: theme.text }]}>{label}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.cardLimit, { color: theme.text }]}>
                      {formatAmount(effectiveBudget)}
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

                {isMain && carryForward > 0 && (
                  <View style={[styles.carryRow, { backgroundColor: theme.income + '18' }]}>
                    <Ionicons name="arrow-forward-circle-outline" size={13} color={theme.income} />
                    <Text style={[styles.carryText, { color: theme.income }]}>
                      +{formatAmount(carryForward)} carried forward from last month
                    </Text>
                  </View>
                )}

                <View style={styles.cardBottom}>
                  <Text style={[styles.spentLabel, { color: theme.secondaryText }]}>
                    Spent  {formatAmount(spent)}
                  </Text>
                  <Text style={[styles.remainLabel, { color: isOver ? theme.expense : theme.income }]}>
                    {isOver
                      ? `Over  ${formatAmount(spent - effectiveBudget)}`
                      : `Left  ${formatAmount(effectiveBudget - spent)}`}
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
  container: { flex: 1 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingBottom:     12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: TYPE_SCALE.screenTitle,
  iconBtn:     { width: 36, alignItems: 'center' },

  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 12,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bannerIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText:    { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 8,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  card: {
    padding:           16,
    borderRadius:      16,
    borderWidth:       1,
    marginHorizontal:  12,
    marginBottom:      12,
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
  carryRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  carryText: { fontSize: 11, fontWeight: '600', flex: 1 },
});
