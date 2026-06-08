import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Currency } from '@/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/home/TransactionRow';
import {
  Account, ACCOUNT_TYPE_META,
  getAccounts, getTxAccountMap, computeAccountBalance,
} from '@/src/services/accountService';
import { getTransactions } from '@/src/services/dataService';
import { getCachedTransactions, setCachedTransactions } from '@/src/cache/transactionCache';

export default function AccountDetailScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [account, setAccount]         = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txAccountMap, setTxAccountMap] = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);

    try {
      const [accounts, map] = await Promise.all([getAccounts(), getTxAccountMap()]);
      const acc = accounts.find(a => a.id === id);
      if (!acc) { router.back(); return; }
      setAccount(acc);
      setTxAccountMap(map);

      // Try cache first
      const cached = await getCachedTransactions();
      const rawTx = cached ?? await getTransactions();
      const allTx: any[] = Array.isArray(rawTx) ? rawTx : [];
      if (!cached) await setCachedTransactions(allTx);
      else {
        getTransactions().then(raw => {
          const fresh: any[] = Array.isArray(raw) ? raw : [];
          setCachedTransactions(fresh);
          setTransactions(fresh.filter((tx: any) => map[tx._id] === id)
            .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        }).catch(() => {});
      }
      setTransactions(
        allTx
          .filter((tx: any) => map[tx._id] === id)
          .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const balance = useMemo(() => {
    if (!account) return 0;
    return computeAccountBalance(account, transactions, txAccountMap);
  }, [account, transactions, txAccountMap]);

  const income  = useMemo(() => transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0), [transactions]);

  if (loading && !account) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </ThemedView>
    );
  }

  if (!account) return null;

  const meta = ACCOUNT_TYPE_META[account.type];

  return (
    <ThemedView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: theme.card }]}
          onPress={() => router.push({ pathname: '/add-account', params: { id: account.id } })}
        >
          <Ionicons name="create-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: account.color, marginLeft: 8 }]}
          onPress={() => router.push({ pathname: '/(tabs)/add', params: { prefillAccountId: account.id } })}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={theme.tint} />}
      >

        {/* Account card */}
        <Animated.View entering={FadeInDown.duration(280)} style={[styles.accountCard, { backgroundColor: account.color, borderColor: account.color }]}>
          <View style={styles.accountCardTop}>
            <View style={[styles.iconCircle, { backgroundColor: theme.tint }]}>
              <Ionicons name={meta.icon as any} size={28} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountName, { color: '#FFF' }]}>{account.name}</Text>
              <Text style={[styles.accountType, { color: '#FFF' }]}>{meta.label}</Text>
            </View>
          </View>
 
          <Text style={[styles.balanceLabel, { color: '#FFF' }]}>CURRENT BALANCE</Text>
          <Text style={[styles.balanceAmt, { color: '#FFF' }]}>
            {Currency.format(balance)}
          </Text>
 
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={16} color="#FFF" />
              <Text style={[styles.statLabel, { color: '#FFF' }]}>Income</Text>
              <Text style={[styles.statVal, { color: '#FFF' }]}>{Currency.format(income)}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={16} color="#FFF" />
              <Text style={[styles.statLabel, { color: '#FFF' }]}>Expenses</Text>
              <Text style={[styles.statVal, { color: '#FFF' }]}>{Currency.format(expense)}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="receipt-outline" size={16} color="#FFF" />
              <Text style={[styles.statLabel, { color: '#FFF' }]}>Records</Text>
              <Text style={[styles.statVal, { color: '#FFF' }]}>{transactions.length}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Transactions */}
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>TRANSACTIONS</Text>

        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={44} color={theme.secondaryText} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No transactions yet</Text>
            <TouchableOpacity
              style={[styles.addFirstBtn, { backgroundColor: account.color }]}
              onPress={() => router.push({ pathname: '/(tabs)/add', params: { prefillAccountId: account.id } })}
            >
              <Text style={styles.addFirstText}>Add first transaction</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.txList, { borderColor: theme.border }]}>
            {transactions.map((item, index) => (
              <TransactionRow
                key={item._id}
                item={item}
                index={index}
                theme={theme}
                t={t}
                accountName={account.name}
                onPress={() => {}}
                onLongPress={() => {}}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  editBtn: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingBottom: 80 },

  accountCard: {
    marginHorizontal: 20, borderRadius: 20, borderWidth: 1.5,
    padding: 20, marginBottom: 8,
  },
  accountCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  iconCircle:     { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  accountName:    { fontSize: 20, fontWeight: '800' },
  accountType:    { fontSize: 13, fontWeight: '600', marginTop: 2 },
  balanceLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  balanceAmt:     { fontSize: 32, fontWeight: '900', marginBottom: 20 },
  statsRow:       { flexDirection: 'row', borderTopWidth: 1, paddingTop: 16 },
  statItem:       { flex: 1, alignItems: 'center', gap: 4 },
  statLabel:      { fontSize: 10, fontWeight: '600' },
  statVal:        { fontSize: 13, fontWeight: '800' },
  statDivider:    { width: 1 },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    marginBottom: 12, marginTop: 24, paddingHorizontal: 20,
  },

  txList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },

  empty:       { alignItems: 'center', paddingTop: 48 },
  emptyText:   { fontSize: 14, marginBottom: 20 },
  addFirstBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  addFirstText:{ color: '#FFF', fontWeight: '700', fontSize: 14 },
});
