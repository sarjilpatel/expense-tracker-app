import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import {
  Account, ACCOUNT_TYPE_META,
  getAccounts, getTxAccountMap, computeAccountBalance,
} from '@/src/services/accountService';
import { getTransactions, getTrend } from '@/src/services/dataService';
import { getCachedTransactions, setCachedTransactions } from '@/src/cache/transactionCache';
import { BarChart } from 'react-native-gifted-charts';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AccountsScreen() {
  const { theme } = useTheme();
  const { formatAmount } = usePreferences();
  const { top } = useSafeAreaInsets();

  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [txAccountMap, setTxAccountMap]   = useState<Record<string, string>>({});
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [trendData, setTrendData]         = useState<any[]>([]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    try {
      const [accs, map] = await Promise.all([getAccounts(), getTxAccountMap()]);
      setAccounts(accs);
      setTxAccountMap(map);

      // On regular focus: serve from cache to avoid fetching all-time transactions.
      // On pull-to-refresh: fetch fresh data from API.
      const cached = await getCachedTransactions();
      if (!forceRefresh && cached) {
        setAllTransactions(cached);
      } else {
        const raw = await getTransactions();
        const fresh: any[] = Array.isArray(raw) ? raw : [];
        await setCachedTransactions(fresh);
        setAllTransactions(fresh);
      }

      // Load 12-month trend — monthly net, latest first
      getTrend(12).then((raw: any) => {
        const months: any[] = Array.isArray(raw) ? raw : [];
        const points = [...months].reverse().map((m: any) => ({
          value: (m.income || 0) - (m.expense || 0),
          label: `${m.monthLabel}\n'${String(m.year).slice(-2)}`,
        }));
        setTrendData(points);
      }).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Derived ───────────────────────────────────────────────────────────────
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => ({
      ...acc,
      balance: computeAccountBalance(acc, allTransactions, txAccountMap),
      txCount: Object.values(txAccountMap).filter(id => id === acc.id).length,
    })),
  [accounts, allTransactions, txAccountMap]);

  const totalAssets = useMemo(() =>
    accountsWithBalance.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0),
  [accountsWithBalance]);

  const totalLiabilities = useMemo(() =>
    accountsWithBalance.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0),
  [accountsWithBalance]);

  const netWorth = totalAssets - totalLiabilities;

  // Group by positive/negative balance
  const assetAccounts    = accountsWithBalance.filter(a => a.type !== 'credit_card' || a.balance >= 0);
  const liabilityAccounts = accountsWithBalance.filter(a => a.type === 'credit_card' && a.balance < 0);

  return (
    <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>

      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Accounts</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => router.push('/add-transfer')}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color={theme.tint} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/add-account')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={theme.tintText} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={{ paddingTop: 12 }}>
          <SkeletonLoader type="card" />
          <SkeletonLoader rows={4} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={theme.tint} />}
        >

          {accounts.length === 0 ? (
            /* ── Empty state ── */
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.tint }]}>
                <Ionicons name="wallet-outline" size={40} color={theme.tintText} />
              </View>
              <ThemedText style={styles.emptyTitle}>No accounts yet</ThemedText>
              <Text style={[styles.emptyBody, { color: theme.secondaryText }]}>
                Add your bank accounts, wallets and credit cards to track balances and link transactions.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: theme.tint }]}
                onPress={() => router.push('/add-account')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={theme.tintText} />
                <Text style={[styles.emptyBtnText, { color: theme.tintText }]}>Add First Account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── Net Worth Card ── */}
              <Animated.View entering={FadeInDown.duration(280)} style={[styles.netCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.netLabel, { color: theme.secondaryText }]}>NET WORTH</Text>
                <Text style={[styles.netAmt, { color: netWorth >= 0 ? theme.income : theme.expense }]}>
                  {formatAmount(netWorth)}
                </Text>
                <View style={[styles.netDivider, { backgroundColor: theme.border }]} />
                <View style={styles.netRow}>
                  <View style={styles.netCol}>
                    <Text style={[styles.netColLabel, { color: theme.secondaryText }]}>Assets</Text>
                    <Text style={[styles.netColVal, { color: theme.income }]}>{formatAmount(totalAssets)}</Text>
                  </View>
                  <View style={[styles.netColDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.netCol}>
                    <Text style={[styles.netColLabel, { color: theme.secondaryText }]}>Liabilities</Text>
                    <Text style={[styles.netColVal, { color: theme.expense }]}>{formatAmount(totalLiabilities)}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* ── Net worth trend chart ── */}
              {trendData.length > 1 && (
                <Animated.View entering={FadeInDown.delay(60).duration(280)}
                  style={[styles.trendCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.netLabel, { color: theme.secondaryText, marginBottom: 12 }]}>MONTHLY NET (12 MONTHS)</Text>
                  <ErrorBoundary fallback={null}>
                    {(() => {
                      const absVals = trendData.map((p: any) => Math.abs(p.value)).sort((a: number, b: number) => a - b);
                      const median  = absVals[Math.floor(absVals.length / 2)] || 1000;
                      const cap     = Math.max(median * 3, 1000);
                      const bw      = Math.floor((Dimensions.get('window').width - 128) / trendData.length) - 2;
                      return (
                        <BarChart
                          data={trendData.map((p: any) => ({
                            value: Math.max(Math.min(p.value, cap), -cap),
                            label: p.label,
                            frontColor: p.value >= 0 ? theme.income : theme.expense,
                          }))}
                          width={Dimensions.get('window').width - 96}
                          height={130}
                          barWidth={bw > 4 ? bw : 14}
                          maxValue={cap}
                          mostNegativeValue={-cap}
                          noOfSections={3}
                          barBorderRadius={4}
                          yAxisThickness={0}
                          xAxisThickness={StyleSheet.hairlineWidth}
                          xAxisColor={theme.border}
                          hideRules
                          showLine={false}
                          yAxisTextStyle={{ color: theme.secondaryText, fontSize: 8 }}
                          xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 8 }}
                        />
                      );
                    })()}
                  </ErrorBoundary>
                </Animated.View>
              )}

              {/* ── Accounts list ── */}
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>
                MY ACCOUNTS · {accounts.length}
              </Text>

              <View style={[styles.accountsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {accountsWithBalance.map((acc, i) => {
                  const meta = ACCOUNT_TYPE_META[acc.type];
                  const isLast = i === accountsWithBalance.length - 1;
                  return (
                    <Animated.View key={acc.id} entering={FadeInDown.delay(i * 50).duration(260)}>
                      <TouchableOpacity
                        style={[
                          styles.accountRow,
                          {
                            borderBottomColor: theme.border,
                            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                          }
                        ]}
                        onPress={() => router.push({ pathname: '/account-detail', params: { id: acc.id } })}
                        activeOpacity={0.65}
                      >
                        {/* Left: icon */}
                        <View style={[styles.accIcon, { backgroundColor: acc.color }]}>
                          <Ionicons name={meta.icon as any} size={22} color='#FFF' />
                        </View>

                        {/* Middle: name + type + tx count */}
                        <View style={styles.accMid}>
                          <Text style={[styles.accName, { color: theme.text }]}>{acc.name}</Text>
                          <Text style={[styles.accType, { color: theme.secondaryText }]}>
                            {meta.label}{acc.txCount > 0 ? ` · ${acc.txCount} transactions` : ''}
                          </Text>
                        </View>

                        {/* Right: balance + chevron */}
                        <View style={styles.accRight}>
                          <Text style={[styles.accBalance, { color: acc.balance >= 0 ? theme.text : theme.expense }]}>
                            {formatAmount(acc.balance)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} style={{ marginTop: 2 }} />
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Tip */}
              <View style={[styles.tip, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                <Ionicons name="information-circle-outline" size={16} color={theme.tint} />
                <Text style={[styles.tipText, { color: theme.secondaryText }]}>
                  Long-press a transaction on the home screen to link it to an account.
                  Or select an account when adding a new transaction.
                </Text>
              </View>
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, marginBottom: 12,
  },
  title:         { fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn:     { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingBottom: 120 },

  // Net worth
  netCard: {
    marginHorizontal: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: 20, marginBottom: 12,
  },
  netLabel:      { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  netAmt:        { fontSize: 28, fontWeight: '900', marginBottom: 16 },
  netDivider:    { height: StyleSheet.hairlineWidth, marginBottom: 16 },
  netRow:        { flexDirection: 'row' },
  netCol:        { flex: 1 },
  netColLabel:   { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  netColVal:     { fontSize: 15, fontWeight: '800' },
  netColDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  trendCard: {
    marginHorizontal: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: 16, marginBottom: 12,
  },

  // Section
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    marginBottom: 6, marginTop: 12, paddingHorizontal: 12,
  },

  // Account rows — full width, no horizontal margin
  accountsCard: {
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  accIcon:    { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  accMid:     { flex: 1, marginLeft: 12 },
  accName:    { fontSize: 15, fontWeight: '600' },
  accType:    { fontSize: 12, marginTop: 2 },
  accRight:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accBalance: { fontSize: 15, fontWeight: '800' },

  // Tip
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 12, marginTop: 12, borderRadius: 14, padding: 14,
  },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle:{ fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
  emptyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
