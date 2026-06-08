import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart, BarChart } from 'react-native-gifted-charts';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Currency, hexToRGBA } from '@/constants/theme';
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
import { TYPE_SCALE } from '@/constants/theme';
import { CategoryBar } from '@/components/analytics/CategoryBar';
import { ComparisonCard } from '@/components/analytics/ComparisonCard';
import { MONTHS } from '@/constants/maps';
import {
  getCachedAnalytics, setCachedAnalytics,
  getCachedTrend, setCachedTrend,
} from '@/src/cache/transactionCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'overview' | 'trends';

export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();

  const [viewMode, setViewMode]           = useState<ViewMode>('overview');
  const [activeTab, setActiveTab]         = useState<'expense' | 'income'>('expense');
  const [loading, setLoading]             = useState(false);
  const [trendLoading, setTrendLoading]   = useState(false);
  const [data, setData]                   = useState<any>(null);
  const [trendData, setTrendData]         = useState<any[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [currentMonth, setCurrentMonth]   = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear]     = useState(new Date().getFullYear());

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
    const raw = activeTab === 'income' ? data?.incomeBreakdown : data?.categoryBreakdown;
    if (!raw || raw.length === 0) return [];
    return [...raw].sort((a: any, b: any) => b.amount - a.amount);
  }, [data, activeTab]);

  const pieData = useMemo(() => {
    const baseColor = activeTab === 'income' ? theme.income : theme.expense;
    return sortedCategories.map((item: any, i: number) => {
      const opacity = Math.max(0.2, 1 - i * 0.12);
      const color = hexToRGBA(baseColor, opacity);
      return {
        value: item.amount,
        color: color,
        text: `${Math.round(item.percentage)}%`,
        category: t(item.category),
        percentage: item.percentage,
      };
    });
  }, [sortedCategories, theme.income, theme.expense, activeTab, t]);

  const total = activeTab === 'income' ? data?.totalIncome : data?.totalExpense;

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
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.title}>
              {MONTHS[currentMonth - 1]} {currentYear}
            </ThemedText>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={12}>
              <Ionicons name="chevron-forward" size={22} color={theme.text} />
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
                size={14}
                color={viewMode === mode ? theme.tintText : theme.secondaryText}
                style={{ marginRight: 5 }}
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
            <View style={{ paddingTop: 16 }}>
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
                  <Animated.View entering={FadeIn.duration(300)} style={styles.compRow}>
                    <ComparisonCard label="Income"   current={data?.totalIncome  || 0} previous={data?.previousMonth?.totalIncome  || 0} color={theme.income}  icon="arrow-down-circle" />
                    <ComparisonCard label="Expenses" current={data?.totalExpense || 0} previous={data?.previousMonth?.totalExpense || 0} color={theme.expense} icon="arrow-up-circle" />
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(80).duration(300)} style={[styles.netCard, { backgroundColor: theme.card }]}>
                    <View style={styles.netCardRow}>
                      <View>
                        <ThemedText style={styles.netLabel}>Net Balance</ThemedText>
                        <Text style={[styles.netValue, { color: (data?.balance || 0) >= 0 ? theme.income : theme.expense }]}>
                          {(data?.balance || 0) >= 0 ? '+' : ''}{Currency.format(data?.balance || 0)}
                        </Text>
                      </View>
                      <View style={styles.savingsRate}>
                        {data?.totalIncome > 0 && (
                          <>
                            <ThemedText style={styles.savingsLabel}>Savings rate</ThemedText>
                            <Text style={[styles.savingsValue, { color: theme.tint }]}>
                              {Math.max(0, Math.round(((data.totalIncome - data.totalExpense) / data.totalIncome) * 100))}%
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </Animated.View>

                  <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
                    {(['expense', 'income'] as const).map(tab => (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && { backgroundColor: tab === 'expense' ? theme.expense : theme.income }]}
                        onPress={() => setActiveTab(tab)}
                      >
                        <ThemedText style={[styles.tabText, activeTab === tab && { color: tab === 'expense' ? theme.expenseText : theme.incomeText, fontWeight: '700' }]}>
                          {tab === 'expense' ? t('expenses') : t('income')}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.donutWrap}>
                    {pieData.length > 0 ? (
                      <>
                        <PieChart
                          data={pieData}
                          radius={SCREEN_WIDTH / 3.6}
                          innerRadius={SCREEN_WIDTH / 5.8}
                          showText={false}
                          focusOnPress
                          innerCircleColor={theme.background}
                          centerLabelComponent={() => (
                            <View style={styles.donutCenter}>
                              <Text style={[styles.donutCenterLabel, { color: theme.secondaryText }]}>
                                {activeTab === 'expense' ? 'Spent' : 'Earned'}
                              </Text>
                              <Text style={[styles.donutCenterValue, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                                {Currency.format(total || 0)}
                              </Text>
                            </View>
                          )}
                        />
                        <View style={styles.donutLegendRow}>
                          {pieData.slice(0, Math.min(4, pieData.length)).map((item: any, i: number) => (
                            <View key={i} style={[styles.donutLegendItem, { backgroundColor: theme.card }]}>
                              <View style={[styles.donutLegendDot, { backgroundColor: item.color }]} />
                              <ThemedText style={styles.donutLegendName} numberOfLines={1}>{item.category}</ThemedText>
                              <Text style={[styles.donutLegendPct, { color: item.color }]}>{item.text}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : (
                      <View style={styles.emptyChart}>
                        <Ionicons name="pie-chart-outline" size={56} color={theme.icon} />
                        <ThemedText style={styles.emptyText}>No data for this month</ThemedText>
                      </View>
                    )}
                  </View>

                  {sortedCategories.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Category Breakdown</ThemedText>
                        <Ionicons name="bar-chart-outline" size={16} color={theme.secondaryText} />
                      </View>
                      <View style={[styles.catSection, { backgroundColor: theme.card }]}>
                        {sortedCategories.map((item: any, i: number) => {
                          const baseColor = activeTab === 'income' ? theme.income : theme.expense;
                          const opacity = Math.max(0.2, 1 - i * 0.12);
                          const color = hexToRGBA(baseColor, opacity);
                          return (
                            <CategoryBar
                              key={item.category}
                              category={t(item.category)}
                              amount={item.amount}
                              percentage={parseFloat(item.percentage)}
                              color={color}
                              rank={i}
                            />
                          );
                        })}
                      </View>
                    </>
                  )}

                  {(() => {
                    const filtered = data?.memberBreakdown?.filter((m: any) => m.type === activeTab) || [];
                    if (filtered.length === 0) return null;
                    return (
                      <>
                        <View style={styles.sectionHeader}>
                          <ThemedText type="subtitle">Member Activity</ThemedText>
                          <Ionicons name="people-outline" size={16} color={theme.secondaryText} />
                        </View>
                        <View style={styles.memberList}>
                          {filtered.map((item: any, index: number) => (
                            <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)} style={[styles.memberCard, { backgroundColor: theme.card }]}>
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
                    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.insightCard, { backgroundColor: theme.card }]}>
                      <Ionicons name="bulb-outline" size={20} color={theme.tint} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <ThemedText style={styles.insightTitle}>Daily average</ThemedText>
                        <ThemedText style={styles.insightBody}>
                          You {activeTab === 'expense' ? 'spent' : 'earned'}{' '}
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
                      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
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
                            width={SCREEN_WIDTH - 80}
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
                            <Animated.View key={i} entering={FadeInDown.delay(i * 50).duration(280)} style={[styles.monthlyItem, { backgroundColor: theme.card }, isCurrentMonth && { borderLeftColor: theme.tint, borderLeftWidth: 3 }]}>
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
                      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
                        <ErrorBoundary fallback={null}>
                          <BarChart
                            data={netBarData}
                            width={SCREEN_WIDTH - 80}
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

      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 12, marginBottom: 12 },
  monthSelector:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  title:        TYPE_SCALE.screenTitle,

  modeTabs:     { flexDirection: 'row', marginHorizontal: 12, borderRadius: 14, padding: 4, marginBottom: 12, gap: 4 },
  modeTab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11 },
  modeTabText:  { fontSize: 12, fontWeight: '700' },

  scrollContent:{ paddingHorizontal: 12, paddingBottom: 120 },

  compRow:      { flexDirection: 'row', gap: 12, marginBottom: 12 },
  netCard:      { borderRadius: 20, padding: 18, marginBottom: 12 },
  netCardRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  netLabel:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  netValue:     { fontSize: 26, fontWeight: '900' },
  savingsRate:  { alignItems: 'flex-end' },
  savingsLabel: { fontSize: 11, marginBottom: 2 },
  savingsValue: { fontSize: 24, fontWeight: '900' },

  tabBar:       { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 12, gap: 4 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabText:      { fontSize: 14, fontWeight: '600' },

  donutWrap:          { alignItems: 'center', marginBottom: 12 },
  donutCenter:        { alignItems: 'center' },
  donutCenterLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  donutCenterValue:   { fontSize: 18, fontWeight: '900', marginTop: 2 },
  donutLegendRow:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20, paddingHorizontal: 10 },
  donutLegendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  donutLegendDot:     { width: 8, height: 8, borderRadius: 4 },
  donutLegendName:    { fontSize: 11, fontWeight: '600', maxWidth: 70 },
  donutLegendPct:     { fontSize: 11, fontWeight: '800' },

  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  catSection:   { borderRadius: 24, padding: 16, gap: 14 },

  memberList:   { gap: 12 },
  memberCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20 },
  memberInfo:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberPhoto:  { width: 40, height: 40, borderRadius: 20 },
  memberPhotoPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  memberName:   { fontSize: 15, fontWeight: '600' },
  memberMeta:   { fontSize: 12 },
  memberAmount: { fontSize: 16, fontWeight: '800' },

  insightCard:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginTop: 12 },
  insightTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  insightBody:  { fontSize: 13, lineHeight: 18 },

  chartCard:    { borderRadius: 24, padding: 20, alignItems: 'center' },
  trendLegend:  { flexDirection: 'row', gap: 16, alignSelf: 'flex-start', marginBottom: 12 },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendLegendDot:  { width: 10, height: 10, borderRadius: 5 },
  trendLegendText: { fontSize: 12, fontWeight: '600' },

  monthlyList:  { gap: 12 },
  monthlyItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16 },
  monthlyLeft:  { gap: 4 },
  monthlyLabel: { fontSize: 14, fontWeight: '700' },
  monthlySubRow:{ flexDirection: 'row', alignItems: 'center' },
  monthlyNet:   { fontSize: 15, fontWeight: '900' },

  emptyChart:   { alignItems: 'center', paddingVertical: 60 },
  emptyText:    { textAlign: 'center', fontSize: 13, paddingVertical: 20 },
});
