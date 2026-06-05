import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart, BarChart } from 'react-native-gifted-charts';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAnalytics, getTrend } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SkeletonLoader } from '@/components/SkeletonLoader';

const { width: screenWidth } = Dimensions.get('window');

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_LABELS = ['S','M','T','W','T','F','S'];

type ViewMode = 'overview' | 'trends' | 'calendar';

// ─────────────────────────────────────────
// Animated horizontal category bar
// ─────────────────────────────────────────
function CategoryBar({
  category, amount, percentage, color, rank,
}: {
  category: string; amount: number; percentage: number; color: string; rank: number;
}) {
  const theme = Colors[useColorScheme() || 'light'];
  const pct = Math.min(Number(percentage) || 0, 100);
  const barW = useSharedValue(0);

  useEffect(() => {
    barW.value = withTiming(pct / 100, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barW.value * 100}%` as any,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(rank * 60).duration(300)} style={styles.catBarItem}>
      <View style={styles.catBarTop}>
        <View style={styles.catBarLeft}>
          <View style={[styles.catDot, { backgroundColor: color }]} />
          <ThemedText style={styles.catBarName}>{category}</ThemedText>
        </View>
        <View style={styles.catBarRight}>
          <Text style={[styles.catBarPct, { color }]}>{Math.round(pct)}%</Text>
          <ThemedText style={styles.catBarAmt}>{Currency.format(amount)}</ThemedText>
        </View>
      </View>
      <View style={[styles.catTrack, { backgroundColor: `${color}20` }]}>
        <Animated.View style={[styles.catFill, { backgroundColor: color }, barStyle]} />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────
// Comparison card (income or expense + % vs last month)
// ─────────────────────────────────────────
function ComparisonCard({
  label, current, previous, color, icon,
}: {
  label: string; current: number; previous: number; color: string; icon: string;
}) {
  const theme = Colors[useColorScheme() || 'light'];
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const isUp = change !== null && change > 0;

  return (
    <View style={[styles.compCard, { backgroundColor: theme.card }]}>
      <View style={[styles.compIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <ThemedText style={styles.compLabel}>{label}</ThemedText>
      <Text style={[styles.compValue, { color }]}>{Currency.format(current)}</Text>
      {change !== null && (
        <View style={[styles.compBadge, { backgroundColor: isUp ? `${color}15` : '#10B98115' }]}>
          <Ionicons
            name={isUp ? 'arrow-up' : 'arrow-down'}
            size={10}
            color={isUp ? color : '#10B981'}
          />
          <Text style={{ color: isUp ? color : '#10B981', fontSize: 10, fontWeight: '700' }}>
            {Math.abs(change).toFixed(1)}%
          </Text>
        </View>
      )}
      <ThemedText style={styles.compSub}>vs last month</ThemedText>
    </View>
  );
}

// ─────────────────────────────────────────
// Calendar view
// ─────────────────────────────────────────
function CalendarView({
  month, year, dailyBreakdown, theme,
}: {
  month: number; year: number; dailyBreakdown: any[]; theme: any;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dailyMap = useMemo(() => {
    const m: Record<number, { income: number; expense: number }> = {};
    dailyBreakdown.forEach((d: any) => {
      if (!m[d.day]) m[d.day] = { income: 0, expense: 0 };
      m[d.day].income  = d.income  || 0;
      m[d.day].expense = d.expense || 0;
    });
    return m;
  }, [dailyBreakdown]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth    = new Date(year, month, 0).getDate();
  const totalCells     = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const cellSize       = Math.floor((screenWidth - 40 - 12) / 7);

  const selectedData = selectedDay ? dailyMap[selectedDay] : null;

  return (
    <View>
      {/* Day labels */}
      <View style={styles.calDayRow}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={[styles.calDayCell, { width: cellSize }]}>
            <Text style={[styles.calDayLabel, { color: theme.secondaryText }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calGrid}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDayOfWeek + 1;
          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
          const data = isValid ? dailyMap[dayNum] : null;
          const hasIncome  = data && data.income  > 0;
          const hasExpense = data && data.expense > 0;
          const isSelected = isValid && selectedDay === dayNum;
          const isToday =
            isValid &&
            new Date().getDate()     === dayNum &&
            new Date().getMonth() + 1 === month &&
            new Date().getFullYear()  === year;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => isValid && setSelectedDay(dayNum === selectedDay ? null : dayNum)}
              activeOpacity={0.7}
              style={[
                styles.calCell,
                { width: cellSize, height: cellSize + 10 },
                isSelected && { backgroundColor: theme.tint + '20', borderRadius: 12 },
              ]}
            >
              {isValid && (
                <>
                  <View style={[
                    styles.calDayNum,
                    isToday && { backgroundColor: theme.tint, borderRadius: 14 },
                  ]}>
                    <Text style={[
                      styles.calDayNumText,
                      { color: isToday ? '#FFF' : theme.text },
                    ]}>
                      {dayNum}
                    </Text>
                  </View>
                  <View style={styles.calDots}>
                    {hasIncome  && <View style={[styles.calDot, { backgroundColor: theme.income }]} />}
                    {hasExpense && <View style={[styles.calDot, { backgroundColor: theme.expense }]} />}
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.calLegend}>
        <View style={styles.calLegendItem}>
          <View style={[styles.calDot, { backgroundColor: theme.income }]} />
          <ThemedText style={styles.calLegendText}>Income</ThemedText>
        </View>
        <View style={styles.calLegendItem}>
          <View style={[styles.calDot, { backgroundColor: theme.expense }]} />
          <ThemedText style={styles.calLegendText}>Expense</ThemedText>
        </View>
      </View>

      {/* Selected day detail */}
      {selectedDay !== null && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[styles.dayDetail, { backgroundColor: theme.card }]}
        >
          <ThemedText style={styles.dayDetailTitle}>
            {MONTHS[month - 1]} {selectedDay}
          </ThemedText>
          <View style={styles.dayDetailRow}>
            {selectedData?.income > 0 && (
              <View style={styles.dayDetailItem}>
                <Ionicons name="arrow-down-circle" size={16} color={theme.income} />
                <Text style={[styles.dayDetailAmt, { color: theme.income }]}>
                  +{Currency.format(selectedData.income)}
                </Text>
              </View>
            )}
            {selectedData?.expense > 0 && (
              <View style={styles.dayDetailItem}>
                <Ionicons name="arrow-up-circle" size={16} color={theme.expense} />
                <Text style={[styles.dayDetailAmt, { color: theme.expense }]}>
                  -{Currency.format(selectedData.expense)}
                </Text>
              </View>
            )}
            {!selectedData && (
              <ThemedText style={{ opacity: 0.4, fontSize: 13 }}>No transactions this day</ThemedText>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// Main Analytics Screen
// ─────────────────────────────────────────
export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear]   = useState(new Date().getFullYear());

  const hasData   = useRef(false);
  const isMounted = useRef(false);

  // ── Fetch analytics ──────────────────────
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setData(null); }
      const analyticsData = await getAnalytics(currentMonth, currentYear);
      setData(analyticsData);
      hasData.current = true;
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, currentYear, user?.groupId]);

  const fetchTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      const result = await getTrend(6);
      setTrendData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(hasData.current);
    }, [fetchData])
  );

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    hasData.current = false;
    fetchData(false);
  }, [currentMonth, currentYear]);

  // Fetch trend data when switching to trends tab
  useEffect(() => {
    if (viewMode === 'trends' && trendData.length === 0) {
      fetchTrend();
    }
  }, [viewMode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
    if (viewMode === 'trends') fetchTrend();
  };

  const changeMonth = (delta: number) => {
    let m = currentMonth + delta, y = currentYear;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    setCurrentMonth(m); setCurrentYear(y);
  };

  // ── Derived data ─────────────────────────
  const chartColors = theme.chart;

  const sortedCategories = useMemo(() => {
    const raw = activeTab === 'income' ? data?.incomeBreakdown : data?.categoryBreakdown;
    if (!raw || raw.length === 0) return [];
    return [...raw].sort((a: any, b: any) => b.amount - a.amount);
  }, [data, activeTab]);

  const pieData = useMemo(() =>
    sortedCategories.map((item: any, i: number) => ({
      value: item.amount,
      color: chartColors[i % chartColors.length],
      text: `${Math.round(item.percentage)}%`,
      category: t(item.category),
      percentage: item.percentage,
    })),
  [sortedCategories, chartColors, t]);

  const total = activeTab === 'income' ? data?.totalIncome : data?.totalExpense;
  const prevTotal = activeTab === 'income'
    ? data?.previousMonth?.totalIncome
    : data?.previousMonth?.totalExpense;

  // Trend chart data
  const trendLineIncome = useMemo(() =>
    trendData.map(d => ({ value: d.income, label: d.monthLabel })),
  [trendData]);

  const trendLineExpense = useMemo(() =>
    trendData.map(d => ({ value: d.expense, label: d.monthLabel })),
  [trendData]);

  const netBarData = useMemo(() =>
    trendData.map(d => ({
      value: Math.abs(d.net),
      label: d.monthLabel,
      frontColor: d.net >= 0 ? theme.income : theme.expense,
      topLabelComponent: () => (
        <Text style={{ fontSize: 8, color: theme.secondaryText, width: 30, textAlign: 'center' }}>
          {d.net >= 0 ? '+' : '-'}{Currency.format(Math.abs(d.net)).replace('₹','₹')}
        </Text>
      ),
    })),
  [trendData, theme]);

  const maxTrend = useMemo(() => {
    const vals = trendData.flatMap(d => [d.income, d.expense]);
    return Math.max(...vals, 1) * 1.2;
  }, [trendData]);

  // ── Loading skeleton ──────────────────────
  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 180, height: 28, borderRadius: 10, backgroundColor: 'rgba(150,150,150,0.1)' }} />
        </View>
        <SkeletonLoader type="card" />
        <SkeletonLoader type="chart" />
      </ThemedView>
    );
  }

  // ── Render ────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      {/* ── Header ── */}
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

      {/* ── View mode tabs ── */}
      <View style={[styles.modeTabs, { backgroundColor: 'rgba(150,150,150,0.08)' }]}>
        {(['overview', 'trends', 'calendar'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeTab, viewMode === mode && { backgroundColor: theme.tint }]}
            onPress={() => setViewMode(mode)}
          >
            <Ionicons
              name={mode === 'overview' ? 'pie-chart' : mode === 'trends' ? 'trending-up' : 'calendar'}
              size={14}
              color={viewMode === mode ? '#FFF' : theme.secondaryText}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.modeTabText, { color: viewMode === mode ? '#FFF' : theme.secondaryText }]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════ OVERVIEW ══════════════════════════════ */}
        {viewMode === 'overview' && (
          <>
            {/* Comparison cards */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.compRow}>
              <ComparisonCard
                label="Income"
                current={data?.totalIncome || 0}
                previous={data?.previousMonth?.totalIncome || 0}
                color={theme.income}
                icon="arrow-down-circle"
              />
              <ComparisonCard
                label="Expenses"
                current={data?.totalExpense || 0}
                previous={data?.previousMonth?.totalExpense || 0}
                color={theme.expense}
                icon="arrow-up-circle"
              />
            </Animated.View>

            {/* Net balance card */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(300)}
              style={[styles.netCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.netCardRow}>
                <View>
                  <ThemedText style={styles.netLabel}>Net Balance</ThemedText>
                  <Text style={[
                    styles.netValue,
                    { color: (data?.balance || 0) >= 0 ? theme.income : theme.expense },
                  ]}>
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

            {/* Expense / Income segmented control */}
            <View style={[styles.tabBar, { backgroundColor: 'rgba(150,150,150,0.08)' }]}>
              {(['expense', 'income'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    activeTab === tab && {
                      backgroundColor: tab === 'expense' ? theme.expense : theme.income,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <ThemedText style={[
                    styles.tabText,
                    activeTab === tab && { color: '#FFF', fontWeight: '700' },
                  ]}>
                    {tab === 'expense' ? t('expenses') : t('income')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Donut chart */}
            <View style={styles.donutWrap}>
              {pieData.length > 0 ? (
                <>
                  <PieChart
                    data={pieData}
                    radius={screenWidth / 3.6}
                    innerRadius={screenWidth / 5.8}
                    showText={false}
                    focusOnPress
                    sectionAutoScale
                    centerLabelComponent={() => (
                      <View style={styles.donutCenter}>
                        <ThemedText style={styles.donutCenterLabel}>
                          {activeTab === 'expense' ? 'Spent' : 'Earned'}
                        </ThemedText>
                        <Text style={[styles.donutCenterValue, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                          {Currency.format(total || 0)}
                        </Text>
                      </View>
                    )}
                  />
                  {/* Top-2 labels outside donut */}
                  <View style={styles.donutLegendRow}>
                    {pieData.slice(0, Math.min(4, pieData.length)).map((item: any, i: number) => (
                      <View key={i} style={styles.donutLegendItem}>
                        <View style={[styles.donutLegendDot, { backgroundColor: item.color }]} />
                        <ThemedText style={styles.donutLegendName} numberOfLines={1}>{item.category}</ThemedText>
                        <Text style={[styles.donutLegendPct, { color: item.color }]}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.emptyChart}>
                  <Ionicons name="pie-chart-outline" size={56} color={theme.icon} style={{ opacity: 0.2 }} />
                  <ThemedText style={{ opacity: 0.4, marginTop: 12, fontSize: 13 }}>No data for this month</ThemedText>
                </View>
              )}
            </View>

            {/* Category horizontal bars */}
            {sortedCategories.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle">Category Breakdown</ThemedText>
                  <Ionicons name="bar-chart-outline" size={16} color={theme.secondaryText} />
                </View>
                <View style={[styles.catSection, { backgroundColor: theme.card }]}>
                  {sortedCategories.map((item: any, i: number) => (
                    <CategoryBar
                      key={item.category}
                      category={t(item.category)}
                      amount={item.amount}
                      percentage={parseFloat(item.percentage)}
                      color={chartColors[i % chartColors.length]}
                      rank={i}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Member breakdown */}
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
                      <Animated.View
                        key={index}
                        entering={FadeInDown.delay(index * 80).duration(300)}
                        style={[styles.memberCard, { backgroundColor: theme.card }]}
                      >
                        <View style={styles.memberInfo}>
                          {item.user?.profilePhoto ? (
                            <Image source={{ uri: item.user.profilePhoto }} style={styles.memberPhoto} />
                          ) : (
                            <View style={[styles.memberPhotoPlaceholder, { backgroundColor: theme.tint + '20' }]}>
                              <ThemedText style={{ color: theme.tint, fontWeight: '700' }}>
                                {item.user?.name?.charAt(0)}
                              </ThemedText>
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

            {/* Avg daily insight */}
            {(total || 0) > 0 && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(300)}
                style={[styles.insightCard, { backgroundColor: theme.card }]}
              >
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

        {/* ══════════════════════════════ TRENDS ══════════════════════════════ */}
        {viewMode === 'trends' && (
          <>
            {trendLoading ? (
              <>
                <SkeletonLoader type="chart" />
                <SkeletonLoader type="card" />
              </>
            ) : trendData.length === 0 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="trending-up-outline" size={56} color={theme.icon} style={{ opacity: 0.2 }} />
                <ThemedText style={{ opacity: 0.4, marginTop: 12, fontSize: 13 }}>No trend data yet</ThemedText>
              </View>
            ) : (
              <>
                {/* Income vs Expense area line chart */}
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
                  {(() => {
                    try {
                      return (
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
                          width={screenWidth - 80}
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
                      );
                    } catch {
                      return <ThemedText style={styles.emptyText}>Chart unavailable</ThemedText>;
                    }
                  })()}
                </View>

                {/* Monthly summary mini-cards */}
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle">Monthly Summary</ThemedText>
                  <Ionicons name="list-outline" size={16} color={theme.secondaryText} />
                </View>
                <View style={styles.monthlyList}>
                  {[...trendData].reverse().map((d: any, i: number) => {
                    const net = d.net;
                    const isCurrentMonth = d.month === currentMonth && d.year === currentYear;
                    return (
                      <Animated.View
                        key={i}
                        entering={FadeInDown.delay(i * 50).duration(280)}
                        style={[
                          styles.monthlyItem,
                          { backgroundColor: theme.card },
                          isCurrentMonth && { borderLeftColor: theme.tint, borderLeftWidth: 3 },
                        ]}
                      >
                        <View style={styles.monthlyLeft}>
                          <ThemedText style={[styles.monthlyLabel, isCurrentMonth && { color: theme.tint, fontWeight: '800' }]}>
                            {d.monthLabel} {d.year}
                          </ThemedText>
                          <View style={styles.monthlySubRow}>
                            <Text style={{ color: theme.income, fontSize: 11, fontWeight: '600' }}>
                              +{Currency.format(d.income)}
                            </Text>
                            <Text style={{ color: theme.secondaryText, fontSize: 11, marginHorizontal: 4 }}>·</Text>
                            <Text style={{ color: theme.expense, fontSize: 11, fontWeight: '600' }}>
                              -{Currency.format(d.expense)}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.monthlyNet, { color: net >= 0 ? theme.income : theme.expense }]}>
                          {net >= 0 ? '+' : ''}{Currency.format(net)}
                        </Text>
                      </Animated.View>
                    );
                  })}
                </View>

                {/* Net balance bars */}
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle">Net Balance by Month</ThemedText>
                  <Ionicons name="bar-chart-outline" size={16} color={theme.secondaryText} />
                </View>
                <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
                  {(() => {
                    try {
                      return (
                        <BarChart
                          data={netBarData}
                          width={screenWidth - 80}
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
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </View>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════ CALENDAR ══════════════════════════════ */}
        {viewMode === 'calendar' && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">{MONTHS[currentMonth - 1]} {currentYear}</ThemedText>
            </View>
            <View style={[styles.calCard, { backgroundColor: theme.card }]}>
              <CalendarView
                month={currentMonth}
                year={currentYear}
                dailyBreakdown={data?.dailyBreakdown || []}
                theme={theme}
              />
            </View>

            {/* Monthly summary below calendar */}
            {(data?.totalIncome > 0 || data?.totalExpense > 0) && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.calSummaryRow}>
                <View style={[styles.calSummaryCard, { backgroundColor: theme.card }]}>
                  <Ionicons name="arrow-down-circle" size={20} color={theme.income} />
                  <ThemedText style={styles.calSummaryLabel}>Income</ThemedText>
                  <Text style={[styles.calSummaryValue, { color: theme.income }]}>
                    {Currency.format(data.totalIncome)}
                  </Text>
                </View>
                <View style={[styles.calSummaryCard, { backgroundColor: theme.card }]}>
                  <Ionicons name="arrow-up-circle" size={20} color={theme.expense} />
                  <ThemedText style={styles.calSummaryLabel}>Expenses</ThemedText>
                  <Text style={[styles.calSummaryValue, { color: theme.expense }]}>
                    {Currency.format(data.totalExpense)}
                  </Text>
                </View>
                <View style={[styles.calSummaryCard, { backgroundColor: theme.card }]}>
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={(data.balance || 0) >= 0 ? theme.income : theme.expense}
                  />
                  <ThemedText style={styles.calSummaryLabel}>Balance</ThemedText>
                  <Text style={[styles.calSummaryValue, { color: (data.balance || 0) >= 0 ? theme.income : theme.expense }]}>
                    {Currency.format(data.balance || 0)}
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  // ── Comparison cards ──
  compRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  compCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  compIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  compLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  compValue: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  compBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  compSub: {
    fontSize: 10,
    opacity: 0.4,
  },
  // ── Net card ──
  netCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  netCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  netValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  savingsRate: {
    alignItems: 'flex-end',
  },
  savingsLabel: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 2,
  },
  savingsValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 24,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Donut ──
  donutWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  donutCenter: {
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  donutCenterValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  donutLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 10,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(150,150,150,0.06)',
  },
  donutLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  donutLegendName: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 70,
  },
  donutLegendPct: {
    fontSize: 11,
    fontWeight: '800',
  },
  // ── Category bars ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  catSection: {
    borderRadius: 24,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  catBarItem: {
    gap: 6,
  },
  catBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catBarName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  catBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catBarPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  catBarAmt: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'right',
  },
  catTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catFill: {
    height: '100%',
    borderRadius: 4,
  },
  // ── Members ──
  memberList: {
    gap: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    fontSize: 12,
    opacity: 0.5,
  },
  memberAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  // ── Insight card ──
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginTop: 24,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightBody: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  // ── Trend charts ──
  chartCard: {
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  trendLegend: {
    flexDirection: 'row',
    gap: 16,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  trendLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trendLegendText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  monthlyList: {
    gap: 8,
  },
  monthlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  monthlyLeft: {
    gap: 4,
  },
  monthlyLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthlySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyNet: {
    fontSize: 15,
    fontWeight: '900',
  },
  // ── Calendar ──
  calCard: {
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  calDayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDayCell: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  calDayLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  calDayNum: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calDayNumText: {
    fontSize: 13,
    fontWeight: '600',
  },
  calDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  calLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.1)',
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calLegendText: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: '600',
  },
  dayDetail: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
  },
  dayDetailTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  dayDetailRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  dayDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayDetailAmt: {
    fontSize: 14,
    fontWeight: '800',
  },
  calSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  calSummaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  calSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
  },
  calSummaryValue: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  // ── Shared ──
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.4,
    fontSize: 13,
    paddingVertical: 20,
  },
});
