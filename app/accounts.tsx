import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getContrastText } from '@/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { Account, ACCOUNT_TYPE_META, computeAccountBalance } from '@/src/services/accountService';
import { getAllTransactions, getAccounts, getTxAccountMap } from '@/src/services/dataService';
import { getCachedTransactions, setCachedTransactions } from '@/src/cache/transactionCache';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, Touchable, Amount, EmptyState, SectionHeader, Skeleton } from '@/components/ui';

export default function AccountsScreen() {
  const { theme } = useTheme();

  const [accounts, setAccounts]             = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [txAccountMap, setTxAccountMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const loaded = useRef(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    // Skeleton only before the first load; a return to the tab refreshes silently (W2-13).
    if (!forceRefresh && !loaded.current) setLoading(true);
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
        const raw = await getAllTransactions();
        const fresh: any[] = Array.isArray(raw) ? raw : [];
        await setCachedTransactions(fresh);
        setAllTransactions(fresh);
      }
      loaded.current = true;
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

  const totalAssets      = useMemo(() => accountsWithBalance.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0), [accountsWithBalance]);
  const totalLiabilities = useMemo(() => accountsWithBalance.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0), [accountsWithBalance]);
  const netWorth = totalAssets - totalLiabilities;

  const headerRight = (
    <View style={S.headerActions}>
      <Touchable onPress={() => router.push('/add-transfer')} size={36} style={S.headerBtn} accessibilityLabel="Transfer between accounts" rippleBorderless>
        <Ionicons name="swap-horizontal-outline" size={iconSize.md} color={theme.text} />
      </Touchable>
      <Touchable onPress={() => router.push('/add-account')} size={36} style={S.headerBtn} accessibilityLabel="Add account" rippleBorderless>
        <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
      </Touchable>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <Screen title="Accounts" right={headerRight}>
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={140} round={radius.lg} />
          <Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="Accounts" right={headerRight} refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }}>
      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No accounts yet"
          body="Add your bank accounts, wallets and credit cards to track balances and link transactions."
          action={{ label: 'Add first account', onPress: () => router.push('/add-account') }}
        />
      ) : (
        <>
          <Card style={{ marginTop: space.sm }}>
            <Text style={[type.overline, { color: theme.secondaryText }]}>Net worth</Text>
            <Amount value={netWorth} role="display" kind={netWorth < 0 ? 'expense' : 'neutral'} unsigned={netWorth >= 0} style={{ marginTop: space.xs }} />
            <View style={[S.netRow, { borderTopColor: theme.separator }]}>
              <View style={S.netCol}>
                <Text style={[type.label, { color: theme.secondaryText }]}>Assets</Text>
                <Amount value={totalAssets} kind="income" unsigned />
              </View>
              <View style={S.netCol}>
                <Text style={[type.label, { color: theme.secondaryText }]}>Liabilities</Text>
                <Amount value={totalLiabilities} kind="expense" unsigned />
              </View>
            </View>
          </Card>

          <SectionHeader title="My accounts" count={accounts.length} />
          <Card padded={false}>
            {accountsWithBalance.map((acc, i) => {
              const meta = ACCOUNT_TYPE_META[acc.type];
              return (
                <Row
                  key={acc.id}
                  icon={meta.icon as any}
                  iconBg={acc.color}
                  iconColor={getContrastText(acc.color)}
                  title={acc.name}
                  subtitle={`${meta.label}${acc.txCount > 0 ? ` · ${acc.txCount} transactions` : ''}`}
                  right={<Amount value={acc.balance} kind={acc.balance < 0 ? 'expense' : 'neutral'} unsigned={acc.balance >= 0} />}
                  chevron
                  onPress={() => router.push({ pathname: '/account-detail', params: { id: acc.id } })}
                  last={i === accountsWithBalance.length - 1}
                />
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: space.xs },
  headerBtn:     { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  netRow:        { flexDirection: 'row', marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  netCol:        { flex: 1, gap: 2 },
});
