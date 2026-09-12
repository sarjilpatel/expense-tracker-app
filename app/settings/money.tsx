import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { getBudgets, getCurrentGroup } from '@/src/services/dataService';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, SectionHeader, Skeleton } from '@/components/ui';
import { formatAmount } from '@/src/utils/money';

export default function MoneySettingsScreen() {
  const { theme } = useTheme();

  const [budget,       setBudget]       = useState<any>(null);
  const [incomeCount,  setIncomeCount]  = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [loading,      setLoading]      = useState(true);
  // Only the first load gets a skeleton; a refetch on focus is silent (W2-13).
  const loaded = useRef(false);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      if (!loaded.current) setLoading(true);
      try {
        const now = new Date();
        const [budgets, groupData] = await Promise.all([
          getBudgets(now.getMonth() + 1, now.getFullYear()),
          getCurrentGroup(),
        ]);
        setBudget((budgets as any[])?.find((b: any) => !b.category) ?? null);
        const cats = (groupData as any)?.categories ?? [];
        setIncomeCount((cats as any[]).filter((c: any) => c.type === 'income').length);
        setExpenseCount((cats as any[]).filter((c: any) => c.type === 'expense' || !c.type).length);
        loaded.current = true;
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []));

  if (loading) {
    return (
      <Screen title="Money">
        <Skeleton.Group style={{ paddingTop: space.lg }}>
          <Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  const count = (n: number) => `${n} ${n === 1 ? 'category' : 'categories'}`;

  return (
    <Screen title="Money">
      <SectionHeader title="Budgets & goals" />
      <Card padded={false}>
        <Row icon="wallet-outline" title="Monthly budget" subtitle={budget ? `${formatAmount(budget.amount)} / month` : 'Not set'} onPress={() => router.push('/budget')} />
        <Row icon="flag-outline" title="Savings goals" subtitle="Track progress toward your goals" onPress={() => router.push('/goals')} />
        <Row icon="airplane-outline" title="Trips & splits" subtitle="Split bills and see who owes whom" onPress={() => router.push('/trips' as any)} last />
      </Card>

      <SectionHeader title="Categories" />
      <View style={S.grid}>
        <Card onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'income' } })} accessibilityLabel={`Income, ${count(incomeCount)}`} style={S.tile}>
          <View style={[S.tileIcon, { backgroundColor: hexToRGBA(theme.income, 0.12) }]}>
            <Ionicons name="arrow-down-outline" size={iconSize.md} color={theme.income} />
          </View>
          <Text style={[type.bodyStrong, { color: theme.text }]}>Income</Text>
          <Text style={[type.label, { color: theme.secondaryText }]}>{count(incomeCount)}</Text>
        </Card>
        <Card onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'expense' } })} accessibilityLabel={`Expenses, ${count(expenseCount)}`} style={S.tile}>
          <View style={[S.tileIcon, { backgroundColor: hexToRGBA(theme.expense, 0.12) }]}>
            <Ionicons name="arrow-up-outline" size={iconSize.md} color={theme.expense} />
          </View>
          <Text style={[type.bodyStrong, { color: theme.text }]}>Expenses</Text>
          <Text style={[type.label, { color: theme.secondaryText }]}>{count(expenseCount)}</Text>
        </Card>
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  grid:     { flexDirection: 'row', gap: space.md },
  tile:     { flex: 1, gap: space.xs },
  tileIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: space.xs },
});
