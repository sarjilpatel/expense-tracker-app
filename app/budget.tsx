import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getEffectiveBudgets, deleteBudget, getAllTransactions, getPrevMonthCarryForward } from '@/src/services/dataService';
import { getPeriodRange, getCalendarMonthsForPeriod, filterByPeriod } from '@/src/utils/dateUtils';
import { CATEGORY_EMOJIS } from '@/constants/maps';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Touchable, Amount, EmptyState, Skeleton } from '@/components/ui';

import { reportError } from '@/src/utils/log';
export default function BudgetScreen() {
  const { theme } = useTheme();
  const { prefs } = usePreferences();

  const [budgets, setBudgets]           = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [carryForward, setCarryForward] = useState(0);
  const loaded = useRef(false);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const monthlyStart = prefs.monthlyStart;
      let txData: any[];
      if (monthlyStart > 1) {
        const months = getCalendarMonthsForPeriod(month, year, monthlyStart);
        const results = await Promise.all(months.map(m => getAllTransactions(m.month, m.year)));
        const combined = (results as any[][]).flat();
        const { start, end } = getPeriodRange(month, year, monthlyStart);
        txData = filterByPeriod(combined, start, end);
      } else {
        txData = await getAllTransactions(month, year);
      }
      const [budgetData, cf] = await Promise.all([
        getEffectiveBudgets(month, year),
        getPrevMonthCarryForward(month, year),
      ]);
      setBudgets(budgetData || []);
      setTransactions(txData || []);
      setCarryForward(cf);
      loaded.current = true;
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, prefs.monthlyStart]);

  // Skeleton on the first load only; a return to the screen refreshes silently (W2-13).
  useFocusRefresh(useCallback(() => { if (!loaded.current) setLoading(true); fetchData(); }, [fetchData]));

  const getSpent = (category: string | null) =>
    transactions
      .filter(tx => tx.type === 'expense' && (category === null || tx.category === category))
      .reduce((s, tx) => s + tx.amount, 0);

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

  const addButton = (
    <Touchable onPress={() => router.push('/add-budget')} size={36} style={S.headerBtn} accessibilityLabel="Add budget" rippleBorderless>
      <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
    </Touchable>
  );

  if (loading) {
    return (
      <Screen title="Budget" right={addButton}>
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={120} round={radius.lg} />
          <Skeleton.Block height={120} round={radius.lg} />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="Budget" right={addButton}>
      <Card tone="alt" style={{ marginTop: space.sm }}>
        <View style={S.banner}>
          <Ionicons name="information-circle-outline" size={iconSize.sm} color={theme.secondaryText} />
          <Text style={[type.label, { color: theme.secondaryText, flex: 1 }]}>
            Budget progress also shows on the Home tab, in the Total view.
          </Text>
        </View>
      </Card>

      {budgets.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No budgets yet"
          body="Set a monthly limit to track your spending and get alerts before you overspend."
          action={{ label: 'Add first budget', onPress: () => router.push('/add-budget') }}
        />
      ) : (
        <View style={S.list}>
          {budgets.map(item => {
            const isMain = !item.category;
            const effective = isMain && carryForward > 0 ? item.amount + carryForward : item.amount;
            const spent  = getSpent(item.category);
            const pct    = effective > 0 ? Math.min((spent / effective) * 100, 100) : 0;
            const isOver = spent > effective;
            const label  = item.category ?? 'Monthly total';
            const emoji  = item.category ? (CATEGORY_EMOJIS[item.category] ?? '🏷️') : '📊';
            return (
              <Card key={item._id}>
                <View style={S.cardTop}>
                  <Text style={S.emoji}>{emoji}</Text>
                  <Text style={[type.bodyStrong, { color: theme.text, flex: 1 }]} numberOfLines={1}>{label}</Text>
                  <Amount value={effective} />
                  <Touchable
                    onPress={() => router.push({ pathname: '/add-budget', params: { category: item.category ?? '__monthly_total__', amount: String(item.amount), month: String(item.month), year: String(item.year) } })}
                    size={28}
                    style={S.trash}
                    accessibilityLabel={`Edit ${label} budget`}
                    rippleBorderless
                  >
                    <Ionicons name="create-outline" size={iconSize.sm} color={theme.tint} />
                  </Touchable>
                  <Touchable onPress={() => handleDelete(item._id)} size={28} style={S.trash} accessibilityLabel={`Delete ${label} budget`} rippleBorderless>
                    <Ionicons name="trash-outline" size={iconSize.sm} color={theme.secondaryText} />
                  </Touchable>
                </View>

                <View
                  style={[S.track, { backgroundColor: theme.border }]}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
                >
                  <View style={[S.fill, { width: `${pct}%`, backgroundColor: isOver ? theme.expense : theme.tint }]} />
                </View>

                {isMain && carryForward > 0 && (
                  <View style={[S.carry, { backgroundColor: hexToRGBA(theme.income, 0.1) }]}>
                    <Ionicons name="arrow-forward-circle-outline" size={iconSize.sm} color={theme.income} />
                    <Text style={[type.label, { color: theme.income, flex: 1 }]}>
                      Carried forward from last month
                    </Text>
                    <Amount value={carryForward} kind="income" role="label" />
                  </View>
                )}

                <View style={S.cardBottom}>
                  <View style={S.stat}>
                    <Text style={[type.label, { color: theme.secondaryText }]}>Spent</Text>
                    <Amount value={spent} kind="expense" unsigned />
                  </View>
                  <View style={[S.stat, { alignItems: 'flex-end' }]}>
                    <Text style={[type.label, { color: theme.secondaryText }]}>{isOver ? 'Over by' : 'Left'}</Text>
                    <Amount value={Math.abs(effective - spent)} kind={isOver ? 'expense' : 'income'} unsigned />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

    </Screen>
  );
}

const S = StyleSheet.create({
  headerBtn:  { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  banner:     { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list:       { gap: space.md, marginTop: space.lg },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emoji:      { ...type.title },
  trash:      { width: 28, height: 28, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  track:      { height: 8, borderRadius: radius.full, overflow: 'hidden', marginTop: space.md },
  fill:       { height: '100%', borderRadius: radius.full },
  carry:      { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, marginTop: space.md },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  stat:       { gap: 2 },
});
