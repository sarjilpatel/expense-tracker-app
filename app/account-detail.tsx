import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { TransactionRow } from '@/components/home/TransactionRow';
import { Account, ACCOUNT_TYPE_META, computeAccountBalance } from '@/src/services/accountService';
import { getAllTransactions, getAccounts, getTxAccountMap } from '@/src/services/dataService';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Touchable, Amount, EmptyState, SectionHeader, Skeleton } from '@/components/ui';

import { reportError } from '@/src/utils/log';
export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [account, setAccount]           = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txAccountMap, setTxAccountMap] = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [accounts, map] = await Promise.all([getAccounts(), getTxAccountMap()]);
      const acc = accounts.find(a => a.id === id);
      if (!acc) { router.back(); return; }
      setAccount(acc);
      setTxAccountMap(map);

      const forThis = (rows: any[]) => rows
        .filter((tx: any) => map[tx._id] === id)
        .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      const rawTx = await getAllTransactions();
      const allTx: any[] = Array.isArray(rawTx) ? rawTx : [];
      setTransactions(forThis(allTx));
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Only the first load shows a skeleton; coming back to the screen refreshes silently (W2-13).
  useFocusRefresh(useCallback(() => { loadData(!!account); }, [loadData, account]));

  const balance = useMemo(() => account ? computeAccountBalance(account, transactions, txAccountMap) : 0, [account, transactions, txAccountMap]);
  const income  = useMemo(() => transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0), [transactions]);

  if (loading && !account) {
    return (
      <Screen title="Account">
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={160} round={radius.lg} />
          <Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }
  if (!account) return null;

  const meta      = ACCOUNT_TYPE_META[account.type];
  const onAccount = getContrastText(account.color);
  const addTx     = () => router.push({ pathname: '/add-transaction', params: { prefillAccountId: account.id } });

  return (
    <Screen
      title={account.name}
      scroll
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); loadData(true); }}
      right={(
        <View style={S.headerActions}>
          <Touchable onPress={() => router.push({ pathname: '/add-account', params: { id: account.id } })} size={36} style={S.headerBtn} accessibilityLabel="Edit account" rippleBorderless>
            <Ionicons name="create-outline" size={iconSize.md} color={theme.text} />
          </Touchable>
          <Touchable onPress={addTx} size={36} style={S.headerBtn} accessibilityLabel="Add transaction" rippleBorderless>
            <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
          </Touchable>
        </View>
      )}
    >
      {/* The account's own colour is its identity — the one card in the app that is not a neutral
          surface, because the colour is the thing the user chose to tell accounts apart. */}
      <Card style={[S.accountCard, { backgroundColor: account.color, borderColor: account.color, marginTop: space.sm }]}>
        <View style={S.accountTop}>
          <View style={[S.iconCircle, { backgroundColor: hexToRGBA(onAccount, 0.18) }]}>
            <Ionicons name={meta.icon as any} size={iconSize.xl} color={onAccount} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: onAccount, opacity: 0.8 }]}>{meta.label}</Text>
            <Text style={[type.heading, { color: onAccount }]} numberOfLines={1}>{account.name}</Text>
          </View>
        </View>
        <Text style={[type.overline, { color: onAccount, opacity: 0.8, marginTop: space.lg }]}>Balance</Text>
        <Amount value={balance} role="display" color={onAccount} />
        <View style={[S.stats, { borderTopColor: hexToRGBA(onAccount, 0.25) }]}>
          <View style={S.stat}>
            <Text style={[type.label, { color: onAccount, opacity: 0.8 }]}>Income</Text>
            <Amount value={income} kind="income" unsigned role="bodyStrong" color={onAccount} />
          </View>
          <View style={S.stat}>
            <Text style={[type.label, { color: onAccount, opacity: 0.8 }]}>Expenses</Text>
            <Amount value={expense} kind="expense" unsigned role="bodyStrong" color={onAccount} />
          </View>
          <View style={S.stat}>
            <Text style={[type.label, { color: onAccount, opacity: 0.8 }]}>Records</Text>
            <Text style={[type.bodyStrong, { color: onAccount }]}>{transactions.length}</Text>
          </View>
        </View>
      </Card>

      <SectionHeader title="Transactions" count={transactions.length} />
      {transactions.length === 0 ? (
        <Card><EmptyState compact icon="receipt-outline" title="No transactions yet" action={{ label: 'Add first transaction', onPress: addTx }} /></Card>
      ) : (
        <View style={S.txList}>
          {transactions.map((item, index) => (
            <TransactionRow
              key={item._id}
              item={item}
              index={index}
              theme={theme}
              t={t}
              accountName={account.name}
              onPress={() => router.push({ pathname: '/edit-transaction', params: { id: item._id } })}
              onLongPress={() => {}}
              isFirst={index === 0}
              isLast={index === transactions.length - 1}
              marginHorizontal={0}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: space.xs },
  headerBtn:     { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  accountCard:   { gap: space.xs },
  accountTop:    { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconCircle:    { width: 52, height: 52, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  stats:         { flexDirection: 'row', marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  stat:          { flex: 1, gap: 2 },
  txList:        { gap: 0 },
});
