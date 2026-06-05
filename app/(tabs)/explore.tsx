import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SkeletonLoader } from '@/components/SkeletonLoader';

import { CategoryBar } from '@/components/analytics/CategoryBar';
import { ComparisonCard } from '@/components/analytics/ComparisonCard';
import { AnalyticsCalendar } from '@/components/analytics/AnalyticsCalendar';
import { MONTHS } from '@/constants/maps';

const { width: screenWidth } = Dimensions.get('window');

type ViewMode = 'overview' | 'trends' | 'calendar';

export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [viewMode, setViewMode]       = useState<ViewMode>('overview');
  const [activeTab, setActiveTab]     = useState<'expense' | 'income'>('expense');
  const [loading, setLoading]         = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [data, setData]               = useState<any>(null);
  const [trendData, setTrendData]     = useState<any[]>([]);
  const [refreshing, setRefreshing]   = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear]   = useState(new Date().getFullYear());

  const hasData   = useRef(false);
  const isMounted = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setData(null); }
      const analyticsData = await getAnalytics(currentMonth, currentYear);
      setData(analyticsData);
      hasData.current = true;
    } catch (err) {
      console.error(err);
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

  const changeMonth = (delta: number) => {
    let m = currentMonth + delta, y = currentYear;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    setCurrentMonth(m); setCurrentYear(y);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
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

  const total    = activeTab === 'income' ? data?.totalIncome    : data?.totalExpense;
  const prevTotal = activeTab === 'income'
    ? data?.previousMonth?.totalIncome
    : data?.previousMonth?.totalExpense;

  const trendLineIncome  = useMemo(() => trendData.map(d => ({ value: d.income,  label: d.monthLabel })), [trendData]);
  const trendLineExpense = useMemo(() => trendData.map(d => ({ value: d.expense, label: d.monthLabel })), [trendData]);

  const netBarData = useMemo(() =>
    trendData.map(d => ({
      value: Math.abs(d.net),
      label: d.monthLabel,
      frontColor: d.net >= 0 ? theme.income : theme.expense,
      topLabelComponent: () => (
        <Text style={{ fontSize: 8, color: theme.secondaryText, width: 30, textAlign: 'center' }}>
          {d.net >= 0 ? '+' : '-'}{Currency.format(Math.abs(d.net)).replace('₹', '₹')}
        </Text>
      ),
    })),
  [trendData, theme]);

  const maxTrend = useMemo(() => {
    const vals = trendData.flatMap(d => [d.income, d.expense]);
    return Math.max(...vals, 1) * 1.2;
  }, [trendData]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
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

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
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

      {/* View mode tabs */}
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

            {/* Expense/Income tab */}
            <View style={[styles.tabBar, { backgroundColor: 'rgba(150,150,150,0.08)' }]}>
              {(['expense', 'income'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && { backgroundColor: tab === 'expense' ? theme.expense : theme.income }]}
                  onPress={() => setActiveTab(tab)}
                >
                  <ThemedText style={[styles.tabText, activeTab === tab && { color: '#FFF', fontWeight: '700' }]}>
                    {tab === 'expense' ? t('expenses') : t('income')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Donut */}
            <View style={styles.donutWrap}>
              {pieData.length > 0 ? (
                <>
                  <PieChart
                    data={pieData}
                    radius={screenWidth / 3.6}
                    innerRadius={screenWidth / 5.8}
                    showText={false}
                    focusOnPress
                    centerLabelComponent={() => (
                      <View style={styles.donutCenter}>
                        <ThemedText style={styles.donutCenterLabel}>{activeTab === 'expense' ? 'Spent' : 'Earned'}</ThemedText>
                        <Text style={[styles.donutCenterValue, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                          {Currency.format(total || 0)}
                        </Text>
                      </View>
                    )}
                  />
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
                  <ThemedText style={styles.emptyText}>No data for this month</ThemedText>
                </View>
              )}
            </View>

            {/* Category bars */}
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
                      <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)} style={[styles.memberCard, { backgroundColor: theme.card }]}>
                        <View style={styles.memberInfo}>
                          {item.user?.profilePhoto ? (
                            <Image source={{ uri: item.user.profilePhoto }} style={styles.memberPhoto} />
                          ) : (
                            <View style={[styles.memberPhotoPlaceholder, { backgroundColor: `${theme.tint}20` }]}>
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

            {/* Avg daily insight */}
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
                <Ionicons name="trending-up-outline" size={56} color={theme.icon} style={{ opacity: 0.2 }} />
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
                    } catch { return <ThemedText style={styles.emptyText}>Chart unavailable</ThemedText>; }
                  })()}
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
                    } catch { return null; }
                  })()}
                </View>
              </>
            )}
          </>
        )}

        {/* ════════════ CALENDAR ════════════ */}
        {viewMode === 'calendar' && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">{MONTHS[currentMonth - 1]} {currentYear}</ThemedText>
            </View>
            <View style={[styles.calCard, { backgroundColor: theme.card }]}>
              <AnalyticsCalendar
                month={currentMonth}
                year={currentYear}
                dailyBreakdown={data?.dailyBreakdown || []}
                theme={theme}
              />
            </View>

            {(data?.totalIncome > 0 || data?.totalExpense > 0) && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.calSummaryRow}>
                {[
                  { icon: 'arrow-down-circle', label: 'Income',   val: data.totalIncome,  color: theme.income },
                  { icon: 'arrow-up-circle',   label: 'Expenses', val: data.totalExpense, color: theme.expense },
                  { icon: 'wallet-outline',    label: 'Balance',  val: data.balance || 0, color: (data.balance || 0) >= 0 ? theme.income : theme.expense },
                ].map(c => (
                  <View key={c.label} style={[styles.calSummaryCard, { backgroundColor: theme.card }]}>
                    <Ionicons name={c.icon as any} size={20} color={c.color} />
                    <ThemedText style={styles.calSummaryLabel}>{c.label}</ThemedText>
                    <Text style={[styles.calSummaryValue, { color: c.color }]}>{Currency.format(c.val)}</Text>
                  </View>
                ))}
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
  container:    { flex: 1, paddingTop: 60 },
  header:       { paddingHorizontal: 20, marginBottom: 16 },
  monthSelector:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  title:        { fontSize: 20, fontWeight: '800' },
  modeTabs:     { flexDirection: 'row', marginHorizontal: 20, borderRadius: 14, padding: 4, marginBottom: 20, gap: 4 },
  modeTab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11 },
  modeTabText:  { fontSize: 12, fontWeight: '700' },
  scrollContent:{ paddingHorizontal: 20, paddingBottom: 120 },
  compRow:      { flexDirection: 'row', gap: 12, marginBottom: 14 },
  netCard:      { borderRadius: 20, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  netCardRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  netLabel:     { fontSize: 11, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  netValue:     { fontSize: 26, fontWeight: '900' },
  savingsRate:  { alignItems: 'flex-end' },
  savingsLabel: { fontSize: 11, opacity: 0.5, marginBottom: 2 },
  savingsValue: { fontSize: 24, fontWeight: '900' },
  tabBar:       { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 24, gap: 4 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabText:      { fontSize: 14, fontWeight: '600' },
  donutWrap:    { alignItems: 'center', marginBottom: 8 },
  donutCenter:  { alignItems: 'center' },
  donutCenterLabel: { fontSize: 11, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  donutCenterValue: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  donutLegendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20, paddingHorizontal: 10 },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(150,150,150,0.06)' },
  donutLegendDot: { width: 8, height: 8, borderRadius: 4 },
  donutLegendName: { fontSize: 11, fontWeight: '600', maxWidth: 70 },
  donutLegendPct: { fontSize: 11, fontWeight: '800' },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 },
  catSection:   { borderRadius: 24, padding: 16, gap: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  memberList:   { gap: 10 },
  memberCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  memberInfo:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberPhoto:  { width: 40, height: 40, borderRadius: 20 },
  memberPhotoPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  memberName:   { fontSize: 15, fontWeight: '600' },
  memberMeta:   { fontSize: 12, opacity: 0.5 },
  memberAmount: { fontSize: 16, fontWeight: '800' },
  insightCard:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginTop: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  insightTitle: { fontSize: 11, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  insightBody:  { fontSize: 13, opacity: 0.7, lineHeight: 18 },
  chartCard:    { borderRadius: 24, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  trendLegend:  { flexDirection: 'row', gap: 16, alignSelf: 'flex-start', marginBottom: 16 },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendLegendDot: { width: 10, height: 10, borderRadius: 5 },
  trendLegendText: { fontSize: 12, fontWeight: '600', opacity: 0.7 },
  monthlyList:  { gap: 8 },
  monthlyItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  monthlyLeft:  { gap: 4 },
  monthlyLabel: { fontSize: 14, fontWeight: '700' },
  monthlySubRow:{ flexDirection: 'row', alignItems: 'center' },
  monthlyNet:   { fontSize: 15, fontWeight: '900' },
  calCard:      { borderRadius: 24, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  calSummaryRow:{ flexDirection: 'row', gap: 10, marginTop: 16 },
  calSummaryCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  calSummaryLabel: { fontSize: 10, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' },
  calSummaryValue: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  emptyChart:   { alignItems: 'center', paddingVertical: 60 },
  emptyText:    { textAlign: 'center', opacity: 0.4, fontSize: 13, paddingVertical: 20 },
});
