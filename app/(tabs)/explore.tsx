import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAnalytics } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFocusEffect } from 'expo-router';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await getAnalytics();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!data) return (
    <ThemedView style={styles.container}>
        <ThemedText style={{ textAlign: 'center', marginTop: 100 }}>No data available yet</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
      >
        <ThemedText type="title" style={styles.title}>Analytics</ThemedText>

        <View style={styles.summaryGrid}>
          <View style={[styles.mainCard, { backgroundColor: theme.tint }]}>
            <Text style={styles.cardLabel}>Savings</Text>
            <Text style={styles.cardValue}>{Currency.format(data.balance)}</Text>
            <View style={styles.cardFooter}>
                <Ionicons name="trending-up" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.cardFooterText}>Good Progress!</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${theme.income}15` }]}>
                <Ionicons name="arrow-down" size={20} color={theme.income} />
              </View>
              <ThemedText style={styles.statLabel}>Income</ThemedText>
              <Text style={[styles.statValue, { color: theme.income }]}>{Currency.format(data.totalIncome)}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${theme.expense}15` }]}>
                <Ionicons name="arrow-up" size={20} color={theme.expense} />
              </View>
              <ThemedText style={styles.statLabel}>Expenses</ThemedText>
              <Text style={[styles.statValue, { color: theme.expense }]}>{Currency.format(data.totalExpense)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Expense Breakdown</ThemedText>
          <View style={[styles.breakdownCard, { backgroundColor: theme.card }]}>
            {data.categoryBreakdown.length === 0 ? (
              <View style={styles.emptyBreakdown}>
                <Ionicons name="bar-chart-outline" size={48} color={theme.icon} style={{ opacity: 0.2, marginBottom: 12 }} />
                <ThemedText style={styles.emptyText}>No expenses tracked yet</ThemedText>
              </View>
            ) : (
              data.categoryBreakdown.map((item: any) => (
                <View key={item.category} style={styles.breakdownItem}>
                  <View style={styles.itemHeader}>
                    <ThemedText style={styles.itemCategory}>{item.category}</ThemedText>
                    <ThemedText style={styles.itemAmount}>{Currency.format(item.amount)}</ThemedText>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${item.percentage}%`,
                          backgroundColor: theme.tint 
                        }
                      ]} 
                    />
                  </View>
                  <ThemedText style={styles.itemPercentage}>{item.percentage}% of spending</ThemedText>
                </View>
              ))
            )}
          </View>
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 24,
  },
  summaryGrid: {
    marginBottom: 32,
  },
  mainCard: {
    padding: 24,
    borderRadius: 28,
    marginBottom: 16,
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardFooterText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  breakdownCard: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  breakdownItem: {
    marginBottom: 24,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  itemPercentage: {
    fontSize: 11,
    opacity: 0.5,
  },
  emptyBreakdown: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.4,
  },
});
