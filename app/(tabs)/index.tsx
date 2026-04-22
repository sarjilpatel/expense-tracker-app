import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTransactions, deleteTransaction, getAnalytics } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Animated, { 
    FadeInDown, 
    FadeInRight, 
    Layout, 
    FadeIn 
} from 'react-native-reanimated';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { getBudgets } from '@/src/services/budgetApi';

const { width: screenWidth } = Dimensions.get('window');

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Map categories to modern icons
const CATEGORY_ICONS: Record<string, any> = {
  'Food': 'fast-food-outline',
  'Transport': 'bus-outline',
  'Shopping': 'cart-outline',
  'Rent': 'home-outline',
  'Entertainment': 'game-controller-outline',
  'Health': 'heart-outline',
  'Bills': 'receipt-outline',
  'Education': 'book-outline',
  'Investment': 'trending-up-outline',
  'Income': 'cash-outline',
  'Salary': 'wallet-outline',
  'Other': 'ellipsis-horizontal-outline',
};

export default function HomeScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const searchInputRef = useRef<TextInput>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [txData, analyticsData, budgetsData] = await Promise.all([
        getTransactions(currentMonth, currentYear),
        getAnalytics(currentMonth, currentYear),
        getBudgets()
      ]);

      setAllTransactions(txData);
      groupTransactionsByDate(txData);
      
      setSummary({
        income: analyticsData.totalIncome || 0,
        expense: analyticsData.totalExpense || 0,
        balance: analyticsData.balance || 0
      });

      // Find budget for current month
      if (budgetsData && budgetsData.length > 0) {
        setBudget(budgetsData[0]);
      } else {
        setBudget(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const groupTransactionsByDate = (transactions: any[]) => {
    const groups = transactions.reduce((acc: any, tx: any) => {
      const dateKey = new Date(tx.date || tx.createdAt).toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(tx);
      return acc;
    }, {});

    const sectionData = Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
    setSections(sectionData);
  };

  const filteredSections = useMemo(() => {
    let listToGroup = allTransactions;
    if (searchQuery) {
        listToGroup = allTransactions.filter(tx => 
            tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    const groups = listToGroup.reduce((acc: any, tx: any) => {
      const dateKey = new Date(tx.date || tx.createdAt).toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(tx);
      return acc;
    }, {});

    return Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
  }, [searchQuery, sections, allTransactions]);

  const handleDelete = (id: string) => {
    Alert.alert(
      t('delete') || 'Delete',
      'Are you sure you want to delete this record?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { 
          text: t('delete') || 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteTransaction(id);
              fetchData(true);
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete transaction');
            }
          }
        }
      ]
    );
  };

  const handleEdit = (item: any) => {
    router.push({
      pathname: '/edit-transaction',
      params: {
        id: item._id,
        amount: item.amount.toString(),
        type: item.type,
        category: item.category,
        note: item.note || '',
        date: item.date || item.createdAt
      }
    });
  };

  const budgetProgress = useMemo(() => {
    if (!budget || !budget.amount || budget.amount === 0) return 0;
    const expense = summary.expense || 0;
    return Math.min((expense / budget.amount) * 100, 100);
  }, [budget, summary.expense]);

  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isExpense = item.type === 'expense';
    const iconName = CATEGORY_ICONS[item.category] || 'receipt-outline';
    
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50)}
        layout={Layout.springify()}
      >
        <TouchableOpacity 
          style={[styles.transactionItem, { backgroundColor: theme.card }]}
          onPress={() => handleEdit(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: isExpense ? `${theme.expense}10` : `${theme.income}10` }]}>
            <Ionicons name={iconName} size={24} color={isExpense ? theme.expense : theme.income} />
          </View>
          
          <View style={styles.details}>
            <ThemedText type="defaultSemiBold" style={styles.categoryName}>{t(item.category)}</ThemedText>
            <View style={styles.userRow}>
               <View style={styles.userBadge}>
                    {item.userId?.profilePhoto ? (
                        <Image source={{ uri: item.userId.profilePhoto }} style={styles.userTinyPhoto} />
                    ) : (
                        <View style={[styles.userInitials, { backgroundColor: theme.tint + '40' }]}>
                            <Text style={styles.initialsText}>{(item.userId?.name || 'U').charAt(0)}</Text>
                        </View>
                    )}
                    <ThemedText style={styles.userName}>{item.userId?.name || 'Unknown'}</ThemedText>
               </View>
               {item.note && (
                   <View style={styles.noteIndicator}>
                       <Ionicons name="document-text-outline" size={12} color={theme.secondaryText} />
                   </View>
               )}
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={[
              styles.amountText,
              { color: isExpense ? theme.expense : theme.income }
            ]}>
              {isExpense ? '-' : '+'}{Currency.format(item.amount)}
            </Text>
            <ThemedText style={styles.timeText}>
              {new Date(item.date || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </ThemedText>
          </View>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => handleDelete(item._id)}
          >
            <Ionicons name="trash-outline" size={18} color={theme.danger} style={{ opacity: 0.3 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>{t('hello')}, 👋</ThemedText>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={15}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.welcomeText}>
              {MONTHS[currentMonth - 1]} {currentYear}
            </ThemedText>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={15}>
              <Ionicons name="chevron-forward" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity 
            style={[styles.notificationBtn, { backgroundColor: theme.card }]}
            onPress={() => setShowNotifications(true)}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
          {notifications.length > 0 && <View style={styles.dot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={18} color={theme.secondaryText} />
          <TextInput
            ref={searchInputRef}
            placeholder={t('search_placeholder')}
            placeholderTextColor={theme.secondaryText}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInRight} style={styles.balanceOuter}>
                <LinearGradient
                    colors={[theme.tint, '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.balanceCard}
                >
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.balanceLabel}>{t('current_balance')}</Text>
                            <Text style={styles.balanceAmount}>{Currency.format(summary.balance)}</Text>
                        </View>
                        <View style={styles.cardChip}>
                            <Ionicons name="radio-outline" size={24} color="rgba(255,255,255,0.8)" />
                        </View>
                    </View>

                    <View style={styles.summaryRow}>
                        <View style={styles.summaryBox}>
                            <View style={styles.incomeCircle}>
                                <Ionicons name="arrow-down" size={14} color="#FFF" />
                            </View>
                            <View>
                                <Text style={styles.boxLabel}>{t('income')}</Text>
                                <Text style={styles.boxValue}>{Currency.format(summary.income)}</Text>
                            </View>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.summaryBox}>
                            <View style={styles.expenseCircle}>
                                <Ionicons name="arrow-up" size={14} color="#FFF" />
                            </View>
                            <View>
                                <Text style={styles.boxLabel}>{t('expenses')}</Text>
                                <Text style={styles.boxValue}>{Currency.format(summary.expense)}</Text>
                            </View>
                        </View>
                    </View>

                    {budget && (
                        <View style={styles.budgetSection}>
                            <View style={styles.budgetMeta}>
                                <Text style={styles.budgetTitle}>Monthly Limit</Text>
                                <Text style={styles.budgetPercent}>{Math.round(budgetProgress)}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${budgetProgress}%`, backgroundColor: budgetProgress > 90 ? '#FB7185' : '#34D399' }]} />
                            </View>
                        </View>
                    )}
                </LinearGradient>
            </Animated.View>

            <View style={styles.historyHeader}>
              <ThemedText type="defaultSemiBold" style={styles.historyTitle}>{t('recent_activity')}</ThemedText>
              <TouchableOpacity onPress={() => searchInputRef.current?.focus()}>
                  <ThemedText style={{ color: theme.tint, fontWeight: '700', fontSize: 13 }}>{t('see_all')}</ThemedText>
              </TouchableOpacity>
            </View>
          </>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={theme.secondaryText} style={{ opacity: 0.2, marginBottom: 12 }} />
            <ThemedText style={styles.emptyText}>{t('no_transactions')}</ThemedText>
          </View>
        }
      />

      <Modal visible={showNotifications} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInDown} style={[styles.notificationCard, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                    <ThemedText type="subtitle">Notifications</ThemedText>
                    <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
                
                <ScrollView showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                        <View style={styles.emptyNotifications}>
                            <Ionicons name="notifications-off-outline" size={56} color={theme.icon} style={{ opacity: 0.1 }} />
                            <ThemedText style={{ opacity: 0.4, marginTop: 16 }}>Everything caught up!</ThemedText>
                        </View>
                    ) : (
                        notifications.map((notif) => (
                            <TouchableOpacity key={notif.id} style={[styles.notifItem, { borderBottomColor: theme.border }]}>
                                <View style={[styles.notifIcon, { backgroundColor: notif.type === 'income' ? `${theme.income}20` : `${theme.expense}20` }]}>
                                    <Ionicons name={notif.type === 'income' ? 'arrow-down' : 'arrow-up'} size={18} color={notif.type === 'income' ? theme.income : theme.expense} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <ThemedText type="defaultSemiBold">{notif.title}</ThemedText>
                                    <ThemedText style={styles.notifMessage}>{notif.message}</ThemedText>
                                    <ThemedText style={styles.notifTime}>{notif.time}</ThemedText>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </Animated.View>
        </View>
      </Modal>
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
    marginBottom: 20,
  },
  greeting: {
    fontSize: 13,
    opacity: 0.5,
    fontWeight: '500',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '800',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  balanceOuter: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  balanceCard: {
    padding: 24,
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 6,
  },
  cardChip: {
    opacity: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
  },
  summaryBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  incomeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(52, 211, 153, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 63, 94, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  boxValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  budgetSection: {
    marginTop: 20,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  budgetPercent: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
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
    fontWeight: '800',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  listContent: {
    paddingBottom: 100,
  },
  transactionItem: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  details: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(150,150,150,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  userTinyPhoto: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  userInitials: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  userName: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
  },
  noteIndicator: {
    opacity: 0.4,
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginRight: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '900',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.4,
    marginTop: 2,
  },
  actionBtn: {
    padding: 6,
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  notificationCard: {
    height: '75%',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    padding: 4,
  },
  emptyNotifications: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifMessage: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    opacity: 0.4,
    marginTop: 4,
    fontWeight: '600',
  },
});
