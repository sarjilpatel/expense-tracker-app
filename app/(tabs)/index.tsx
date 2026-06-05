import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, SectionList, RefreshControl,
  Alert, TextInput, ScrollView, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import socketService from '@/src/services/socketService';
import { sendLocalNotification, LARGE_TRANSACTION_THRESHOLD } from '@/src/services/notificationService';
import { getTransactions, deleteTransaction } from '@/src/services/transactionApi';
import { getBudgets } from '@/src/services/budgetApi';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonLoader } from '@/components/SkeletonLoader';

import { ViewModeTabs, HomeViewMode } from '@/components/home/ViewModeTabs';
import { SummaryStrip } from '@/components/home/SummaryStrip';
import { BudgetBar } from '@/components/home/BudgetBar';
import { TransactionRow } from '@/components/home/TransactionRow';
import { TransactionSectionHeader } from '@/components/home/TransactionSectionHeader';
import { CalendarView } from '@/components/home/CalendarView';
import { MonthlyView } from '@/components/home/MonthlyView';
import { NotificationsModal, Notification } from '@/components/home/NotificationsModal';

function buildSections(transactions: any[]) {
  const groups: Record<string, any> = {};
  transactions.forEach((tx: any) => {
    const d = new Date(tx.date || tx.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups[key]) groups[key] = { dateObj: d, income: 0, expense: 0, data: [] };
    groups[key].data.push(tx);
    if (tx.type === 'income') groups[key].income += tx.amount;
    else groups[key].expense += tx.amount;
  });
  return Object.values(groups)
    .sort((a: any, b: any) => b.dateObj.getTime() - a.dateObj.getTime())
    .map((g: any) => ({
      title: g.dateObj.toISOString(),
      dateObj: g.dateObj,
      income: g.income,
      expense: g.expense,
      data: g.data,
    }));
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [viewMode, setViewMode] = useState<HomeViewMode>('daily');

  const searchInputRef = useRef<TextInput>(null);
  const hasData = useRef(false);
  const isMounted = useRef(false);

  const contentOpacity = useSharedValue(1);
  const contentAnimStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    socketService.onNewTransaction((tx) => {
      if (!user || tx.userId?._id === user._id) return;
      if (tx.amount >= LARGE_TRANSACTION_THRESHOLD) {
        sendLocalNotification(
          `Large ${tx.type} by ${tx.userId?.name || 'Member'}`,
          `${tx.type === 'expense' ? '-' : '+'}₹${tx.amount} · ${tx.category}`
        );
      }
      setAllTransactions(prev => [tx, ...prev]);
      setSummary(prev => ({
        ...prev,
        income:  tx.type === 'income'  ? prev.income  + tx.amount : prev.income,
        expense: tx.type === 'expense' ? prev.expense + tx.amount : prev.expense,
        balance: tx.type === 'income'  ? prev.balance + tx.amount : prev.balance - tx.amount,
      }));
      setNotifications(prev => [{
        id: tx._id,
        type: tx.type,
        title: `${tx.userId?.name || 'Someone'} added a transaction`,
        message: `${tx.type === 'expense' ? '-' : '+'}₹${tx.amount} · ${tx.category}`,
        time: new Date(tx.date || tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      }, ...prev].slice(0, 20));
    });
    socketService.onTransactionUpdated(updated =>
      setAllTransactions(prev => prev.map(tx => tx._id === updated._id ? updated : tx))
    );
    socketService.onTransactionDeleted(id =>
      setAllTransactions(prev => prev.filter(tx => tx._id !== id))
    );
    return () => {
      socketService.off('new_transaction');
      socketService.off('transaction_updated');
      socketService.off('transaction_deleted');
    };
  }, [user]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [txData, budgetsData] = await Promise.all([
        getTransactions(currentMonth, currentYear),
        getBudgets(),
      ]);
      setAllTransactions(txData);
      const inc = txData.filter((tx: any) => tx.type === 'income').reduce((s: number, tx: any) => s + tx.amount, 0);
      const exp = txData.filter((tx: any) => tx.type === 'expense').reduce((s: number, tx: any) => s + tx.amount, 0);
      setSummary({ income: inc, expense: exp, balance: inc - exp });
      const mainBudget = budgetsData?.find((b: any) => !b.category) || null;
      setBudget(mainBudget);
      if (mainBudget && exp) {
        const pct = (exp / mainBudget.amount) * 100;
        if (pct >= 80 && pct < 100) sendLocalNotification('Budget Warning', t('budget_warning') || "You've used 80% of your monthly budget");
        else if (pct >= 100) sendLocalNotification('Budget Exceeded', t('budget_exceeded') || 'Budget exceeded!');
      }
      hasData.current = true;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      contentOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [currentMonth, currentYear]);

  useFocusEffect(useCallback(() => { fetchData(hasData.current); }, [fetchData]));

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    hasData.current = false;
    fetchData(true);
  }, [currentMonth, currentYear]);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  // ── Month navigation ──────────────────────────────────────────────────────
  const changeMonth = useCallback((delta: number) => {
    contentOpacity.value = withTiming(0.45, { duration: 100 });
    setCurrentMonth(m => {
      const newM = m + delta;
      if (newM > 12) { setCurrentYear(y => y + 1); return 1; }
      if (newM < 1)  { setCurrentYear(y => y - 1); return 12; }
      return newM;
    });
  }, []);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-20, 20])
      .onEnd((e) => {
        'worklet';
        if (e.translationX < -50 && e.velocityX < 0) runOnJS(changeMonth)(1);
        else if (e.translationX > 50 && e.velocityX > 0) runOnJS(changeMonth)(-1);
      }),
    [changeMonth]
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredSections = useMemo(() => buildSections(
    searchQuery
      ? allTransactions.filter(tx =>
          tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : allTransactions
  ), [searchQuery, allTransactions]);

  const budgetProgress = useMemo(() => {
    if (!budget?.amount) return 0;
    return Math.min((summary.expense / budget.amount) * 100, 100);
  }, [budget, summary.expense]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    Alert.alert(t('delete') || 'Delete', 'Are you sure you want to delete this record?', [
      { text: t('cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('delete') || 'Delete', style: 'destructive',
        onPress: async () => {
          const previous = allTransactions;
          const removed = previous.find(tx => tx._id === id);
          setAllTransactions(prev => prev.filter(tx => tx._id !== id));
          if (removed) setSummary(prev => ({
            income:  removed.type === 'income'  ? prev.income  - removed.amount : prev.income,
            expense: removed.type === 'expense' ? prev.expense - removed.amount : prev.expense,
            balance: removed.type === 'income'  ? prev.balance - removed.amount : prev.balance + removed.amount,
          }));
          try {
            await deleteTransaction(id);
          } catch {
            setAllTransactions(previous);
            if (removed) setSummary(prev => ({
              income:  removed.type === 'income'  ? prev.income  + removed.amount : prev.income,
              expense: removed.type === 'expense' ? prev.expense + removed.amount : prev.expense,
              balance: removed.type === 'income'  ? prev.balance + removed.amount : prev.balance - removed.amount,
            }));
            Alert.alert('Error', 'Failed to delete transaction');
          }
        },
      },
    ]);
  }, [allTransactions, t]);

  const handleEdit = useCallback((item: any) => {
    router.push({
      pathname: '/edit-transaction',
      params: { id: item._id, amount: item.amount.toString(), type: item.type, category: item.category, note: item.note || '', date: item.date || item.createdAt },
    });
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderSectionHeader = useCallback(({ section }: any) => (
    <TransactionSectionHeader section={section} theme={theme} />
  ), [theme]);

  const renderItem = useCallback(({ item, index }: any) => (
    <TransactionRow item={item} index={index} theme={theme} t={t} onPress={handleEdit} onLongPress={handleDelete} />
  ), [theme, t, handleEdit, handleDelete]);

  // ── Initial skeleton ──────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 160, height: 24, borderRadius: 8, backgroundColor: 'rgba(150,150,150,0.1)' }} />
        </View>
        <View style={[styles.skeletonStrip, { backgroundColor: theme.card }]}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 46, height: 10, borderRadius: 5, backgroundColor: 'rgba(150,150,150,0.12)' }} />
              <View style={{ width: 70, height: 15, borderRadius: 5, backgroundColor: 'rgba(150,150,150,0.1)' }} />
            </View>
          ))}
        </View>
        <SkeletonLoader rows={6} />
      </ThemedView>
    );
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <GestureDetector gesture={swipeGesture}>
      <ThemedView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={16}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.monthText}>
              {MONTHS[currentMonth - 1]} {currentYear}
            </ThemedText>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={16}>
              <Ionicons name="chevron-forward" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.card }]}
              onPress={() => {
                const next = !showSearch;
                setShowSearch(next);
                if (next) setTimeout(() => searchInputRef.current?.focus(), 60);
                else setSearchQuery('');
              }}
            >
              <Ionicons name={showSearch ? 'close' : 'search-outline'} size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.card }]}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
              {notifications.length > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* View mode tabs */}
        <ViewModeTabs
          active={viewMode}
          onPress={setViewMode}
          tintColor={theme.tint}
          secondaryText={theme.secondaryText}
        />

        {/* Summary strip */}
        <SummaryStrip
          income={summary.income}
          expense={summary.expense}
          balance={summary.balance}
          incomeLabel={t('income')}
          expenseLabel={t('expenses')}
          cardColor={theme.card}
          borderColor={theme.border}
          secondaryText={theme.secondaryText}
          incomeColor={theme.income}
          expenseColor={theme.expense}
          style={contentAnimStyle}
        />

        {/* Budget */}
        <BudgetBar
          budget={budget}
          spent={summary.expense}
          progress={budgetProgress}
          cardColor={theme.card}
          borderColor={theme.border}
          secondaryText={theme.secondaryText}
          expenseColor={theme.expense}
          warningText={t('budget_warning') || "You've used 80% of your budget"}
          exceededText={t('budget_exceeded') || 'Budget exceeded!'}
        />

        {/* Search bar */}
        {showSearch && (
          <Animated.View style={[styles.searchBar, { backgroundColor: theme.card }]}>
            <Ionicons name="search-outline" size={15} color={theme.secondaryText} />
            <TextInput
              ref={searchInputRef}
              placeholder={t('search_placeholder')}
              placeholderTextColor={theme.secondaryText}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={14} color={theme.secondaryText} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Daily list */}
        {viewMode === 'daily' && (
          <SectionList
            sections={filteredSections}
            keyExtractor={item => item._id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={14}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={44} color={theme.secondaryText} style={{ opacity: 0.13, marginBottom: 10 }} />
                <ThemedText style={styles.emptyText}>{t('no_transactions')}</ThemedText>
              </View>
            }
          />
        )}

        {/* Calendar / Monthly */}
        {(viewMode === 'calendar' || viewMode === 'monthly') && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.card, { backgroundColor: theme.card }, contentAnimStyle]}>
              {viewMode === 'calendar' && (
                <CalendarView
                  transactions={allTransactions}
                  month={currentMonth}
                  year={currentYear}
                  theme={theme}
                  t={t}
                  onTransactionPress={handleEdit}
                />
              )}
              {viewMode === 'monthly' && (
                <MonthlyView
                  transactions={allTransactions}
                  summary={summary}
                  theme={theme}
                  t={t}
                />
              )}
            </Animated.View>
          </ScrollView>
        )}

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.tint }]}
          onPress={() => router.push('/(tabs)/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* Notifications */}
        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          theme={theme}
        />

      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, paddingTop: 60 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText:     { fontSize: 18, fontWeight: '800' },
  headerIcons:   { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  notifDot:      { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: '#FFF' },
  skeletonStrip: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 16, paddingVertical: 12, marginBottom: 8 },
  searchBar:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 6, height: 40, borderRadius: 11, paddingHorizontal: 13, gap: 9 },
  searchInput:   { flex: 1, fontSize: 14, fontWeight: '500' },
  listContent:   { paddingBottom: 120 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },
  card:          { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  empty:         { marginTop: 56, alignItems: 'center' },
  emptyText:     { fontSize: 13, opacity: 0.4, fontWeight: '600' },
  fab:           { position: 'absolute', bottom: 104, right: 22, width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.36, shadowRadius: 12, elevation: 10, zIndex: 100 },
});
