import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAnalytics } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import Animated, { FadeInDown, FadeInUp, FadeInRight } from 'react-native-reanimated';

const screenWidth = Dimensions.get('window').width;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AnalyticsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setData(null);
      }
      const analyticsData = await getAnalytics(currentMonth, currentYear);
      setData(analyticsData);
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, currentYear, user?.groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const changeMonth = (delta: number) => {
    let nextMonth = currentMonth + delta;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1; nextYear++;
    } else if (nextMonth < 1) {
      nextMonth = 12; nextYear--;
    }
    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
  };

  const pieData = useMemo(() => {
    const rawData = activeTab === 'income' ? data?.incomeBreakdown : data?.categoryBreakdown;
    if (!rawData || rawData.length === 0) return [];
    
    const colors = theme.chart;
    const sorted = [...rawData].sort((a: any, b: any) => b.amount - a.amount);

    return sorted.map((item: any, index: number) => ({
      value: item.amount,
      amount: item.amount,
      percentage: item.percentage,
      color: colors[index % colors.length],
      text: `${Math.round(item.percentage)}%`,
      category: t(item.category),
      icon: item.icon || 'grid-outline'
    }));
  }, [data, activeTab, t, theme]);

  const barChartData = useMemo(() => {
    if (!data?.weeklyTrends) return [];
    const trends = data.weeklyTrends.filter((t: any) => t.type === activeTab);
    return trends.map((t: any) => ({
      value: t.amount,
      label: `W${t.week % 4 + 1}`,
      frontColor: activeTab === 'expense' ? theme.expense : theme.income,
      topLabelComponent: () => (
          <Text style={{color: theme.text, fontSize: 10, width: 40, textAlign: 'center'}}>{Currency.format(t.amount).split('.')[0]}</Text>
      )
    }));
  }, [data, activeTab, theme]);

  const topCategory = useMemo(() => {
    const rawData = activeTab === 'income' ? data?.incomeBreakdown : data?.categoryBreakdown;
    if (!rawData || rawData.length === 0) return null;
    return rawData.reduce((prev: any, current: any) => (prev.amount > current.amount) ? prev : current);
  }, [data, activeTab]);

  const total = activeTab === 'income' ? data?.totalIncome : data?.totalExpense;

  const renderCategoryItem = (item: any, index: number) => {
    const colors = theme.chart;
    const color = colors[index % colors.length];

    return (
      <Animated.View 
        key={index} 
        entering={FadeInDown.delay(index * 100)}
        style={styles.categoryItem}
      >
        <View style={styles.leftInfo}>
          <View style={[styles.percentageBadge, { backgroundColor: `${color}30` }]}>
            <Text style={[styles.percentageText, { color: color }]}>{Math.round(item.percentage)}%</Text>
          </View>
          <View>
            <ThemedText style={styles.categoryName}>{t(item.category)}</ThemedText>
          </View>
        </View>
        <ThemedText style={styles.categoryAmount}>{Currency.format(item.amount)}</ThemedText>
      </Animated.View>
    );
  };

  const renderMemberItem = (item: any, index: number) => {
      if (item.type !== activeTab) return null;
      return (
          <Animated.View key={index} entering={FadeInRight.delay(index * 100)} style={[styles.memberCard, { backgroundColor: theme.card }]}>
              <View style={styles.memberInfo}>
                  {item.user?.profilePhoto ? (
                      <Image source={{ uri: item.user.profilePhoto }} style={styles.memberPhoto} />
                  ) : (
                      <View style={[styles.memberPhotoPlaceholder, { backgroundColor: theme.tint + '20' }]}>
                          <ThemedText style={{ color: theme.tint }}>{item.user?.name?.charAt(0)}</ThemedText>
                      </View>
                  )}
                  <View>
                      <ThemedText style={styles.memberName}>{item.user?.name}</ThemedText>
                      <ThemedText style={styles.memberMeta}>{item.percentage}% of total</ThemedText>
                  </View>
              </View>
              <ThemedText style={[styles.memberAmount, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                  {Currency.format(item.amount)}
              </ThemedText>
          </Animated.View>
      );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            {MONTHS[currentMonth - 1]} {currentYear}
          </ThemedText>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.tabBar, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expense' && { backgroundColor: theme.card }]}
            onPress={() => setActiveTab('expense')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'expense' && { fontWeight: '700' }]}>{t('expenses')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'income' && { backgroundColor: theme.card }]}
            onPress={() => setActiveTab('income')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'income' && { fontWeight: '700' }]}>{t('income')}</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
            <Animated.View entering={FadeInUp.delay(100)} style={[styles.mainStat, { backgroundColor: theme.card }]}>
                <ThemedText style={styles.statLabel}>Total {activeTab === 'expense' ? t('spent') : t('earned')}</ThemedText>
                <ThemedText style={[styles.mainStatValue, { color: activeTab === 'expense' ? theme.expense : theme.income }]}>
                    {Currency.format(total || 0)}
                </ThemedText>
                <View style={styles.statSubRow}>
                    <Ionicons name={activeTab === 'expense' ? 'trending-up' : 'trending-down'} size={14} color={theme.secondaryText} />
                    <ThemedText style={styles.statSubText}>{t('avg_daily')}: {Currency.format((total || 0) / 30)}</ThemedText>
                </View>
            </Animated.View>
        </View>

        {/* Weekly Trend Section */}
        <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Weekly Trend</ThemedText>
            <Ionicons name="stats-chart" size={18} color={theme.secondaryText} />
        </View>
        <View style={[styles.barChartContainer, { backgroundColor: theme.card }]}>
            {barChartData.length > 0 ? (
                <BarChart
                    data={barChartData}
                    width={screenWidth - 80}
                    height={180}
                    barWidth={32}
                    spacing={30}
                    noOfSections={4}
                    maxValue={Math.max(...barChartData.map(d => d.value), 0) * 1.3}
                    barBorderRadius={8}
                    frontColor={activeTab === 'expense' ? theme.expense : theme.income}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    hideRules
                    showLine
                    lineConfig={{
                        color: theme.tint,
                        thickness: 2,
                        curved: true,
                        hideDataPoints: false,
                        dataPointsRadius: 4,
                    }}
                    yAxisTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
                />
            ) : (
                <ThemedText style={styles.emptyText}>No trend data available</ThemedText>
            )}
        </View>

        {/* Chart Section */}
        <View style={styles.chartWrapper}>
            <ThemedText type="subtitle" style={styles.chartTitle}>Category Mix</ThemedText>
            <View style={styles.chartContainer}>
                {pieData.length > 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: 320 }}>
                        <PieChart
                            data={pieData}
                            radius={screenWidth / 3.8}
                            innerRadius={0}
                            showText
                            textColor="white"
                            textSize={12}
                            fontWeight="bold"
                            labelsPosition="outward"
                            showValuesAsLabels
                            sectionAutoScale
                            focusOnPress
                        />
                        <View style={styles.labelsOverlay}>
                            {pieData[1] && (
                                <View style={[styles.labelContainer, { top: 20, left: 20 }]}>
                                    <View style={styles.labelHeader}>
                                        <View style={[styles.dot, { backgroundColor: pieData[1].color }]} />
                                        <Text style={[styles.labelText, { color: theme.text }]}>{pieData[1].category}</Text>
                                    </View>
                                    <Text style={[styles.labelValue, { color: pieData[1].color }]}>{pieData[1].text}</Text>
                                </View>
                            )}
                            {pieData[0] && (
                                <View style={[styles.labelContainer, { top: 20, right: 20, alignItems: 'flex-end' }]}>
                                    <View style={styles.labelHeader}>
                                        <Text style={[styles.labelText, { color: theme.text }]}>{pieData[0].category}</Text>
                                        <View style={[styles.dot, { backgroundColor: pieData[0].color }]} />
                                    </View>
                                    <Text style={[styles.labelValue, { color: pieData[0].color }]}>{pieData[0].text}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyChart}>
                        <Ionicons name="pie-chart-outline" size={64} color={theme.icon} style={{ opacity: 0.2 }} />
                        <ThemedText style={{ opacity: 0.5, marginTop: 16 }}>No data for this month</ThemedText>
                    </View>
                )}
            </View>
        </View>

        {/* Member Breakdown Section */}
        <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Member Activity</ThemedText>
            <Ionicons name="people" size={18} color={theme.secondaryText} />
        </View>
        <View style={styles.memberList}>
            {data?.memberBreakdown?.filter((m:any) => m.type === activeTab).length > 0 ? (
                data.memberBreakdown.map((item: any, index: number) => renderMemberItem(item, index))
            ) : (
                <ThemedText style={styles.emptyText}>No member data</ThemedText>
            )}
        </View>

        {/* Detailed Breakdown */}
        <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Category Detail</ThemedText>
            <Ionicons name="list" size={18} color={theme.secondaryText} />
        </View>
        <View style={styles.breakdownSection}>
          {pieData.length > 0 ? (
             pieData.map((item: any, index: number) => renderCategoryItem(item, index))
          ) : (
             <ThemedText style={styles.emptyText}>Nothing to show</ThemedText>
          )}
        </View>
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
    marginBottom: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 16,
  },
  statsGrid: {
      marginBottom: 8,
  },
  mainStat: {
      padding: 24,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 15,
      elevation: 2,
  },
  statLabel: {
      fontSize: 12,
      fontWeight: '700',
      opacity: 0.5,
      textTransform: 'uppercase',
      marginBottom: 8,
  },
  mainStatValue: {
      fontSize: 32,
      fontWeight: '900',
      marginBottom: 12,
  },
  statSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  statSubText: {
      fontSize: 13,
      opacity: 0.6,
  },
  barChartContainer: {
      padding: 20,
      borderRadius: 24,
      alignItems: 'center',
  },
  chartWrapper: {
      marginTop: 32,
  },
  chartTitle: {
      marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelsOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  labelContainer: {
    position: 'absolute',
    padding: 10,
  },
  labelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelValue: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 14,
  },
  memberList: {
      gap: 12,
  },
  memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 20,
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
  breakdownSection: {
      gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderRadius: 16,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.4,
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyChart: {
      alignItems: 'center',
      paddingVertical: 40,
  },
});
