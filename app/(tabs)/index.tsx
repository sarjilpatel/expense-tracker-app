import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, SectionList, RefreshControl,
  Alert, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getPeriodRange, getPeriodLabel, filterByPeriod, getCalendarMonthsForPeriod } from '@/src/utils/dateUtils';
import socketService from '@/src/services/socketService';
import { sendLocalNotification, LARGE_TRANSACTION_THRESHOLD } from '@/src/services/notificationService';
import { getTransactions, deleteTransaction, getBudgets } from '@/src/services/dataService';
import { getAccounts, getTxAccountMap } from '@/src/services/accountService';
import {
  getCachedTransactions, setCachedTransactions,
  getCachedBudgets, setCachedBudgets,
  invalidateCachedTransactions,
} from '@/src/cache/transactionCache';
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
import { TotalView } from '@/components/home/TotalView';
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
  const { theme } = useTheme();
  const { prefs, formatAmount } = usePreferences();

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [viewMode, setViewMode] = useState<HomeViewMode>('daily');
  const [monthLoading, setMonthLoading] = useState(false);
  const [accountNameMap, setAccountNameMap] = useState<Record<string, string>>({});


  const hasData = useRef(false);
  const isMounted = useRef(false);

  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const translateX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const contentAnimStyle = useAnimatedStyle(() => {
    const opacity = 1 - (Math.abs(translateX.value) / SCREEN_WIDTH) * 0.4;
    return {
      opacity: opacity * contentOpacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

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

  // ── Compute summary from transaction array ────────────────────────────────
  const computeSummary = useCallback((txList: any[]) => {
    const inc = txList.filter((tx: any) => tx.type === 'income').reduce((s: number, tx: any) => s + tx.amount, 0);
    const exp = txList.filter((tx: any) => tx.type === 'expense').reduce((s: number, tx: any) => s + tx.amount, 0);
    return { income: inc, expense: exp, balance: inc - exp };
  }, []);

  // ── Fetch: cache-first, then background API sync ──────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    const monthlyStart = prefs.monthlyStart;
    const isMonthlyView = viewMode === 'monthly';
    const monthParam = isMonthlyView ? undefined : currentMonth;

    // Step 1 — serve from cache instantly (no spinner if cache exists)
    const [cachedTx, cachedBudgets] = await Promise.all([
      getCachedTransactions(monthParam, currentYear),
      getCachedBudgets(),
    ]);

    if (cachedTx) {
      let periodTx = cachedTx;
      if (!isMonthlyView && monthlyStart > 1) {
        const { start, end } = getPeriodRange(currentMonth, currentYear, monthlyStart);
        periodTx = filterByPeriod(cachedTx, start, end);
      }
      setAllTransactions(periodTx);
      setSummary(computeSummary(periodTx));
      setMonthLoading(false);
    } else if (!isSilent) {
      setMonthLoading(true);
    }

    if (cachedBudgets) {
      setBudget(cachedBudgets.find((b: any) => !b.category) || null);
    }

    // Step 2 — background API fetch, update cache + state silently
    try {
      let txData: any[];

      if (!isMonthlyView && monthlyStart > 1) {
        // Fetch both months that the custom period spans
        const months = getCalendarMonthsForPeriod(currentMonth, currentYear, monthlyStart);
        const results = await Promise.all(months.map(m => getTransactions(m.month, m.year)));
        const combined = (results as any[][]).flat();
        const { start, end } = getPeriodRange(currentMonth, currentYear, monthlyStart);
        txData = filterByPeriod(combined, start, end);
        // Cache first month only (standard cache key)
        await setCachedTransactions(combined, currentMonth, currentYear);
      } else {
        txData = await getTransactions(monthParam, currentYear);
        await setCachedTransactions(txData, monthParam, currentYear);
      }

      const [budgetsData] = await Promise.all([getBudgets()]);
      await setCachedBudgets(budgetsData || []);

      setAllTransactions(txData);
      setSummary(computeSummary(txData));

      const mainBudget = budgetsData?.find((b: any) => !b.category) || null;
      setBudget(mainBudget);
      if (mainBudget && computeSummary(txData).expense) {
        const pct = (computeSummary(txData).expense / mainBudget.amount) * 100;
        if (pct >= 80 && pct < 100) sendLocalNotification('Budget Warning', t('budget_warning') || "You've used 80% of your monthly budget");
        else if (pct >= 100)        sendLocalNotification('Budget Exceeded', t('budget_exceeded') || 'Budget exceeded!');
      }
      hasData.current = true;
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setMonthLoading(false);
      contentOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [currentMonth, currentYear, viewMode, computeSummary, prefs.monthlyStart]);

  useFocusEffect(useCallback(() => { fetchData(hasData.current); }, [fetchData]));

  const loadAccountMap = useCallback(async () => {
    try {
      const [accounts, txMap] = await Promise.all([getAccounts(), getTxAccountMap()]);
      const map: Record<string, string> = {};
      Object.entries(txMap).forEach(([txId, accountId]) => {
        const acc = accounts.find(a => a.id === accountId);
        if (acc) map[txId] = acc.name;
      });
      setAccountNameMap(map);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadAccountMap(); }, [loadAccountMap]));

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    hasData.current = false;
    setAllTransactions([]);
    fetchData(false);
  }, [currentMonth, currentYear, viewMode]);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  // ── Month navigation ──────────────────────────────────────────────────────
  const changeMonth = useCallback((delta: number, isGesture = false) => {
    const slideOutTarget = delta > 0 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const slideInStart = delta > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;

    const performStateChangeAndSlideIn = () => {
      translateX.value = slideInStart;
      contentOpacity.value = 0.3;

      if (viewMode === 'monthly') {
        // Monthly tab: left/right navigates by year
        setCurrentYear(y => y + delta);
      } else {
        setCurrentMonth(m => {
          const newM = m + delta;
          if (newM > 12) { setCurrentYear(y => y + 1); return 1; }
          if (newM < 1)  { setCurrentYear(y => y - 1); return 12; }
          return newM;
        });
      }

      translateX.value = withTiming(0, { duration: 250 });
      contentOpacity.value = withTiming(1, { duration: 250 });
    };

    if (isGesture) {
      performStateChangeAndSlideIn();
    } else {
      contentOpacity.value = withTiming(0.3, { duration: 150 });
      translateX.value = withTiming(slideOutTarget, { duration: 150 }, (finished) => {
        if (finished) runOnJS(performStateChangeAndSlideIn)();
      });
    }
  }, [SCREEN_WIDTH, viewMode]);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-20, 20])
      .onUpdate((e) => {
        translateX.value = e.translationX;
      })
      .onEnd((e) => {
        const threshold = SCREEN_WIDTH * 0.25;
        if (e.translationX < -threshold) {
          // Swipe right-to-left: Next month
          translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(changeMonth)(1, true);
            }
          });
        } else if (e.translationX > threshold) {
          // Swipe left-to-right: Previous month
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(changeMonth)(-1, true);
            }
          });
        } else {
          // Snap back if threshold not met
          translateX.value = withTiming(0, { duration: 200 });
        }
      }),
    [changeMonth, SCREEN_WIDTH]
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredSections = useMemo(() => buildSections(allTransactions), [allTransactions]);

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
            const updated = previous.filter(tx => tx._id !== id);
            await invalidateCachedTransactions(currentMonth, currentYear);
            await setCachedTransactions(updated, currentMonth, currentYear);
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
  }, [allTransactions, t, currentMonth, currentYear]);

  const handleEdit = useCallback((item: any) => {
    if (!item?._id) return;
    router.push({
      pathname: '/edit-transaction',
      params: {
        id:       item._id,
        amount:   item.amount != null ? String(item.amount) : '0',
        type:     item.type ?? 'expense',
        category: item.category ?? '',
        note:     item.note ?? '',
        date:     item.date ?? item.createdAt ?? new Date().toISOString(),
      },
    });
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderSectionHeader = useCallback(({ section }: any) => {
    const isFirst = filteredSections[0]?.title === section.title;
    return (
      <View style={isFirst ? undefined : { marginTop: 10 }}>
        <TransactionSectionHeader section={section} theme={theme} />
      </View>
    );
  }, [theme, filteredSections]);

  const renderItem = useCallback(({ item, index }: any) => (
    <TransactionRow
      item={item}
      index={index}
      theme={theme}
      t={t}
      accountName={accountNameMap[item._id] ?? null}
      onPress={handleEdit}
      onLongPress={handleDelete}
    />
  ), [theme, t, accountNameMap, handleEdit, handleDelete]);

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
              {viewMode === 'monthly' ? currentYear : `${MONTHS[currentMonth - 1]} ${currentYear}`}
            </ThemedText>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={16}>
              <Ionicons name="chevron-forward" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Favorites', 'Starred transactions filter coming soon!');
              }}
            >
              <Ionicons name="star-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/search')}
            >
              <Ionicons name="search-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="options-outline" size={20} color={theme.text} />
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

        {/* Summary strip — always visible, never animated */}
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
          totalColor={theme.text}
          formatAmount={formatAmount}
          periodLabel={viewMode !== 'monthly' ? getPeriodLabel(currentMonth, currentYear, prefs.monthlyStart) : ''}
        />

        {/* Budget — always visible */}
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

        {/* Only the list/content slides and fades on month change */}
        <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {monthLoading ? (
            <SkeletonLoader rows={7} />
          ) : (
            <>
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
                      <Ionicons name="receipt-outline" size={44} color={theme.secondaryText} style={{ marginBottom: 10 }} />
                      <ThemedText style={styles.emptyText}>{t('no_transactions')}</ThemedText>
                    </View>
                  }
                />
              )}

              {/* Calendar — full-width, no card, no horizontal padding */}
              {viewMode === 'calendar' && (
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 120 }}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                  showsVerticalScrollIndicator={false}
                >
                  <CalendarView
                    transactions={allTransactions}
                    month={currentMonth}
                    year={currentYear}
                    theme={theme}
                    t={t}
                    onTransactionPress={handleEdit}
                  />
                </ScrollView>
              )}

              {/* Monthly Breakdown View */}
              {viewMode === 'monthly' && (
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                  showsVerticalScrollIndicator={false}
                >
                  <MonthlyView
                    transactions={allTransactions}
                    year={currentYear}
                    theme={theme}
                    t={t}
                  />
                </ScrollView>
              )}

              {/* Total Dashboard */}
              {viewMode === 'total' && (
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <TotalView
                    transactions={allTransactions}
                    summary={summary}
                    budget={budget}
                    month={currentMonth}
                    year={currentYear}
                    theme={theme}
                    t={t}
                  />
                </ScrollView>
              )}

              {/* Notes Feed */}
              {viewMode === 'note' && (() => {
                const noted = allTransactions.filter(tx => tx.note && tx.note.trim() !== '');
                if (noted.length === 0) {
                  return (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                      <View style={[styles.card, { backgroundColor: theme.card, alignItems: 'center', paddingVertical: 48, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.border }]}>
                        <Ionicons name="document-text-outline" size={44} color={theme.secondaryText} style={{ marginBottom: 16 }} />
                        <ThemedText style={{ fontSize: 16, fontWeight: '700', marginBottom: 6 }}>No Notes Yet</ThemedText>
                        <ThemedText style={{ fontSize: 13, color: theme.secondaryText, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
                          Add notes to transactions to see them here as a searchable feed.
                        </ThemedText>
                      </View>
                    </ScrollView>
                  );
                }
                return (
                  <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.secondaryText, letterSpacing: 0.5, marginBottom: 12, paddingLeft: 4 }}>
                      {noted.length} NOTE{noted.length !== 1 ? 'S' : ''} THIS {viewMode === 'monthly' ? 'YEAR' : 'MONTH'}
                    </Text>
                    {noted.map((tx: any) => {
                      const d = new Date(tx.date || tx.createdAt);
                      const isExpense = tx.type === 'expense';
                      return (
                        <TouchableOpacity
                          key={tx._id}
                          style={[styles.noteCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                          onPress={() => handleEdit(tx)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.noteColorBar, { backgroundColor: isExpense ? theme.expense : theme.income }]} />
                          <View style={styles.noteBody}>
                            <View style={styles.noteTop}>
                              <Text style={[styles.noteCat, { color: theme.secondaryText }]}>{tx.category}</Text>
                              <Text style={[styles.noteAmt, { color: isExpense ? theme.expense : theme.income }]}>
                                {isExpense ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <Text style={[styles.noteText, { color: theme.text }]}>{tx.note}</Text>
                            <Text style={[styles.noteDate, { color: theme.secondaryText }]}>
                              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                );
              })()}
            </>
          )}
        </Animated.View>

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
  headerIcons:   { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerIconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  notifDot:      { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: '#FFF' },

  listContent:   { paddingBottom: 120 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },
  card:          { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  empty:         { marginTop: 56, alignItems: 'center' },
  emptyText:     { fontSize: 13, fontWeight: '600' },
  fab:           { position: 'absolute', bottom: 104, right: 22, width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.36, shadowRadius: 12, elevation: 10, zIndex: 100 },
  noteCard:      { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  noteColorBar:  { width: 4 },
  noteBody:      { flex: 1, padding: 14, gap: 4 },
  noteTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteCat:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  noteAmt:       { fontSize: 13, fontWeight: '800' },
  noteText:      { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  noteDate:      { fontSize: 11, marginTop: 2 },
});
