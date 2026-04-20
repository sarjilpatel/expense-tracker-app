import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  SectionList,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import socketService from '@/src/services/socketService';

import { getTransactions } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [sections, setSections] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });

  const fetchTransactions = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getTransactions();
      groupTransactionsByDate(data);
      calculateSummary(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions(true);
    }, [fetchTransactions])
  );

  useEffect(() => {
    fetchTransactions();

    // Listen for real-time updates from other group members
    socketService.onNewTransaction(() => {
      fetchTransactions(true); // Refresh silently in the background
    });
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const calculateSummary = (transactions: any[]) => {
    let income = 0;
    let expense = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    });
    setSummary({ income, expense, balance: income - expense });
  };

  const groupTransactionsByDate = (transactions: any[]) => {
    const groups = transactions.reduce((acc: any, tx: any) => {
      const date = new Date(tx.createdAt).toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    }, {});

    const sectionData = Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
    setSections(sectionData);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.transactionItem, { backgroundColor: theme.card }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.type === 'income' ? `${theme.income}15` : `${theme.expense}15` }]}>
        <Ionicons
          name={item.type === 'income' ? 'arrow-down' : 'arrow-up'}
          size={20}
          color={item.type === 'income' ? theme.income : theme.expense}
        />
      </View>
      <View style={styles.details}>
        <ThemedText type="defaultSemiBold" style={styles.category}>{item.category}</ThemedText>
        <ThemedText style={styles.userName}>By {item.userId?.name || 'User'}</ThemedText>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[
          styles.amount,
          { color: item.type === 'income' ? theme.income : theme.expense }
        ]}>
          {item.type === 'income' ? '+' : '-'}{Currency.format(item.amount)}
        </Text>
        <ThemedText style={styles.time}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.sectionHeaderText}>{title}</ThemedText>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Hello,</ThemedText>
          <ThemedText type="title" style={styles.welcomeText}>Welcome Back</ThemedText>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
          <View style={styles.dot} />
        </TouchableOpacity>
      </View>

      <View style={[styles.balanceCard, { backgroundColor: theme.tint }]}>
        <View>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>{Currency.format(summary.balance)}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(52, 199, 89, 0.2)' }]}>
              <Ionicons name="arrow-down" size={14} color="#34C759" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>{Currency.format(summary.income)}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(255, 59, 48, 0.2)' }]}>
              <Ionicons name="arrow-up" size={14} color="#FF3B30" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryValue}>{Currency.format(summary.expense)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.historyHeader}>
        <ThemedText type="defaultSemiBold" style={styles.historyTitle}>Recent Activity</ThemedText>
        <TouchableOpacity><ThemedText style={{ color: theme.tint, fontWeight: '600' }}>See All</ThemedText></TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={theme.icon} style={{ opacity: 0.1, marginBottom: 16 }} />
            <ThemedText style={styles.emptyText}>No transactions yet</ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  greeting: {
    fontSize: 14,
    opacity: 0.6,
  },
  welcomeText: {
    fontSize: 24,
    lineHeight: 28,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  balanceCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 28,
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 30,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  details: {
    flex: 1,
  },
  category: {
    fontSize: 16,
    marginBottom: 2,
  },
  userName: {
    fontSize: 12,
    opacity: 0.5,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
  },
  time: {
    fontSize: 11,
    opacity: 0.4,
    marginTop: 4,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.4,
  },
});
