import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, SectionList, RefreshControl,
  Alert, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

import { ViewModeTabs, HomeViewMode } from '@/components/home/ViewModeTabs';
import { FilterDrawer, FilterState, DEFAULT_FILTERS } from '@/components/home/FilterDrawer';
import { SummaryStrip } from '@/components/home/SummaryStrip';
import { BudgetBar } from '@/components/home/BudgetBar';
import { TransactionRow } from '@/components/home/TransactionRow';
import { TransactionSectionHeader } from '@/components/home/TransactionSectionHeader';
import { CalendarView } from '@/components/home/CalendarView';
import { MonthlyView } from '@/components/home/MonthlyView';
import { TotalView } from '@/components/home/TotalView';
import { WeeklyView } from '@/components/home/WeeklyView';
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
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [undoState, setUndoState] = useState<{ txId: string; tx: any } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);


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

  // One-time swipe hint
  useEffect(() => {
    AsyncStorage.getItem('@swipe_hint_shown').then(val => {
      if (!val) {
        setShowSwipeHint(true);
        setTimeout(async () => {
          setShowSwipeHint(false);
          await AsyncStorage.setItem('@swipe_hint_shown', '1');
        }, 3000);
      }
    });
  }, []);

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

  const filteredSections = useMemo(() => {
    let txs = allTransactions;
    if (activeFilters.type !== 'all') txs = txs.filter((tx: any) => tx.type === activeFilters.type);
    if (activeFilters.categories.length > 0) txs = txs.filter((tx: any) => activeFilters.categories.includes(tx.category));
    const min = parseFloat(activeFilters.amountMin);
    const max = parseFloat(activeFilters.amountMax);
    if (!isNaN(min)) txs = txs.filter((tx: any) => tx.amount >= min);
    if (!isNaN(max)) txs = txs.filter((tx: any) => tx.amount <= max);
    return buildSections(txs);
  }, [allTransactions, activeFilters]);

  const ITEM_HEIGHT   = 60;
  const HEADER_HEIGHT = 48;

  const itemLayoutMap = useMemo(() => {
    const map: Record<number, { length: number; offset: number; index: number }> = {};
    let offset = 0;
    let absIdx = 0;
    filteredSections.forEach((section, si) => {
      const headerH = si === 0 ? HEADER_HEIGHT : HEADER_HEIGHT + 10;
      map[absIdx] = { length: headerH, offset, index: absIdx };
      offset += headerH;
      absIdx++;
      section.data.forEach(() => {
        map[absIdx] = { length: ITEM_HEIGHT, offset, index: absIdx };
        offset += ITEM_HEIGHT;
        absIdx++;
      });
    });
    return map;
  }, [filteredSections]);

  const getItemLayout = useCallback((_: any, index: number) =>
    itemLayoutMap[index] ?? { length: ITEM_HEIGHT, offset: 0, index },
  [itemLayoutMap]);

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
  const renderSectionHeader = useCallback(({ section }: any) => {
    const isFirst = filteredSections[0]?.title === section.title;
    return (
      <View style={{ marginTop: isFirst ? 0 : 12 }}>
        <TransactionSectionHeader section={section} theme={theme} />
      </View>
    );
  }, [theme, filteredSections]);

  const renderItem = useCallback(({ item, index, section }: any) => {
    const isLast = index === section.data.length - 1;
    return (
      <TransactionRow
        item={item}
        index={index}
        theme={theme}
        t={t}
        accountName={accountNameMap[item._id] ?? null}
        hasReceipt={!!receiptMap[item._id]}
        onPress={handleEdit}
        onLongPress={handleDelete}
        isLast={isLast}
      />
    );
  }, [theme, t, accountNameMap, receiptMap, handleEdit, handleDelete]);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <GestureDetector gesture={swipeGesture}>
      <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>

        {/* Guest mode banner */}
        {isGuest && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={16} color="#FFF" />
            <Text style={styles.guestBannerText}>
              Guest mode — data is on this device only. Tap to sign in.
            </Text>
          </TouchableOpacity>
        )}

        {/* Swipe hint */}
        {showSwipeHint && (
          <View style={[styles.swipeHint, { backgroundColor: theme.card }]}>
            <Ionicons name="swap-horizontal-outline" size={16} color={theme.tint} />
            <Text style={[styles.swipeHintText, { color: theme.secondaryText }]}>
              Swipe left or right to navigate months
            </Text>
          </View>
        )}

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
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilterDrawer(true); }}
            >
              <Ionicons name="filter-outline" size={20} color={activeFilters.type !== 'all' || activeFilters.categories.length > 0 || activeFilters.amountMin || activeFilters.amountMax ? theme.tint : theme.text} />
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
                  getItemLayout={getItemLayout}
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
                      <Ionicons name="receipt-outline" size={56} color={theme.secondaryText} />
                      <ThemedText style={[styles.emptyText, { marginTop: 12 }]}>{t('no_transactions')}</ThemedText>
                      <Text style={[styles.emptySubText, { color: theme.secondaryText }]}>
                        Tap + to add your first transaction
                      </Text>
                    </View>
                  }
                />
              )}

              {/* Weekly summary */}
              {viewMode === 'weekly' && (
                <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                  <WeeklyView transactions={allTransactions} />
                </ScrollView>
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
          <Ionicons name="add" size={28} color={theme.tintText} />
        </TouchableOpacity>

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
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText:     { fontSize: 18, fontWeight: '800' },
  headerIcons:   { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerIconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  notifDot:      { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: '#FFF' },

  undoToast:    { position: 'absolute', bottom: 100, left: 16, right: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  undoText:     { fontSize: 14, fontWeight: '500' },
  undoBtn:      { paddingLeft: 16 },
  undoBtnText:  { fontSize: 14, fontWeight: '800' },
  guestBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF9500', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  guestBannerText: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '600' },
  swipeHint:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  swipeHintText: { fontSize: 13 },

  listContent:   { paddingBottom: 120 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 120, paddingTop: 4 },
  card:          { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  empty:         { marginTop: 56, alignItems: 'center' },
  emptyText:     { fontSize: 15, fontWeight: '700' },
  emptySubText:  { fontSize: 13, marginTop: 6 },
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
