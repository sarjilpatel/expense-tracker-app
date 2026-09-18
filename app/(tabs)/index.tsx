import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, RefreshControl, TextInput,
  Alert, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { runSync, subscribeChanges } from '@/src/sync/engine';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getPeriodRange, getPeriodLabel, filterByPeriod, getCalendarMonthsForPeriod } from '@/src/utils/dateUtils';
import { sendLocalNotification, getLargeTransactionThreshold } from '@/src/services/notificationService';
import {
  getAllTransactions, deleteTransaction, restoreTransaction, getBudgets,
  getAccounts, getTxAccountMap,
} from '@/src/services/dataService';
import { getReceiptMap } from '@/src/services/receiptService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { space, type as text, icon as iconSize, radius } from '@/constants/tokens';
import { Card, Row, Touchable, Button, Sheet, Amount, Field, type SheetHandle } from '@/components/ui';

import { ViewModeTabs, HomeViewMode } from '@/components/home/ViewModeTabs';
import { FilterDrawer, FilterState, DEFAULT_FILTERS } from '@/components/home/FilterDrawer';
import { TransactionRow } from '@/components/home/TransactionRow';
import { MonthYearPicker } from '@/components/home/MonthYearPicker';
import { TransactionSectionHeader } from '@/components/home/TransactionSectionHeader';
import { CalendarView } from '@/components/home/CalendarView';
import { MonthlyView } from '@/components/home/MonthlyView';
import { TotalView } from '@/components/home/TotalView';
import { WeeklyView } from '@/components/home/WeeklyView';
import { NoteView } from '@/components/home/NoteView';
import { NotificationsModal, Notification } from '@/components/home/NotificationsModal';

import { reportError } from '@/src/utils/log';
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
  const [budget, setBudget] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [viewMode, setViewMode] = useState<HomeViewMode>('daily');
  const [monthLoading, setMonthLoading] = useState(false);
  const [accountNameMap, setAccountNameMap] = useState<Record<string, string>>({});
  const [receiptMap, setReceiptMap] = useState<Record<string, string>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [undoState, setUndoState] = useState<{ txId: string; tx: any; accountId?: string } | null>(null);
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

  // ── Compute summary from transaction array ────────────────────────────────
  const computeSummary = useCallback((txList: any[]) => {
    const inc = txList.filter((tx: any) => tx.type === 'income').reduce((s: number, tx: any) => s + tx.amount, 0);
    const exp = txList.filter((tx: any) => tx.type === 'expense').reduce((s: number, tx: any) => s + tx.amount, 0);
    return { income: inc, expense: exp, balance: inc - exp };
  }, []);

  // ── Fetch: the local store, which answers from memory ─────────────────────
  // The Monthly tab reads the whole year; every other tab reads the month. That is the only thing
  // about the view mode the fetch cares about, so switching between Daily, Weekly, Calendar, Total
  // and Note re-renders what is already loaded and fetches nothing.
  const isMonthlyView = viewMode === 'monthly';
  const fetchData = useCallback(async () => {
    const monthlyStart = prefs.monthlyStart;
    const monthParam = isMonthlyView ? undefined : currentMonth;

    // A skeleton only before anything has ever loaded. A month change or a view switch keeps
    // what is on screen until the new rows land, which is a frame later — the read is in memory.
    if (!hasData.current) setMonthLoading(true);

    try {
      let txData: any[];

      if (!isMonthlyView && monthlyStart > 1) {
        // Fetch both months that the custom period spans
        const months = getCalendarMonthsForPeriod(currentMonth, currentYear, monthlyStart);
        const results = await Promise.all(months.map(m => getAllTransactions(m.month, m.year)));
        const combined = (results as any[][]).flat();
        const { start, end } = getPeriodRange(currentMonth, currentYear, monthlyStart);
        txData = filterByPeriod(combined, start, end);
      } else {
        const raw = await getAllTransactions(monthParam, currentYear);
        txData = Array.isArray(raw) ? raw : [];
      }

      const [budgetsData] = await Promise.all([getBudgets()]);
      const budgetList: any[] = Array.isArray(budgetsData) ? budgetsData : [];

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
      reportError(err);
    } finally {
      setRefreshing(false);
      setMonthLoading(false);
      contentOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [currentMonth, currentYear, isMonthlyView, computeSummary, prefs.monthlyStart]);

  useFocusRefresh(useCallback(() => { fetchData(); }, [fetchData]));

  // ── Other devices' changes ────────────────────────────────────────────────
  // Rows from the rest of the group arrive through the sync engine's pull (W3-22), not as socket
  // payloads: when one lands while this screen is open, refetch from the local store and note
  // who added what for the bell.
  useEffect(() => {
    return subscribeChanges(changes => {
      const others = changes.filter(c => c.collection === 'transactions' && !c.deleted && c.row?.userId && String(c.row.userId?._id ?? c.row.userId) !== String(user?._id));
      for (const c of others) {
        const tx = c.row;
        if (tx.amount >= getLargeTransactionThreshold(tx.currency)) {
          sendLocalNotification('New group transaction recorded', `A large ${tx.type} was added by a group member`);
        }
        setNotifications(prev => [{
          id: c.clientId,
          type: tx.type,
          title: 'A group member added a transaction',
          message: `${tx.type === 'expense' ? '-' : '+'}₹${tx.amount} · ${tx.category}`,
          time: new Date(tx.date || tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        }, ...prev].slice(0, 20));
      }
      if (changes.some(c => c.collection === 'transactions' || c.collection === 'budgets')) fetchData();
    });
  }, [user, fetchData]);


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

  // Accounts and the tx→account map only change through this device's own writes, so a focus
  // never needs to refetch them on time alone — only after a write (W3-04).
  useFocusRefresh(useCallback(() => { loadAccountMap(); }, [loadAccountMap]), Infinity);

  const loadReceiptMap = useCallback(async () => {
    try { setReceiptMap(await getReceiptMap()); } catch {}
  }, []);

  useFocusRefresh(useCallback(() => { loadReceiptMap(); }, [loadReceiptMap]), Infinity);

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetchData();
  }, [currentMonth, currentYear, isMonthlyView]);

  // Pull-to-refresh is a sync, not a refetch: the device already has the data; the server may have more (W3-20).
  const onRefresh = async () => { setRefreshing(true); await runSync('manual').catch(() => {}); fetchData(); };

  // ── Month navigation ──────────────────────────────────────────────────────
  const changeMonth = useCallback((delta: number, isGesture = false) => {
    const slideOutTarget = delta > 0 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const slideInStart = delta > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;

    const performStateChangeAndSlideIn = () => {
        if (viewMode === 'monthly') {
          setCurrentYear(y => y + delta);
        } else {
          setCurrentMonth(m => {
            const newM = m + delta;
            if (newM > 12) { setCurrentYear(y => y + 1); return 1; }
            if (newM < 1)  { setCurrentYear(y => y - 1); return 12; }
            return newM;
          });
        }
        translateX.value = 0; // instantly reset position without sliding
        contentOpacity.value = withTiming(1, { duration: 200 });
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
            runOnJS(changeMonth)(1, true);
          } else if (e.translationX > threshold) {
            runOnJS(changeMonth)(-1, true);
          } else {
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
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter((tx: any) =>
        (tx.note && tx.note.toLowerCase().includes(q)) ||
        (tx.category && tx.category.toLowerCase().includes(q)) ||
        (accountNameMap[tx._id] && accountNameMap[tx._id].toLowerCase().includes(q))
      );
    }
    return txs;
  }, [allTransactions, activeFilters, searchQuery, accountNameMap]);

  const filteredSections = useMemo(() => {
    return buildSections(filteredTransactions);
  }, [filteredTransactions]);

  const activeFilterCount =
    (activeFilters.type !== 'all' ? 1 : 0) +
    activeFilters.categories.length +
    (activeFilters.amountMin ? 1 : 0) +
    (activeFilters.amountMax ? 1 : 0);

  const ITEM_HEIGHT   = 56;
  const HEADER_HEIGHT = 46;

  const [actionSheet, setActionSheet] = useState<{ item: any } | null>(null);
  const actionSheetRef = useRef<SheetHandle>(null);
  const openActionSheet = (item: any) => { setActionSheet({ item }); actionSheetRef.current?.present(); };

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
  const handleDelete = useCallback(async (id: string) => {
    const removed = allTransactions.find(tx => tx._id === id);
    if (!removed) return;
    // The account link goes with the row; keep it so an undo can put it back.
    const accountId = (await getTxAccountMap().catch(() => ({} as Record<string, string>)))[id];

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
    setUndoState({ txId: id, tx: removed, accountId });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
    }, 5000);
  }, [allTransactions, currentMonth, currentYear]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const { txId, tx, accountId } = undoState;
    setUndoState(null);
    try {
      // The row left the device on delete; the undo re-creates it from the copy the toast kept.
      await restoreTransaction(txId, { ...tx, accountId: accountId ?? null });
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
        isRecurring: String(!!item.isRecurring),
        recurrenceFrequency: item.recurrenceFrequency ?? '',
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
        hasReceipt={!!receiptMap[flatItem.item._id] || !!flatItem.item.receiptKey}
        onPress={handleEdit}
        onLongPress={(id) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openActionSheet(flatItem.item); }}
        // The day header is the top of this card, so the first row is not a first edge: no top
        // border, no top corners.
        isFirst={false}
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
              <Button label="Add transaction" icon="add" onPress={() => router.push('/add-transaction')} block={false} />
            </View>
          }
        />
      );
    }

    if (viewMode === 'note') {
      return (
        <NoteView
          transactions={filteredTransactions}
          theme={theme}
          t={t}
          onTransactionPress={handleEdit}
          refreshControl={commonScrollProps.refreshControl}
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
      </ScrollView>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: top + space.sm }]}>

        {/* Compact Header */}
        <View style={styles.topBlock}>
          <View style={styles.header}>
            {isSearching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: space.sm, height: 36, backgroundColor: theme.inputBg, borderRadius: radius.md, paddingHorizontal: space.sm }}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('search') || 'Search...'}
                  placeholderTextColor={theme.secondaryText}
                  autoFocus
                  style={[text.body, { flex: 1, color: theme.text, paddingVertical: 0, height: 36 }]}
                  accessibilityLabel="Search transactions"
                />
                <Touchable
                  style={styles.headerIconBtn}
                  size={32}
                  onPress={() => {
                    setIsSearching(false);
                    setSearchQuery('');
                  }}
                  accessibilityLabel="Cancel search"
                  rippleBorderless
                >
                  <Ionicons name="close" size={iconSize.md} color={theme.text} />
                </Touchable>
              </View>
            ) : (
              <>
                <View style={styles.monthSelector}>
                  <Touchable onPress={() => changeMonth(-1)} size={28} haptic="selection" accessibilityLabel="Previous month" rippleBorderless>
                    <Ionicons name="chevron-back" size={iconSize.md} color={theme.text} />
                  </Touchable>
                  <Touchable onPress={() => setShowDatePicker(true)} haptic="selection" accessibilityLabel="Choose month">
                    <Text style={[text.heading, { color: theme.text }]}>
                      {viewMode === 'monthly' ? String(currentYear) : `${MONTHS[currentMonth - 1]} ${currentYear}`}
                    </Text>
                  </Touchable>
                  <Touchable onPress={() => changeMonth(1)} size={28} haptic="selection" accessibilityLabel="Next month" rippleBorderless>
                    <Ionicons name="chevron-forward" size={iconSize.md} color={theme.text} />
                  </Touchable>
                </View>
                <View style={styles.headerIcons}>
                  <Touchable
                    style={[styles.headerIconBtn, activeFilterCount > 0 && { backgroundColor: theme.tint }]}
                    size={32}
                    onPress={() => setShowFilterDrawer(true)}
                    accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
                    rippleBorderless
                  >
                    <Ionicons name={activeFilterCount > 0 ? 'filter' : 'filter-outline'} size={iconSize.md} color={activeFilterCount > 0 ? theme.tintText : theme.text} />
                  </Touchable>
                  {activeFilterCount > 0 && (
                    <Touchable
                      style={styles.headerIconBtn}
                      size={32}
                      onPress={() => setActiveFilters(DEFAULT_FILTERS)}
                      accessibilityLabel="Clear filters"
                      rippleBorderless
                    >
                      <Ionicons name="close-circle-outline" size={iconSize.md} color={theme.tint} />
                    </Touchable>
                  )}
                  <Touchable style={styles.headerIconBtn} size={32} onPress={() => setIsSearching(true)} accessibilityLabel="Search" rippleBorderless>
                    <Ionicons name="search-outline" size={iconSize.md} color={theme.text} />
                  </Touchable>
                  <Touchable style={styles.headerIconBtn} size={32} onPress={() => setShowNotifications(true)} accessibilityLabel={notifications.length > 0 ? `Notifications, ${notifications.length} new` : 'Notifications'} rippleBorderless>
                    <Ionicons name="options-outline" size={iconSize.md} color={theme.text} />
                    {notifications.length > 0 && <View style={[styles.notifDot, { backgroundColor: theme.danger, borderColor: theme.background }]} />}
                  </Touchable>
                </View>
              </>
            )}
          </View>

          <ViewModeTabs
            active={viewMode}
            onPress={setViewMode}
            tintColor={theme.tint}
            secondaryText={theme.secondaryText}
          />

          <View style={styles.summaryRow}>
            {([
              { key: 'all',     label: 'Balance', icon: 'wallet-outline', value: summary.income - summary.expense, kind: 'neutral' as const, color: theme.text,
                onPress: () => setActiveFilters(DEFAULT_FILTERS) },
              { key: 'income',  label: 'Income',  icon: 'arrow-up',       value: summary.income,  kind: 'income'  as const, color: theme.income,
                onPress: () => setActiveFilters(prev => ({ ...prev, type: 'income' })) },
              { key: 'expense', label: 'Expense', icon: 'arrow-down',     value: summary.expense, kind: 'expense' as const, color: theme.expense,
                onPress: () => setActiveFilters(prev => ({ ...prev, type: 'expense' })) },
            ]).map(card => {
              const active = activeFilters.type === card.key;
              return (
                <Card
                  key={card.key}
                  onPress={card.onPress}
                  accessibilityLabel={`${card.label}, ${active ? 'showing' : 'tap to filter'}`}
                  style={[styles.summaryCard, active && { borderColor: card.color, borderWidth: 1.5 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Ionicons name={card.icon as any} size={14} color={card.color} />
                    <Text style={[text.label, { color: theme.secondaryText, fontSize: 11 }]}>{card.label}</Text>
                  </View>
                  <Amount value={card.value} kind={card.kind} unsigned role="label" color={card.color} style={{ fontSize: 15 }} />
                </Card>
              );
            })}
          </View>
        </View>

        

      {/* Keep horizontal month swipes inside the transaction area so they never intercept header taps. */}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {renderModeContent()}
        </Animated.View>
      </GestureDetector>

        

        {/* Notifications */}
        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          theme={theme}
        />

        

        {/* Long-press actions */}
        <Sheet ref={actionSheetRef} onDismiss={() => setActionSheet(null)} keyboard="none">
          {actionSheet && (
            <>
              <View style={styles.actionPreview}>
                <Text style={[text.label, { color: theme.secondaryText }]}>{actionSheet.item.category}</Text>
                <Amount value={actionSheet.item.amount} kind={actionSheet.item.type === 'expense' ? 'expense' : 'income'} role="heading" />
              </View>
              <Card padded={false}>
                <Row icon="create-outline" title="Edit" onPress={() => { actionSheetRef.current?.dismiss(); handleEdit(actionSheet.item); }} />
                <Row danger icon="trash-outline" title="Delete" onPress={() => { const id = actionSheet.item._id; actionSheetRef.current?.dismiss(); handleDelete(id); }} last />
              </Card>
            </>
          )}
        </Sheet>

        {/* Undo toast */}
        {undoState && (
          <View style={[styles.undoToast, { backgroundColor: theme.text }]}>
            <Text style={[styles.undoText, { color: theme.background }]}>Transaction deleted</Text>
            <Touchable onPress={handleUndo} style={styles.undoBtn} accessibilityLabel="Undo delete" rippleBorderless>
              <Text style={[text.label, { color: theme.tint }]}>UNDO</Text>
            </Touchable>
          </View>
        )}

        {/* Month/Year Picker */}
        <MonthYearPicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedMonth={currentMonth}
          selectedYear={currentYear}
          onSelect={(month, year) => {
            setCurrentMonth(month);
            setCurrentYear(year);
          }}
          showYearOnly={viewMode === 'monthly'}
        />

        {/* Filter Drawer */}
        <FilterDrawer
          visible={showFilterDrawer}
          onClose={() => setShowFilterDrawer(false)}
          onApply={setActiveFilters}
          availableCategories={availableCategories as string[]}
          current={activeFilters}
        />

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  actionPreview: { alignItems: 'center', gap: 2, marginBottom: space.md },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 36, marginBottom: space.sm },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerIcons:   { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  headerIconBtn: { width: 32, height: 32, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  notifDot:      { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: radius.full, borderWidth: 1.5 },

  topBlock: {
    marginHorizontal: space.sm,
    marginBottom: space.xs,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  summaryCard:   { flex: 1, alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 10 },

  budgetCard: {
    marginHorizontal: 12,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: { ...text.label },
  budgetPercent: { ...text.label },
  budgetTrack: {
    height: 6,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: radius.sm,
  },

  // eslint-disable-next-line local/design-tokens -- a shadow is black by definition; this one floats over content
  undoToast:    { position: 'absolute', bottom: 100, left: 12, right: 12, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: space.lg, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  undoText:     { ...text.label },
  undoBtn:      { paddingLeft: 16 },
  undoBtnText:  { ...text.label },
  swipeHint:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: space.sm, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 8 },
  swipeHintText: { ...text.label },

  listContent:   { paddingBottom: 108, paddingTop: 4 },
  scrollContent: { paddingHorizontal: 8, paddingBottom: 108, paddingTop: 4 },
  empty:         { marginTop: 28, alignItems: 'center', paddingHorizontal: 16 },
  emptyText:     { ...text.heading },
  emptySubText:  { ...text.label, marginTop: space.sm, textAlign: 'center' },
  noteCard:      { flexDirection: 'row', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: space.md },
  noteColorBar:  { width: 4 },
  noteBody:      { flex: 1, padding: space.lg, gap: 4 },
  noteTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteCat:       { ...text.overline },
  noteAmt:       { ...text.label },
  noteText:      { ...text.label },
  noteDate:      { ...text.label, marginTop: 2 },

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
    borderRadius: radius.full,
  },
  emptyWalletBody: {
    width: 100,
    height: 64,
    borderRadius: radius.md,
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
    borderTopLeftRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
  },
  emptyWalletSnap: {
    position: 'absolute',
    right: 12,
    top: 26,
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
});


