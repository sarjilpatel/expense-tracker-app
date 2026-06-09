import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/src/context/ThemeContext';
import { getAnalytics, getTrend } from '@/src/services/dataService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Currency, TYPE_SCALE } from '@/constants/theme';
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

export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();

  const [viewMode, setViewMode]           = useState<ViewMode>('overview');
  const [activeTab, setActiveTab]         = useState<'expense' | 'income' | 'total'>('expense');
  const [loading, setLoading]             = useState(false);
  const [trendLoading, setTrendLoading]   = useState(false);
  const [data, setData]                   = useState<any>(null);
  const [trendData, setTrendData]         = useState<any[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [currentMonth, setCurrentMonth]   = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear]     = useState(new Date().getFullYear());
  const [showDatePicker, setShowDatePicker] = useState(false);

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
      const analyticsData = await getAnalytics(currentMonth, currentYear);
      await setCachedAnalytics(analyticsData, currentMonth, currentYear);
      setData(analyticsData);
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
        <Text style={{ fontSize: 8, color: theme.secondaryText, width: 30, textAlign: 'center' }}>
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

        {/* ── Header — always visible ── */}
        <View style={styles.header}>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={16}>
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <ThemedText style={styles.title}>
                {MONTHS[currentMonth - 1]} {currentYear}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={16}>
              <Ionicons name="chevron-forward" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs — always visible ── */}
        <View style={[styles.modeTabs, { backgroundColor: theme.card }]}>
          {(['overview', 'trends'] as ViewMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeTab, viewMode === mode && { backgroundColor: theme.tint }]}
              onPress={() => setViewMode(mode)}
            >
              <Ionicons
                name={mode === 'overview' ? 'pie-chart' : 'trending-up'}
                size={12}
                color={viewMode === mode ? theme.tintText : theme.secondaryText}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.modeTabText, { color: viewMode === mode ? theme.tintText : theme.secondaryText }]}>
                {mode === 'overview' ? 'Overview' : 'Trends'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
                      <View style={styles.donutWrap}>
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
                  </View>

                  <View style={[styles.tabBar, { backgroundColor: theme.card, marginBottom: 16 }]}>
                    {(['expense', 'income', 'total'] as const).map(tab => {
                      const isActive = activeTab === tab;
                      const activeBg = tab === 'expense' ? theme.expense : tab === 'income' ? theme.income : theme.tint;
                      const activeTextColor = tab === 'expense' ? theme.expenseText : tab === 'income' ? theme.incomeText : theme.tintText;
                      
                      const amountVal = tab === 'expense'
                        ? (data?.totalExpense || 0)
                        : tab === 'income'
                        ? (data?.totalIncome || 0)
                        : (data?.balance || 0);

                      return (
                        <TouchableOpacity
                          key={tab}
                          style={[styles.tab, isActive && { backgroundColor: activeBg }]}
                          onPress={() => setActiveTab(tab)}
                        >
                          <ThemedText style={[styles.tabText, isActive && { color: activeTextColor, fontWeight: '700' }]}>
                            {tab === 'expense' ? t('expenses') : tab === 'income' ? t('income') : 'Total'}
                          </ThemedText>
                          <Text style={[styles.tabSubText, { color: isActive ? activeTextColor : theme.secondaryText }]}>
                            {Currency.format(amountVal)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {sortedCategories.length > 0 && (
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
                            />
                          );
                        })}
                      </View>
                    </>
                  )}

                  {(() => {
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
                                    <ThemedText style={{ color: theme.tint, fontWeight: '700' }}>{item.user?.name?.charAt(0)}</ThemedText>
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

                  {(total || 0) > 0 && (
                    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.insightCard, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                      <Ionicons name="bulb-outline" size={20} color={theme.tint} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <ThemedText style={styles.insightTitle}>Daily average</ThemedText>
                        <ThemedText style={styles.insightBody}>
                          You {activeTab === 'total' ? 'transacted' : activeTab === 'expense' ? 'spent' : 'earned'}{' '}
                          <Text style={{ color: theme.tint, fontWeight: '800' }}>
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
                            yAxisTextStyle={{ color: theme.secondaryText, fontSize: 9 }}
                            xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
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
                                <ThemedText style={[styles.monthlyLabel, isCurrentMonth && { color: theme.tint, fontWeight: '800' }]}>
                                  {d.monthLabel} {d.year}
                                </ThemedText>
                                <View style={styles.monthlySubRow}>
                                  <Text style={{ color: theme.income,  fontSize: 11, fontWeight: '600' }}>+{Currency.format(d.income)}</Text>
                                  <Text style={{ color: theme.secondaryText, fontSize: 11, marginHorizontal: 4 }}>·</Text>
                                  <Text style={{ color: theme.expense, fontSize: 11, fontWeight: '600' }}>-{Currency.format(d.expense)}</Text>
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
                            yAxisTextStyle={{ color: theme.secondaryText, fontSize: 9 }}
                            xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
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
              />
            </View>
          </>
        )}

      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 6, marginBottom: 8, height: 36, flexDirection: 'row', alignItems: 'center' },
  monthSelector:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:        { fontSize: 17, lineHeight: 20, fontWeight: '800' },

  modeTabs:     { flexDirection: 'row', marginHorizontal: 8, borderRadius: 12, padding: 2, marginBottom: 6, gap: 4 },
  modeTab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 9 },
  modeTabText:  { fontSize: 12, fontWeight: '700' },

  scrollContent:{ paddingHorizontal: 8, paddingBottom: 96, paddingTop: 2 },

  compRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  netCard:      { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10, alignItems: 'center', justifyContent: 'center' },
  netLabel:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  netValue:     { fontSize: 28, fontWeight: '900', marginBottom: 6 },
  savingsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18, borderWidth: 1 },
  savingsText:  { fontSize: 11, fontWeight: '700' },

  tabBar:       { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 12, gap: 4 },
  tab:          { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 10 },
  tabText:      { fontSize: 13, fontWeight: '600' },
  tabSubText:   { fontSize: 11, fontWeight: '700', marginTop: 1 },

  donutWrap:          { alignItems: 'center', marginBottom: 10 },

  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  catSection:   { borderRadius: 14, padding: 13, gap: 12 },

  memberList:   { gap: 12 },
  memberCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14 },
  memberInfo:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberPhoto:  { width: 40, height: 40, borderRadius: 20 },
  memberPhotoPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  memberName:   { fontSize: 15, fontWeight: '600' },
  memberMeta:   { fontSize: 12 },
  memberAmount: { fontSize: 16, fontWeight: '800' },

  insightCard:  { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 14, marginTop: 8 },
  insightTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  insightBody:  { fontSize: 13, lineHeight: 18 },

  chartCard:    { borderRadius: 16, padding: 12, alignItems: 'center' },
  trendLegend:  { flexDirection: 'row', gap: 12, alignSelf: 'flex-start', marginBottom: 10 },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendLegendDot:  { width: 10, height: 10, borderRadius: 5 },
  trendLegendText: { fontSize: 12, fontWeight: '600' },

  monthlyList:  { gap: 9 },
  monthlyItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, borderRadius: 14 },
  monthlyLeft:  { gap: 4 },
  monthlyLabel: { fontSize: 14, fontWeight: '700' },
  monthlySubRow:{ flexDirection: 'row', alignItems: 'center' },
  monthlyNet:   { fontSize: 15, fontWeight: '900' },

  emptyChart:   { alignItems: 'center', paddingVertical: 60 },
  emptyText:    { textAlign: 'center', fontSize: 13, paddingVertical: 20 },
  pickerWrap:   { position: 'absolute', left: 12, right: 12, zIndex: 1000 },
});
