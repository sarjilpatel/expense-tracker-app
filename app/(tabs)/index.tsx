import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, RefreshControl,
  Alert, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getPeriodRange, getPeriodLabel, filterByPeriod, getCalendarMonthsForPeriod } from '@/src/utils/dateUtils';
import socketService from '@/src/services/socketService';
import { sendLocalNotification, getLargeTransactionThreshold } from '@/src/services/notificationService';
import { getTransactions, deleteTransaction, restoreTransaction, getBudgets } from '@/src/services/dataService';
import { getAccounts, getTxAccountMap } from '@/src/services/accountService';
import { getReceiptMap } from '@/src/services/receiptService';
import {
  getCachedTransactions, setCachedTransactions,
  getCachedBudgets, setCachedBudgets,
  invalidateCachedTransactions,
} from '@/src/cache/transactionCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { Currency } from '@/constants/theme';

import { ViewModeTabs, HomeViewMode } from '@/components/home/ViewModeTabs';
import { FilterDrawer, FilterState, DEFAULT_FILTERS } from '@/components/home/FilterDrawer';
import { TransactionRow } from '@/components/home/TransactionRow';
import { TransactionSectionHeader } from '@/components/home/TransactionSectionHeader';
import { CalendarView } from '@/components/home/CalendarView';
import { MonthlyView } from '@/components/home/MonthlyView';
import { TotalView } from '@/components/home/TotalView';
import { WeeklyView } from '@/components/home/WeeklyView';
import { NoteView } from '@/components/home/NoteView';
import { NotificationsModal, Notification } from '@/components/home/NotificationsModal';
import { MonthYearPicker } from '@/components/home/MonthYearPicker';

const EmptyWalletIllustration = ({ theme }: { theme: any }) => (
  <View style={styles.emptyIllustrationWrap}>
    {/* Coins */}
    <View style={[styles.emptyCoin, { backgroundColor: theme.tint, transform: [{ rotate: '15deg' }], top: 0, left: 35 }]} />
    <View style={[styles.emptyCoin, { backgroundColor: theme.tint, opacity: 0.6, transform: [{ rotate: '-20deg' }], top: 15, left: 85 }]} />
    {/* Wallet */}
    <View style={[styles.emptyWalletBody, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
      <View style={[styles.emptyWalletFlap, { backgroundColor: theme.border }]} />
      <View style={[styles.emptyWalletSnap, { backgroundColor: theme.tint }]} />
    </View>
  </View>
);

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
  const { user, isGuest } = useAuth();
  const { theme } = useTheme();
  const { prefs, formatAmount } = usePreferences();
  const { top } = useSafeAreaInsets();

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
  const [receiptMap, setReceiptMap] = useState<Record<string, string>>({});
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [undoState, setUndoState] = useState<{ txId: string; tx: any } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (tx.amount >= getLargeTransactionThreshold(tx.currency)) {
        sendLocalNotification(
          `New group transaction recorded`,
          `A large ${tx.type} was added by ${tx.userId?.name || 'a group member'}`
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
      // note is stripped from the socket payload — merge to preserve existing note
      setAllTransactions(prev => prev.map(tx =>
        tx._id === updated._id ? { ...tx, ...updated, note: tx.note } : tx
      ))
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
        const raw = await getTransactions(monthParam, currentYear);
        txData = Array.isArray(raw) ? raw : [];
        await setCachedTransactions(txData, monthParam, currentYear);
      }

      const [budgetsData] = await Promise.all([getBudgets()]);
      const budgetList: any[] = Array.isArray(budgetsData) ? budgetsData : [];
      await setCachedBudgets(budgetList);

      const freshSummary = computeSummary(txData);
      setAllTransactions(txData);
      setSummary(freshSummary);

      const mainBudget = budgetList.find((b: any) => !b.category) || null;
      setBudget(mainBudget);
      if (mainBudget && freshSummary.expense) {
        const pct = (freshSummary.expense / mainBudget.amount) * 100;
        const tier = pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : null;
        if (tier) {
          const key = `@budget_alert_${tier}_ts`;
          const last = await AsyncStorage.getItem(key).catch(() => null);
          const cooldownMs = 24 * 60 * 60 * 1000;
          if (!last || Date.now() - parseInt(last, 10) > cooldownMs) {
            await AsyncStorage.setItem(key, String(Date.now())).catch(() => {});
            if (tier === 'warning') sendLocalNotification('Budget Warning', t('budget_warning') || "You've used 80% of your monthly budget");
            else                    sendLocalNotification('Budget Exceeded', t('budget_exceeded') || 'Budget exceeded!');
          }
        }
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

  const loadReceiptMap = useCallback(async () => {
    try { setReceiptMap(await getReceiptMap()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadReceiptMap(); }, [loadReceiptMap]));

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
  const availableCategories = useMemo(() =>
    [...new Set(allTransactions.map((tx: any) => tx.category))].sort(),
  [allTransactions]);

  const filteredTransactions = useMemo(() => {
    let txs = allTransactions;
    if (activeFilters.type !== 'all') txs = txs.filter((tx: any) => tx.type === activeFilters.type);
    if (activeFilters.categories.length > 0) txs = txs.filter((tx: any) => activeFilters.categories.includes(tx.category));
    const min = parseFloat(activeFilters.amountMin);
    const max = parseFloat(activeFilters.amountMax);
    if (!isNaN(min)) txs = txs.filter((tx: any) => tx.amount >= min);
    if (!isNaN(max)) txs = txs.filter((tx: any) => tx.amount <= max);
    return txs;
  }, [allTransactions, activeFilters]);

  const filteredSections = useMemo(() => {
    return buildSections(filteredTransactions);
  }, [filteredTransactions]);

  const ITEM_HEIGHT   = 56;
  const HEADER_HEIGHT = 46;

  const [actionSheet, setActionSheet] = useState<{ item: any } | null>(null);

  type FlatItem =
    | { _type: 'header'; title: string; dateObj: Date; income: number; expense: number; isFirst: boolean }
    | { _type: 'row'; item: any; itemIndex: number; isFirst: boolean; isLast: boolean };

  const flatData = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = [];
    filteredSections.forEach((section, si) => {
      result.push({ _type: 'header', title: section.title, dateObj: section.dateObj, income: section.income, expense: section.expense, isFirst: si === 0 });
      section.data.forEach((item: any, ii: number) => {
        result.push({ _type: 'row', item, itemIndex: ii, isFirst: ii === 0, isLast: ii === section.data.length - 1 });
      });
    });
    return result;
  }, [filteredSections]);

  const overrideItemLayout = useCallback((layout: any, item: FlatItem) => {
    layout.size = item._type === 'header' ? HEADER_HEIGHT : ITEM_HEIGHT;
  }, []);

  const budgetProgress = useMemo(() => {
    if (!budget?.amount) return 0;
    return Math.min((summary.expense / budget.amount) * 100, 100);
  }, [budget, summary.expense]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const removed = allTransactions.find(tx => tx._id === id);
    if (!removed) return;

    // Optimistic remove
    setAllTransactions(prev => prev.filter(tx => tx._id !== id));
    setSummary(prev => ({
      income:  removed.type === 'income'  ? prev.income  - removed.amount : prev.income,
      expense: removed.type === 'expense' ? prev.expense - removed.amount : prev.expense,
      balance: removed.type === 'income'  ? prev.balance - removed.amount : prev.balance + removed.amount,
    }));

    deleteTransaction(id).catch(() => {
      // Revert on server failure
      setAllTransactions(prev => [removed, ...prev].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setSummary(prev => ({
        income:  removed.type === 'income'  ? prev.income  + removed.amount : prev.income,
        expense: removed.type === 'expense' ? prev.expense + removed.amount : prev.expense,
        balance: removed.type === 'income'  ? prev.balance + removed.amount : prev.balance - removed.amount,
      }));
      Alert.alert('Error', 'Failed to delete transaction');
    });

    // Show undo toast for 5 seconds
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ txId: id, tx: removed });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
      invalidateCachedTransactions(currentMonth, currentYear);
    }, 5000);
  }, [allTransactions, currentMonth, currentYear]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const { txId, tx } = undoState;
    setUndoState(null);
    try {
      await restoreTransaction(txId);
      setAllTransactions(prev => [tx, ...prev].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setSummary(prev => ({
        income:  tx.type === 'income'  ? prev.income  + tx.amount : prev.income,
        expense: tx.type === 'expense' ? prev.expense + tx.amount : prev.expense,
        balance: tx.type === 'income'  ? prev.balance + tx.amount : prev.balance - tx.amount,
      }));
    } catch {
      Alert.alert('Error', 'Could not undo deletion');
    }
  }, [undoState]);

  const handleEdit = useCallback((item: any) => {
    if (!item?._id) return;
    router.push({
      pathname: '/edit-transaction',
      params: {
        id:        item._id,
        amount:    item.amount != null ? String(item.amount) : '0',
        type:      item.type ?? 'expense',
        category:  item.category ?? '',
        note:      item.note ?? '',
        date:      item.date ?? item.createdAt ?? new Date().toISOString(),
        isPrivate: String(!!item.isPrivate),
      },
    });
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderFlashItem = useCallback(({ item: flatItem }: { item: FlatItem }) => {
    if (flatItem._type === 'header') {
      return (
        <View style={{ marginTop: flatItem.isFirst ? 0 : 12 }}>
          <TransactionSectionHeader section={flatItem} theme={theme} />
        </View>
      );
    }
    return (
      <TransactionRow
        item={flatItem.item}
        index={flatItem.itemIndex}
        theme={theme}
        t={t}
        accountName={accountNameMap[flatItem.item._id] ?? null}
        hasReceipt={!!receiptMap[flatItem.item._id]}
        onPress={handleEdit}
        onLongPress={(id) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActionSheet({ item: flatItem.item }); }}
        isFirst={flatItem.isFirst}
        isLast={flatItem.isLast}
      />
    );
  }, [theme, t, accountNameMap, receiptMap, handleEdit, handleDelete]);

  const flashKeyExtractor = useCallback((item: FlatItem) =>
    item._type === 'header' ? 'h-' + item.title : item.item._id,
  []);

  const getItemType = useCallback((item: FlatItem) => item._type, []);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const renderModeContent = () => {
    const commonScrollProps = {
      refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />,
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: 'handled' as const,
      contentContainerStyle: styles.scrollContent,
    };

    if (monthLoading) {
      return <SkeletonLoader rows={7} />;
    }

    if (viewMode === 'daily') {
      return (
        <FlashList
          data={flatData}
          keyExtractor={flashKeyExtractor}
          renderItem={renderFlashItem}
          getItemType={getItemType}
          overrideItemLayout={overrideItemLayout}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyWalletIllustration theme={theme} />
              <Text style={[styles.emptyText, { color: theme.text, marginTop: 12 }]}>No transactions yet</Text>
              <Text style={[styles.emptySubText, { color: theme.secondaryText, marginBottom: 20 }]}>
                Add your first transaction to start tracking
              </Text>
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: theme.tint }]}
                onPress={() => router.push('/add-transaction')}
              >
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
          }
        />
      );
    }

    return (
      <ScrollView {...commonScrollProps}>
        {viewMode === 'weekly' && (
          <WeeklyView transactions={filteredTransactions} month={currentMonth} year={currentYear} theme={theme} />
        )}
        {viewMode === 'calendar' && (
          <CalendarView
            transactions={filteredTransactions}
            month={currentMonth}
            year={currentYear}
            theme={theme}
            t={t}
            onTransactionPress={handleEdit}
          />
        )}
        {viewMode === 'monthly' && (
          <MonthlyView
            transactions={filteredTransactions}
            summary={summary}
            year={currentYear}
            theme={theme}
            t={t}
          />
        )}
        {viewMode === 'total' && (
          <TotalView
            transactions={filteredTransactions}
            summary={summary}
            budget={budget}
            month={currentMonth}
            year={currentYear}
            theme={theme}
            t={t}
          />
        )}
        {viewMode === 'note' && (
          <NoteView
            transactions={filteredTransactions}
            theme={theme}
            t={t}
            onTransactionPress={handleEdit}
          />
        )}
      </ScrollView>
    );
  };

  return (
    <GestureDetector gesture={swipeGesture}>
      <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>

        {/* Compact Header */}
        <View style={styles.topBlock}>
          <View style={styles.header}>
            <View style={styles.monthSelector}>
              <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={16}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <ThemedText type="title" style={[styles.monthText, { color: theme.text }]}>
                  {viewMode === 'monthly' ? String(currentYear) : `${MONTHS[currentMonth - 1]} ${currentYear}`}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={16}>
                <Ionicons name="chevron-forward" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: theme.background }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilterDrawer(true); }}
              >
                <Ionicons name="filter-outline" size={18} color={activeFilters.type !== 'all' || activeFilters.categories.length > 0 || activeFilters.amountMin || activeFilters.amountMax ? theme.tint : theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: theme.background }]} onPress={() => router.push('/search')}>
                <Ionicons name="search-outline" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: theme.background }]} onPress={() => setShowNotifications(true)}>
                <Ionicons name="options-outline" size={18} color={theme.text} />
                {notifications.length > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>
            </View>
          </View>

          <ViewModeTabs
            active={viewMode}
            onPress={setViewMode}
            tintColor={theme.tint}
            secondaryText={theme.secondaryText}
          />

          <View style={styles.summaryRow}>
            <TouchableOpacity
              style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: activeFilters.type === 'all' ? theme.tint : theme.card, borderWidth: 1 }]}
              onPress={() => setActiveFilters(DEFAULT_FILTERS)}
              activeOpacity={0.75}
            >
              <View style={[styles.summaryIcon, { backgroundColor: theme.text + '10', alignSelf: 'center', marginBottom: 4 }]}>
                <Ionicons name="wallet-outline" size={12} color={theme.text} />
              </View>
              <Text style={[styles.summaryAmount, { color: theme.text, textAlign: 'center' }]} numberOfLines={1}>
                {formatAmount(summary.income - summary.expense)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Balance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: activeFilters.type === 'income' ? theme.income : theme.card, borderWidth: 1 }]}
              onPress={() => setActiveFilters(prev => ({ ...prev, type: 'income' }))}
              activeOpacity={0.75}
            >
              <View style={[styles.summaryIcon, { backgroundColor: theme.income + '18', alignSelf: 'center', marginBottom: 4 }]}>
                <Ionicons name="arrow-up" size={12} color={theme.income} />
              </View>
              <Text style={[styles.summaryAmount, { color: theme.income, textAlign: 'center' }]} numberOfLines={1}>
                {formatAmount(summary.income)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Income</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.summaryCard, { backgroundColor: theme.card, borderColor:  activeFilters.type === 'expense' ? theme.expense: theme.card, borderWidth: 1 }]}
              onPress={() => setActiveFilters(prev => ({ ...prev, type: 'expense' }))}
              activeOpacity={0.75}
            >
              <View style={[styles.summaryIcon, { backgroundColor: theme.expense + '18', alignSelf: 'center', marginBottom: 4 }]}>
                <Ionicons name="arrow-down" size={12} color={theme.expense} />
              </View>
              <Text style={[styles.summaryAmount, { color: theme.expense, textAlign: 'center' }]} numberOfLines={1}>
                {formatAmount(summary.expense)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View content */}
        <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {renderModeContent()}
        </Animated.View>

        {/* Month/Year Picker */}
        {showDatePicker && (
          <>
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 999 }]}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            />
            <View style={[styles.pickerWrap, { top: top + 48 }]}>
              <MonthYearPicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                selectedMonth={currentMonth}
                selectedYear={currentYear}
                onSelect={(month, year) => {
                  setCurrentMonth(month);
                  setCurrentYear(year);
                }}
                theme={theme}
                showYearOnly={viewMode === 'monthly'}
              />
            </View>
          </>
        )}

        {/* Notifications */}
        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          theme={theme}
        />

        {/* Filter drawer */}
        <FilterDrawer
          visible={showFilterDrawer}
          onClose={() => setShowFilterDrawer(false)}
          onApply={setActiveFilters}
          availableCategories={availableCategories}
          current={activeFilters}
        />

        {/* Long-press action sheet */}
        {actionSheet && (
          <View style={[actionStyles.overlay, StyleSheet.absoluteFill]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setActionSheet(null)} />
            <View style={[actionStyles.sheet, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
              <View style={[actionStyles.dragHandle, { backgroundColor: theme.border }]} />
              <View style={actionStyles.txPreview}>
                <Text style={[actionStyles.txPreviewCat, { color: theme.secondaryText }]}>
                  {actionSheet.item.category}
                </Text>
                <Text style={[actionStyles.txPreviewAmt, { color: actionSheet.item.type === 'expense' ? theme.expense : theme.income }]}>
                  {actionSheet.item.type === 'expense' ? '-' : '+'}{Currency.format(actionSheet.item.amount)}
                </Text>
              </View>
              <TouchableOpacity
                style={[actionStyles.actionBtn, { borderBottomColor: theme.separator }]}
                onPress={() => { setActionSheet(null); handleEdit(actionSheet.item); }}
              >
                <Ionicons name="create-outline" size={20} color={theme.tint} />
                <Text style={[actionStyles.actionText, { color: theme.text }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[actionStyles.actionBtn, { borderBottomColor: theme.separator }]}
                onPress={() => {
                  const id = actionSheet.item._id;
                  setActionSheet(null);
                  handleDelete(id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                <Text style={[actionStyles.actionText, { color: theme.danger }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={actionStyles.cancelBtn}
                onPress={() => setActionSheet(null)}
              >
                <Text style={[actionStyles.cancelText, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Undo toast */}
        {undoState && (
          <View style={[styles.undoToast, { backgroundColor: theme.text }]}>
            <Text style={[styles.undoText, { color: theme.background }]}>Transaction deleted</Text>
            <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
              <Text style={[styles.undoBtnText, { color: theme.tint }]}>UNDO</Text>
            </TouchableOpacity>
          </View>
        )}

      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 36, marginBottom: 8 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthText:     { fontSize: 17, fontWeight: '800' },
  headerIcons:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerIconBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  notifDot:      { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: '#FFF' },

  topBlock: {
    marginHorizontal: 8,
    marginBottom: 4,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  summaryIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  budgetCard: {
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  budgetPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 3,
  },

  undoToast:    { position: 'absolute', bottom: 100, left: 12, right: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  undoText:     { fontSize: 14, fontWeight: '500' },
  undoBtn:      { paddingLeft: 16 },
  undoBtnText:  { fontSize: 14, fontWeight: '800' },
  guestBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#18181B', paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 12, marginBottom: 8, borderRadius: 12 },
  guestBannerText: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '600' },
  swipeHint:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  swipeHintText: { fontSize: 13 },
  pickerWrap:    { position: 'absolute', left: 12, right: 12, zIndex: 1000 },

  listContent:   { paddingBottom: 108, paddingTop: 4 },
  scrollContent: { paddingHorizontal: 8, paddingBottom: 108, paddingTop: 4 },
  card:          { borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  empty:         { marginTop: 28, alignItems: 'center', paddingHorizontal: 16 },
  emptyText:     { fontSize: 17, fontWeight: '700' },
  emptySubText:  { fontSize: 14, marginTop: 6, textAlign: 'center' },
  emptyCta:      { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, marginTop: 12 },
  noteCard:      { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 10 },
  noteColorBar:  { width: 4 },
  noteBody:      { flex: 1, padding: 14, gap: 4 },
  noteTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteCat:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  noteAmt:       { fontSize: 13, fontWeight: '800' },
  noteText:      { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  noteDate:      { fontSize: 11, marginTop: 2 },

  emptyIllustrationWrap: {
    width: 140,
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  emptyCoin: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  emptyWalletBody: {
    width: 100,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'relative',
  },
  emptyWalletFlap: {
    position: 'absolute',
    right: 0,
    top: 16,
    width: 44,
    height: 28,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  emptyWalletSnap: {
    position: 'absolute',
    right: 12,
    top: 26,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

const actionStyles = StyleSheet.create({
  overlay:     { zIndex: 200, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, borderTopWidth: StyleSheet.hairlineWidth },
  dragHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8, opacity: 0.4 },
  txPreview:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  txPreviewCat:{ fontSize: 13, fontWeight: '600' },
  txPreviewAmt:{ fontSize: 17, fontWeight: '800' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  actionText:  { fontSize: 16, fontWeight: '600' },
  cancelBtn:   { alignItems: 'center', paddingVertical: 16 },
  cancelText:  { fontSize: 15, fontWeight: '600' },
});

