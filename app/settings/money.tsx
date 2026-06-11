import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { getBudgets, getCurrentGroup as getCategoryData } from '@/src/services/dataService';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';

function Row({
  icon, iconBg, iconColor, title, sub, right, onPress,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void;
}) {
  const { theme } = useTheme();
  const content = (
    <View style={S.row}>
      <View style={[S.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={S.rowMid}>
        <Text style={[S.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub ? <Text style={[S.rowSub, { color: theme.secondaryText }]}>{sub}</Text> : null}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          : null}
    </View>
  );
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>;
}

function Sep() {
  const { theme } = useTheme();
  return <View style={[S.sep, { backgroundColor: theme.separator }]} />;
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

export default function MoneyScreen() {
  const { theme }        = useTheme();
  const { prefs }        = usePreferences();
  const { top }          = useSafeAreaInsets();

  const [budget,        setBudget]        = useState<any>(null);
  const [incomeCount,   setIncomeCount]   = useState(0);
  const [expenseCount,  setExpenseCount]  = useState(0);
  const [loading,       setLoading]       = useState(true);

  const currencyMeta = CURRENCY_META[prefs.currency as CurrencyCode];

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const [budgets, groupData] = await Promise.all([
          getBudgets(now.getMonth() + 1, now.getFullYear()),
          getCategoryData(),
        ]);
        const main = (budgets as any[])?.find((b: any) => !b.category) ?? null;
        setBudget(main);
        const cats = (groupData as any)?.categories ?? [];
        setIncomeCount((cats as any[]).filter((c: any) => c.type === 'income').length);
        setExpenseCount((cats as any[]).filter((c: any) => c.type === 'expense' || !c.type).length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []));

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={16}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: theme.text }]}>Money</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={S.loadingWrap}>
          <ActivityIndicator color={theme.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          <Text style={[S.groupLabel, { color: theme.secondaryText }]}>BUDGETS & GOALS</Text>
          <Card>
            <Row
              icon="wallet-outline" iconBg="#10B981" iconColor="#FFF"
              title="Monthly Budget"
              sub={budget ? `${currencyMeta?.symbol ?? '₹'} ${budget.amount.toLocaleString('en-IN')}/month` : 'Not set'}
              onPress={() => router.push('/budget')}
            />
            <Sep />
            <Row
              icon="flag-outline" iconBg="#10B98118" iconColor="#10B981"
              title="Savings Goals"
              sub="Track progress toward your goals"
              onPress={() => router.push('/goals')}
            />
            <Sep />
            <Row
              icon="git-branch-outline" iconBg="#10B98118" iconColor="#10B981"
              title="Expense Splits"
              sub="Split bills with group members"
              onPress={() => router.push('/splits')}
            />
          </Card>

          <Text style={[S.groupLabel, { color: theme.secondaryText }]}>CATEGORIES</Text>
          <View style={S.catGrid}>
            <TouchableOpacity
              style={[S.catCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'income' } })}
              activeOpacity={0.7}
            >
              <View style={[S.catIcon, { backgroundColor: theme.income }]}>
                <Ionicons name="arrow-down-outline" size={18} color={theme.incomeText} />
              </View>
              <Text style={[S.catTitle, { color: theme.income }]}>Income</Text>
              <Text style={[S.catCount, { color: theme.secondaryText }]}>
                {incomeCount} {incomeCount === 1 ? 'category' : 'categories'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.catCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'expense' } })}
              activeOpacity={0.7}
            >
              <View style={[S.catIcon, { backgroundColor: theme.expense }]}>
                <Ionicons name="arrow-up-outline" size={18} color={theme.expenseText} />
              </View>
              <Text style={[S.catTitle, { color: theme.expense }]}>Expenses</Text>
              <Text style={[S.catCount, { color: theme.secondaryText }]}>
                {expenseCount} {expenseCount === 1 ? 'category' : 'categories'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, height: 44,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll:      { paddingHorizontal: 12, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  groupLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 20, paddingLeft: 4,
  },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep:  { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowMid:  { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },

  catGrid: { flexDirection: 'row', gap: 10 },
  catCard: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  catIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  catTitle:{ fontSize: 13, fontWeight: '800' },
  catCount:{ fontSize: 11 },
});
