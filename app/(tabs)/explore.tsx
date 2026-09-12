import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/src/context/ThemeContext';
import { getAnalytics, getTrend, getAllTransactions, getBudgets } from '@/src/services/dataService';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Currency } from '@/constants/theme';
import { space, type as text, icon as iconSize, weight, radius } from '@/constants/tokens';
import { Card, Row, Touchable, Sheet, Amount, EmptyState, Chip, type SheetHandle } from '@/components/ui';
import { CategoryBar } from '@/components/analytics/CategoryBar';
import { ConnectedDonutChart } from '@/components/analytics/ConnectedDonutChart';
import { MONTHS, CATEGORY_COLORS, CATEGORY_EMOJIS, EXPENSE_PALETTE, INCOME_PALETTE } from '@/constants/maps';
import {
  getCachedAnalytics, setCachedAnalytics,
  getCachedTrend, setCachedTrend,
} from '@/src/cache/transactionCache';
import { MonthYearPicker } from '@/components/home/MonthYearPicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'overview' | 'trends';
type ActiveTab = 'expense' | 'income' | 'total' | 'budget';

export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();

  const [viewMode, setViewMode]           = useState<ViewMode>('overview');
  const [activeTab, setActiveTab]         = useState<ActiveTab>('expense');
  const [budgets, setBudgets]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(false);
  const [trendLoading, setTrendLoading]   = useState(false);
  const [data, setData]                   = useState<any>(null);
  const [trendData, setTrendData]         = useState<any[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [currentMonth, setCurrentMonth]   = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear]     = useState(new Date().getFullYear());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryModal, setCategoryModal] = useState<{ category: string; color: string } | null>(null);
  const categorySheet = useRef<SheetHandle>(null);
  const openCategory = (v: { category: string; color: string }) => { setCategoryModal(v); categorySheet.current?.present(); };
  const [categoryTxs, setCategoryTxs] = useState<any[]>([]);

  const hasData   = useRef(false);
  const isMounted = useRef(false);

  const translateX     = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    // Step 1 — serve from cache instantly
    const cached = await getCachedAnalytics(currentMonth, currentYear);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else if (!isSilent) {
      setLoading(true);
    }

    // Step 2 — background API sync
    try {
      const [analyticsData, budgetData] = await Promise.all([
        getAnalytics(currentMonth, currentYear),
        getBudgets(currentMonth, currentYear).catch(() => []),
      ]);
      await setCachedAnalytics(analyticsData, currentMonth, currentYear);
      setData(analyticsData);
      setBudgets(Array.isArray(budgetData) ? budgetData : []);
      hasData.current = true;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      contentOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [currentMonth, currentYear, user?.groupId]);

  const fetchTrend = useCallback(async () => {
    // Step 1 — serve from cache instantly
    const cached = await getCachedTrend();
    if (cached) {
      setTrendData(cached);
      setTrendLoading(false);
    } else {
      setTrendLoading(true);
    }

    // Step 2 — background API sync
    try {
      const raw = await getTrend(6);
      const result: any[] = Array.isArray(raw) ? raw : [];
      await setCachedTrend(result);
      setTrendData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(hasData.current); }, [fetchData]));

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    hasData.current = false;
    fetchData(false);
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (viewMode === 'trends' && trendData.length === 0) fetchTrend();
  }, [viewMode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
    if (viewMode === 'trends') fetchTrend();
  };

  const openCategoryModal = useCallback(async (category: string, color: string) => {
    openCategory({ category, color });
    try {
      const raw = await getAllTransactions(currentMonth, currentYear);
      const all: any[] = Array.isArray(raw) ? raw : [];
      setCategoryTxs(all.filter(tx => tx.category === category)
        .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
    } catch { setCategoryTxs([]); }
  }, [currentMonth, currentYear]);

  // ── Month navigation with swipe animation ────────────────────────────────
  const changeMonth = useCallback((delta: number, isGesture = false) => {
    const slideOutTarget = delta > 0 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const slideInStart   = delta > 0 ?  SCREEN_WIDTH : -SCREEN_WIDTH;

    const performChange = () => {
      translateX.value = slideInStart;
      contentOpacity.value = 0.3;
      setCurrentMonth(m => {
        const newM = m + delta;
        if (newM > 12) { setCurrentYear(y => y + 1); return 1; }
        if (newM < 1)  { setCurrentYear(y => y - 1); return 12; }
        return newM;
      });
      translateX.value = withTiming(0, { duration: 250 });
      contentOpacity.value = withTiming(1, { duration: 250 });
    };

    if (isGesture) {
      performChange();
    } else {
      contentOpacity.value = withTiming(0.3, { duration: 150 });
      translateX.value = withTiming(slideOutTarget, { duration: 150 }, (finished) => {
        if (finished) runOnJS(performChange)();
      });
    }
  }, [SCREEN_WIDTH]);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-20, 20])
      .onUpdate(e => { translateX.value = e.translationX; })
      .onEnd(e => {
        const threshold = SCREEN_WIDTH * 0.25;
        if (e.translationX < -threshold) {
          translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) runOnJS(changeMonth)(1, true);
          });
        } else if (e.translationX > threshold) {
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) runOnJS(changeMonth)(-1, true);
          });
        } else {
          translateX.value = withTiming(0, { duration: 200 });
        }
      }),
    [changeMonth, SCREEN_WIDTH]
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const sortedCategories = useMemo(() => {
    let raw: any[] = [];
    if (activeTab === 'income') {
      raw = data?.incomeBreakdown || [];
    } else if (activeTab === 'expense') {
      raw = data?.categoryBreakdown || [];
    } else {
      // 'total': merge both breakdowns
      const inc = (data?.incomeBreakdown || []).map((c: any) => ({ ...c, itemType: 'income' }));
      const exp = (data?.categoryBreakdown || []).map((c: any) => ({ ...c, itemType: 'expense' }));
      raw = [...inc, ...exp];
    }
    if (raw.length === 0) return [];
    return [...raw].sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0));
  }, [data, activeTab]);

  const pieData = useMemo(() => {
    if (activeTab === 'total') {
      const inc = data?.totalIncome || 0;
      const exp = data?.totalExpense || 0;
      const gross = inc + exp;
      if (gross === 0) return [];
      return [
        {
          value: inc,
          color: theme.income,
          text: `${Math.round((inc / gross) * 100)}%`,
          category: t('income'),
          emoji: CATEGORY_EMOJIS['Income'] ?? '💰',
          percentage: (inc / gross) * 100,
        },
        {
          value: exp,
          color: theme.expense,
          text: `${Math.round((exp / gross) * 100)}%`,
          category: t('expenses'),
          emoji: CATEGORY_EMOJIS['Food'] ?? '💸',
          percentage: (exp / gross) * 100,
        },
      ];
    }
    const palette = activeTab === 'income' ? INCOME_PALETTE : EXPENSE_PALETTE;
    return sortedCategories.map((item: any, i: number) => {
      const color = CATEGORY_COLORS[item.category] ?? palette[i % palette.length];
      return {
        value: item.amount,
        color,
        text: `${Math.round(item.percentage)}%`,
        category: t(item.category),
        emoji: CATEGORY_EMOJIS[item.category] ?? '🏷️',
        percentage: item.percentage,
      };
    });
  }, [sortedCategories, theme.income, theme.expense, activeTab, t, data]);

  const total = activeTab === 'total'
    ? (data?.totalIncome || 0) + (data?.totalExpense || 0)
    : activeTab === 'income' ? data?.totalIncome : data?.totalExpense;

  const trendLineIncome  = useMemo(() => trendData.map(d => ({ value: d.income,  label: d.monthLabel })), [trendData]);
  const trendLineExpense = useMemo(() => trendData.map(d => ({ value: d.expense, label: d.monthLabel })), [trendData]);

  const netBarData = useMemo(() =>
    trendData.map(d => ({
      value: Math.abs(d.net),
      label: d.monthLabel,
      frontColor: d.net >= 0 ? theme.income : theme.expense,
      topLabelComponent: () => (
        <Text style={{ ...text.label, color: theme.secondaryText, width: 30, textAlign: 'center' }}>
          {d.net >= 0 ? '+' : '-'}{Currency.format(Math.abs(d.net))}
        </Text>
      ),
    })),
  [trendData, theme]);

  const maxTrend = useMemo(() => {
    const vals = trendData.flatMap(d => [d.income, d.expense]);
    return Math.max(...vals, 1) * 1.2;
  }, [trendData]);

  return (
    <GestureDetector gesture={swipeGesture}>
      <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>

        {/* ── Header — month selector + view mode toggle ── */}
        <View style={styles.header}>
          <View style={styles.monthSelector}>
            <Touchable onPress={() => changeMonth(-1)} size={28} haptic="selection" accessibilityLabel="Previous month" rippleBorderless>
              <Ionicons name="chevron-back" size={iconSize.md} color={theme.text} />
            </Touchable>
            <Touchable onPress={() => setShowDatePicker(true)} haptic="selection" accessibilityLabel="Choose month">
              <Text style={[text.heading, { color: theme.text }]}>
                {MONTHS[currentMonth - 1]} {currentYear}
              </Text>
            </Touchable>
            <Touchable onPress={() => changeMonth(1)} size={28} haptic="selection" accessibilityLabel="Next month" rippleBorderless>
              <Ionicons name="chevron-forward" size={iconSize.md} color={theme.text} />
            </Touchable>
          </View>

          {/* Overview / Trends icon toggle */}
          <View style={styles.viewToggle}>
            {(['overview', 'trends'] as ViewMode[]).map(mode => (
              <Chip
                key={mode}
                size="sm"
                icon={mode === 'overview' ? 'pie-chart' : 'trending-up'}
                label={mode === 'overview' ? 'Overview' : 'Trends'}
                selected={viewMode === mode}
                onPress={() => setViewMode(mode)}
              />
            ))}
          </View>
        </View>

        {/* ── Category tabs — fixed position, only in overview ── */}
        {viewMode === 'overview' && (
          <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
            {(['expense', 'income', 'total', 'budget'] as const).map(tab => {
              const isActive = activeTab === tab;
              const activeBg = tab === 'expense' ? theme.expense : tab === 'income' ? theme.income : theme.tint;
              const activeTextColor = tab === 'expense' ? theme.expenseText : tab === 'income' ? theme.incomeText : theme.tintText;
              const mainBudget = budgets.find((b: any) => !b.category);
              const amountVal = tab === 'expense'
                ? (data?.totalExpense || 0)
                : tab === 'income'
                ? (data?.totalIncome || 0)
                : tab === 'budget'
                ? (mainBudget?.amount || 0)
                : (data?.balance || 0);
              return (
                <Touchable
                  key={tab}
                  style={[styles.tab, isActive && { backgroundColor: activeBg }]}
                  onPress={() => setActiveTab(tab)}
                  haptic="selection"
                  accessibilityLabel={`${tab === 'expense' ? t('expenses') : tab === 'income' ? t('income') : tab === 'budget' ? 'Budget' : 'Total'}${isActive ? ', selected' : ''}`}
                >
                  <Text style={[text.label, { color: isActive ? activeTextColor : theme.secondaryText }]}>
                    {tab === 'expense' ? t('expenses') : tab === 'income' ? t('income') : tab === 'budget' ? 'Budget' : 'Total'}
                  </Text>
                  <Text style={[text.label, { color: isActive ? activeTextColor : theme.secondaryText, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                    {tab === 'budget' && !mainBudget ? 'Not set' : Currency.format(amountVal)}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        )}

        {/* ── Content — animated, skeleton only here ── */}
        <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {loading && !refreshing ? (
            <View style={{ paddingTop: 12 }}>
              <SkeletonLoader type="card" />
              <SkeletonLoader type="chart" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
              showsVerticalScrollIndicator={false}
            >

              {/* ════════════ OVERVIEW ════════════ */}
              {viewMode === 'overview' && (
                <>
                      {/* ── Budget View ── */}
                  {activeTab === 'budget' && (() => {
                    const mainBudget = budgets.find((b: any) => !b.category);
                    const catBudgets = budgets.filter((b: any) => !!b.category);
                    const totalSpent = data?.totalExpense || 0;
                    const mainPct = mainBudget ? Math.min((totalSpent / mainBudget.amount) * 100, 100) : 0;
                    const mainColor = mainPct >= 100 ? theme.expense : mainPct >= 80 ? theme.warning : theme.income;

                    return (
                      <Animated.View entering={FadeIn.duration(250)}>
                        {mainBudget ? (
                          <View style={[styles.budgetCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.budgetCardHeader}>
                              <Ionicons name="wallet-outline" size={18} color={mainColor} />
                              <ThemedText style={styles.budgetCardTitle}>Monthly Budget</ThemedText>
                              <Touchable onPress={() => router.push('/budget')} size={28} accessibilityLabel="Budget settings" rippleBorderless>
                                <Ionicons name="settings-outline" size={iconSize.sm} color={theme.secondaryText} />
                              </Touchable>
                            </View>
                            <View style={styles.budgetAmountRow}>
                              <Text style={[styles.budgetSpent, { color: mainColor }]}>{Currency.format(totalSpent)}</Text>
                              <Text style={[styles.budgetOf, { color: theme.secondaryText }]}> / {Currency.format(mainBudget.amount)}</Text>
                            </View>
                            <View style={[styles.budgetTrack, { backgroundColor: theme.border }]}>
                              <View style={[styles.budgetFill, { width: `${mainPct}%` as any, backgroundColor: mainColor }]} />
                            </View>
                            <View style={styles.budgetMeta}>
                              <Text style={[styles.budgetPct, { color: mainColor }]}>{Math.round(mainPct)}% used</Text>
                              <Text style={[styles.budgetRemain, { color: theme.secondaryText }]}>
                                {mainBudget.amount > totalSpent
                                  ? `${Currency.format(mainBudget.amount - totalSpent)} remaining`
                                  : `${Currency.format(totalSpent - mainBudget.amount)} over budget`}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <Card>
                            <EmptyState compact icon="wallet-outline" title="No monthly budget set" action={{ label: 'Set budget', onPress: () => router.push('/budget') }} />
                          </Card>
                        )}

                        {catBudgets.length > 0 && (
                          <>
                            <View style={styles.sectionHeader}>
                              <ThemedText type="subtitle">Category Budgets</ThemedText>
                              <Ionicons name="grid-outline" size={16} color={theme.secondaryText} />
                            </View>
                            <View style={[styles.catSection, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                              {catBudgets.map((b: any, i: number) => {
                                const catSpent = (data?.categoryBreakdown || []).find((c: any) => c.category === b.category)?.amount || 0;
                                const pct = b.amount > 0 ? Math.min((catSpent / b.amount) * 100, 100) : 0;
                                const bColor = pct >= 100 ? theme.expense : pct >= 80 ? theme.warning : theme.income;
                                return (
                                  <View key={i} style={styles.catBudgetRow}>
                                    <View style={styles.catBudgetTop}>
                                      <Text style={[styles.catBudgetName, { color: theme.text }]}>{b.category}</Text>
                                      <Text style={[styles.catBudgetAmt, { color: bColor }]}>
                                        {Currency.format(catSpent)} / {Currency.format(b.amount)}
                                      </Text>
                                    </View>
                                    <View style={[styles.budgetTrack, { backgroundColor: theme.border }]}>
                                      <View style={[styles.budgetFill, { width: `${pct}%` as any, backgroundColor: bColor }]} />
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        )}
                      </Animated.View>
                    );
                  })()}

                  {/* ── Donut + Categories (non-budget tabs) ── */}
                  {activeTab !== 'budget' && <View style={styles.donutWrap}>
                    {pieData.length > 0 ? (
                      <ConnectedDonutChart
                        slices={pieData}
                        centerTitle={activeTab === 'total' ? 'Flow' : activeTab === 'expense' ? 'Spent' : 'Earned'}
                        centerValue={Currency.format(total || 0)}
                        theme={theme}
                      />
                    ) : (
                      <View style={styles.emptyChart}>
                        <Ionicons name="pie-chart-outline" size={56} color={theme.icon} />
                        <ThemedText style={styles.emptyText}>No data for this month</ThemedText>
                      </View>
                    )}
                  </View>}

                  {activeTab !== 'budget' && sortedCategories.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Category Breakdown</ThemedText>
                        <Ionicons name="bar-chart-outline" size={16} color={theme.secondaryText} />
                      </View>
                      <View style={[styles.catSection, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                        {sortedCategories.map((item: any, i: number) => {
                          const _palette = activeTab === 'income' ? INCOME_PALETTE : EXPENSE_PALETTE;
                          const color = CATEGORY_COLORS[item.category] ?? _palette[i % _palette.length];
                          const pct = activeTab === 'total'
                            ? (total > 0 ? (Number(item.amount) / total) * 100 : 0)
                            : parseFloat(item.percentage);
                          return (
                            <CategoryBar
                              key={`${activeTab}-${item.itemType || activeTab}-${item.category}`}
                              category={t(item.category)}
                              amount={item.amount}
                              percentage={pct}
                              color={color}
                              rank={i}
                              onPress={() => openCategoryModal(item.category, color)}
                            />
                          );
                        })}
                      </View>
                    </>
                  )}

                  {activeTab !== 'budget' && (() => {
                    const filtered = activeTab === 'total'
                      ? (data?.memberBreakdown || [])
                      : (data?.memberBreakdown?.filter((m: any) => m.type === activeTab) || []);
                    if (filtered.length === 0) return null;
                    return (
                      <>
                        <View style={styles.sectionHeader}>
                          <ThemedText type="subtitle">Member Activity</ThemedText>
                          <Ionicons name="people-outline" size={16} color={theme.secondaryText} />
                        </View>
                        <View style={styles.memberList}>
                          {filtered.map((item: any, index: number) => (
                            <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)} style={[styles.memberCard, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                              <View style={styles.memberInfo}>
                                {item.user?.profilePhoto ? (
                                  <Image source={{ uri: item.user.profilePhoto }} style={styles.memberPhoto} />
                                ) : (
                                  <View style={[styles.memberPhotoPlaceholder, { backgroundColor: theme.card }]}>
                                    <ThemedText style={{ color: theme.tint, fontWeight: weight.bold }}>{item.user?.name?.charAt(0)}</ThemedText>
                                  </View>
                                )}
                                <View>
                                  <ThemedText style={styles.memberName}>{item.user?.name}</ThemedText>
                                  <ThemedText style={styles.memberMeta}>{item.percentage}% of total</ThemedText>
                                </View>
                              </View>
                              <Text style={[styles.memberAmount, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                                {Currency.format(item.amount)}
                              </Text>
                            </Animated.View>
                          ))}
                        </View>
                      </>
                    );
                  })()}

                  {activeTab !== 'budget' && (total || 0) > 0 && (
                    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.insightCard, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                      <Ionicons name="bulb-outline" size={20} color={theme.tint} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <ThemedText style={styles.insightTitle}>Daily average</ThemedText>
                        <ThemedText style={styles.insightBody}>
                          You {activeTab === 'total' ? 'transacted' : activeTab === 'expense' ? 'spent' : 'earned'}{' '}
                          <Text style={{ color: theme.tint, fontWeight: weight.bold }}>
                            {Currency.format((total || 0) / new Date(currentYear, currentMonth, 0).getDate())}
                          </Text>{' '}
                          per day this month.
                        </ThemedText>
                      </View>
                    </Animated.View>
                  )}

                </>
              )}

              {/* ════════════ TRENDS ════════════ */}
              {viewMode === 'trends' && (
                <>
                  {trendLoading ? (
                    <><SkeletonLoader type="chart" /><SkeletonLoader type="card" /></>
                  ) : trendData.length === 0 ? (
                    <View style={styles.emptyChart}>
                      <Ionicons name="trending-up-outline" size={56} color={theme.icon} />
                      <ThemedText style={styles.emptyText}>No trend data yet</ThemedText>
                    </View>
                  ) : (
                    <>
                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Income vs Expenses</ThemedText>
                        <Ionicons name="analytics-outline" size={16} color={theme.secondaryText} />
                      </View>
                      <View style={[styles.chartCard, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                        <View style={styles.trendLegend}>
                          <View style={styles.trendLegendItem}>
                            <View style={[styles.trendLegendDot, { backgroundColor: theme.income }]} />
                            <ThemedText style={styles.trendLegendText}>Income</ThemedText>
                          </View>
                          <View style={styles.trendLegendItem}>
                            <View style={[styles.trendLegendDot, { backgroundColor: theme.expense }]} />
                            <ThemedText style={styles.trendLegendText}>Expenses</ThemedText>
                          </View>
                        </View>
                        <ErrorBoundary fallback={<ThemedText style={styles.emptyText}>Chart unavailable</ThemedText>}>
                          <LineChart
                            data={trendLineIncome}
                            data2={trendLineExpense}
                            color1={theme.income}
                            color2={theme.expense}
                            thickness={2.5}
                            curved
                            areaChart
                            startFillColor1={theme.income}
                            startFillColor2={theme.expense}
                            endFillColor1="transparent"
                            endFillColor2="transparent"
                            startOpacity1={0.22}
                            endOpacity1={0}
                            startOpacity2={0.18}
                            endOpacity2={0}
                            dataPointsColor1={theme.income}
                            dataPointsColor2={theme.expense}
                            dataPointsRadius={4}
                            width={SCREEN_WIDTH - 64}
                            height={200}
                            noOfSections={4}
                            maxValue={maxTrend}
                            yAxisTextStyle={{ color: theme.secondaryText, ...text.label }}
                            xAxisLabelTextStyle={{ color: theme.secondaryText, ...text.label }}
                            yAxisThickness={0}
                            xAxisThickness={1}
                            xAxisColor={theme.border}
                            hideRules={false}
                            rulesColor={theme.border}
                            rulesType="dashed"
                            dashWidth={4}
                            dashGap={8}
                          />
                        </ErrorBoundary>
                      </View>

                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Monthly Summary</ThemedText>
                        <Ionicons name="list-outline" size={16} color={theme.secondaryText} />
                      </View>
                      <View style={styles.monthlyList}>
                        {[...trendData].reverse().map((d: any, i: number) => {
                          const isCurrentMonth = d.month === currentMonth && d.year === currentYear;
                          return (
                            <Animated.View key={i} entering={FadeInDown.delay(i * 50).duration(280)} style={[styles.monthlyItem, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }, isCurrentMonth && { borderLeftColor: theme.tint, borderLeftWidth: 3 }]}>
                              <View style={styles.monthlyLeft}>
                                <ThemedText style={[styles.monthlyLabel, isCurrentMonth && { color: theme.tint, fontWeight: weight.bold }]}>
                                  {d.monthLabel} {d.year}
                                </ThemedText>
                                <View style={styles.monthlySubRow}>
                                  <Text style={{ color: theme.income,  ...text.label }}>+{Currency.format(d.income)}</Text>
                                  <Text style={{ color: theme.secondaryText, ...text.label, marginHorizontal: 4 }}>·</Text>
                                  <Text style={{ color: theme.expense, ...text.label }}>-{Currency.format(d.expense)}</Text>
                                </View>
                              </View>
                              <Text style={[styles.monthlyNet, { color: d.net >= 0 ? theme.income : theme.expense }]}>
                                {d.net >= 0 ? '+' : ''}{Currency.format(d.net)}
                              </Text>
                            </Animated.View>
                          );
                        })}
                      </View>

                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Net Balance by Month</ThemedText>
                        <Ionicons name="bar-chart-outline" size={16} color={theme.secondaryText} />
                      </View>
                      <View style={[styles.chartCard, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                        <ErrorBoundary fallback={null}>
                          <BarChart
                            data={netBarData}
                            width={SCREEN_WIDTH - 64}
                            height={160}
                            barWidth={28}
                            spacing={16}
                            noOfSections={3}
                            barBorderRadius={8}
                            yAxisThickness={0}
                            xAxisThickness={0}
                            hideRules
                            yAxisTextStyle={{ color: theme.secondaryText, ...text.label }}
                            xAxisLabelTextStyle={{ color: theme.secondaryText, ...text.label }}
                          />
                        </ErrorBoundary>
                      </View>
                    </>
                  )}
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </Animated.View>

        {/* Category transactions */}
        <Sheet
          ref={categorySheet}
          title={categoryModal?.category ?? ''}
          scroll
          snapPoints={['70%']}
          keyboard="none"
          onDismiss={() => setCategoryModal(null)}
        >
          <Text style={[text.label, { color: theme.secondaryText, marginBottom: space.sm }]}>
            {MONTHS[currentMonth - 1]} {currentYear} · {categoryTxs.length} {categoryTxs.length === 1 ? 'transaction' : 'transactions'}
          </Text>
          {categoryTxs.length === 0 ? (
            <EmptyState compact icon="receipt-outline" title="No transactions" />
          ) : (
            <Card padded={false}>
              {categoryTxs.map((item, i) => {
                const d = new Date(item.date || item.createdAt);
                return (
                  <Row
                    key={item._id}
                    title={item.note || item.category}
                    subtitle={`${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                    right={<Amount value={item.amount} kind={item.type === 'expense' ? 'expense' : 'income'} />}
                    last={i === categoryTxs.length - 1}
                  />
                );
              })}
            </Card>
          )}
        </Sheet>

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
        />

      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 8, marginBottom: space.sm, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthSelector:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:        { ...text.heading },
  viewToggle:   { flexDirection: 'row', borderRadius: radius.md, padding: space.xs, gap: space.xs },
  viewToggleBtn:{ width: 38, height: 30, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },

  scrollContent:{ paddingHorizontal: 8, paddingBottom: 96, paddingTop: 4 },

  compRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  netCard:      { borderRadius: radius.lg, paddingVertical: space.lg, paddingHorizontal: space.lg, marginBottom: space.md, alignItems: 'center', justifyContent: 'center' },
  netLabel:     { ...text.overline, marginBottom: space.sm },
  netValue:     { ...text.title, marginBottom: space.sm },
  savingsBadge: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.lg, borderWidth: 1 },
  savingsText:  { ...text.label },

  tabBar:       { flexDirection: 'row', padding: 4, borderRadius: radius.md, marginHorizontal: 8, marginBottom: 8, gap: 4 },
  tab:          { flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.md },
  tabText:      { ...text.label },
  tabSubText:   { ...text.label, marginTop: 1 },

  donutWrap:          { alignItems: 'center', marginBottom: space.md },

  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: space.sm },
  catSection:   { borderRadius: radius.lg, padding: space.md, gap: 12 },

  memberList:   { gap: 12 },
  memberCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, borderRadius: radius.lg },
  memberInfo:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberPhoto:  { width: 40, height: 40, borderRadius: radius.full },
  memberPhotoPlaceholder: { width: 40, height: 40, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  memberName:   { ...text.bodyStrong },
  memberMeta:   { ...text.label },
  memberAmount: { ...text.bodyStrong },

  insightCard:  { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.lg, marginTop: 8 },
  insightTitle: { ...text.overline, marginBottom: 2 },
  insightBody:  { ...text.label },

  chartCard:    { borderRadius: radius.lg, padding: 12, alignItems: 'center' },
  trendLegend:  { flexDirection: 'row', gap: 12, alignSelf: 'flex-start', marginBottom: space.md },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  trendLegendDot:  { width: 10, height: 10, borderRadius: radius.full },
  trendLegendText: { ...text.label },

  monthlyList:  { gap: space.sm },
  monthlyItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.md, borderRadius: radius.lg },
  monthlyLeft:  { gap: 4 },
  monthlyLabel: { ...text.label },
  monthlySubRow:{ flexDirection: 'row', alignItems: 'center' },
  monthlyNet:   { ...text.bodyStrong },

  emptyChart:   { alignItems: 'center', paddingVertical: 60 },
  emptyText:    { textAlign: 'center', ...text.label, paddingVertical: 20 },

  // Budget tab styles
  budgetCard:         { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  budgetCardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.lg },
  budgetCardTitle:    { flex: 1, ...text.bodyStrong },
  budgetAmountRow:    { flexDirection: 'row', alignItems: 'baseline', marginBottom: space.md },
  budgetSpent:        { ...text.title },
  budgetOf:           { ...text.label },
  budgetTrack:        { height: 8, borderRadius: radius.sm, overflow: 'hidden', marginBottom: 8 },
  budgetFill:         { height: '100%', borderRadius: radius.sm },
  budgetMeta:         { flexDirection: 'row', justifyContent: 'space-between' },
  budgetPct:          { ...text.label },
  budgetRemain:       { ...text.label },
  budgetEmpty:        { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', gap: 12, marginBottom: 12 },
  budgetEmptyText:    { ...text.label },
  budgetSetBtn:       { paddingHorizontal: 20, paddingVertical: space.md, borderRadius: radius.md },
  budgetSetBtnText:   { ...text.label },
  catBudgetRow:       { gap: space.sm, marginBottom: space.md },
  catBudgetTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catBudgetName:      { ...text.label },
  catBudgetAmt:       { ...text.label },
});

