import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import socketService from '@/src/services/socketService';
import { useAuth } from '@/src/context/AuthContext';
import { sendLocalNotification, LARGE_TRANSACTION_THRESHOLD } from '@/src/services/notificationService';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  Alert,
  TextInput,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTransactions, deleteTransaction, getAnalytics } from '@/src/services/transactionApi';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { getBudgets } from '@/src/services/budgetApi';
import { SkeletonLoader } from '@/components/SkeletonLoader';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_ICONS: Record<string, any> = {
  Food: 'fast-food-outline',
  Transport: 'bus-outline',
  Shopping: 'cart-outline',
  Rent: 'home-outline',
  Entertainment: 'game-controller-outline',
  Health: 'heart-outline',
  Bills: 'receipt-outline',
  Education: 'book-outline',
  Investment: 'trending-up-outline',
  Income: 'cash-outline',
  Salary: 'wallet-outline',
  Other: 'ellipsis-horizontal-outline',
};

// Groups a flat transaction array into dated sections with daily totals.
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
      title: g.dateObj.toLocaleDateString([], {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
      dateObj: g.dateObj,
      income: g.income,
      expense: g.expense,
      data: g.data,
    }));
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const searchInputRef = useRef<TextInput>(null);
  const hasData = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    socketService.onNewTransaction((tx) => {
      if (!user || tx.userId?._id === user._id) return;
      if (tx.amount >= LARGE_TRANSACTION_THRESHOLD) {
        sendLocalNotification(
          `Large ${tx.type} by ${tx.userId?.name || 'Member'}`,
          `${tx.type === 'expense' ? '-' : '+'}₹${tx.amount} · ${tx.category}`
        );
      }
      setAllTransactions(prev => [tx, ...prev]);
      setSummary(prev => ({
        ...prev,
        income: tx.type === 'income' ? prev.income + tx.amount : prev.income,
        expense: tx.type === 'expense' ? prev.expense + tx.amount : prev.expense,
        balance: tx.type === 'income' ? prev.balance + tx.amount : prev.balance - tx.amount,
      }));
      setNotifications(prev => [{
        id: tx._id,
        type: tx.type,
        title: `${tx.userId?.name || 'Someone'} added a transaction`,
        message: `${tx.type === 'expense' ? '-' : '+'}₹${tx.amount} · ${tx.category}`,
        time: new Date(tx.date || tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      }, ...prev].slice(0, 20));
    });

    socketService.onTransactionUpdated((updated) => {
      setAllTransactions(prev => prev.map(tx => tx._id === updated._id ? updated : tx));
    });

    socketService.onTransactionDeleted((deletedId) => {
      setAllTransactions(prev => prev.filter(tx => tx._id !== deletedId));
    });

    return () => {
      socketService.off('new_transaction');
      socketService.off('transaction_updated');
      socketService.off('transaction_deleted');
    };
  }, [user]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [txData, analyticsData, budgetsData] = await Promise.all([
        getTransactions(currentMonth, currentYear),
        getAnalytics(currentMonth, currentYear),
        getBudgets(),
      ]);
      setAllTransactions(txData);
      setSummary({
        income: analyticsData.totalIncome || 0,
        expense: analyticsData.totalExpense || 0,
        balance: analyticsData.balance || 0,
      });
      const mainBudget = budgetsData?.find((b: any) => !b.category) || null;
      setBudget(mainBudget);
      if (mainBudget && analyticsData.totalExpense) {
        const pct = (analyticsData.totalExpense / mainBudget.amount) * 100;
        if (pct >= 80 && pct < 100) sendLocalNotification('Budget Warning', t('budget_warning') || "You've used 80% of your monthly budget");
        else if (pct >= 100) sendLocalNotification('Budget Exceeded', t('budget_exceeded') || 'Budget exceeded!');
      }
      hasData.current = true;
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => { fetchData(hasData.current); }, [fetchData])
  );

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    hasData.current = false;
    fetchData(false);
  }, [currentMonth, currentYear]);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  const changeMonth = (delta: number) => {
    let m = currentMonth + delta, y = currentYear;
    if (m > 12) { m = 1; y++; } else if (m < 1) { m = 12; y--; }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  const filteredSections = useMemo(() => buildSections(
    searchQuery
      ? allTransactions.filter(tx =>
          tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : allTransactions
  ), [searchQuery, allTransactions]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(t('delete') || 'Delete', 'Are you sure you want to delete this record?', [
      { text: t('cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('delete') || 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previous = allTransactions;
          const removed = previous.find(tx => tx._id === id);
          setAllTransactions(prev => prev.filter(tx => tx._id !== id));
          if (removed) {
            setSummary(prev => ({
              income: removed.type === 'income' ? prev.income - removed.amount : prev.income,
              expense: removed.type === 'expense' ? prev.expense - removed.amount : prev.expense,
              balance: removed.type === 'income' ? prev.balance - removed.amount : prev.balance + removed.amount,
            }));
          }
          try {
            await deleteTransaction(id);
          } catch {
            setAllTransactions(previous);
            if (removed) {
              setSummary(prev => ({
                income: removed.type === 'income' ? prev.income + removed.amount : prev.income,
                expense: removed.type === 'expense' ? prev.expense + removed.amount : prev.expense,
                balance: removed.type === 'income' ? prev.balance + removed.amount : prev.balance - removed.amount,
              }));
            }
            Alert.alert('Error', 'Failed to delete transaction');
          }
        },
      },
    ]);
  }, [allTransactions, t]);

  const handleEdit = useCallback((item: any) => {
    router.push({
      pathname: '/edit-transaction',
      params: {
        id: item._id,
        amount: item.amount.toString(),
        type: item.type,
        category: item.category,
        note: item.note || '',
        date: item.date || item.createdAt,
      },
    });
  }, []);

  const budgetProgress = useMemo(() => {
    if (!budget?.amount) return 0;
    return Math.min((summary.expense / budget.amount) * 100, 100);
  }, [budget, summary.expense]);

  const renderSectionHeader = useCallback(({ section }: any) => {
    const d: Date = section.dateObj;
    const dayNum = d.getDate();
    const dayName = DAY_NAMES[d.getDay()];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const monthYr = d.toLocaleDateString([], { month: '2-digit', year: 'numeric' });
    const isToday = d.toDateString() === new Date().toDateString();

    return (
      <TouchableOpacity
        style={[styles.sectionHeader, { borderBottomColor: theme.border }]}
        onPress={() => router.push({ pathname: '/(tabs)/add', params: { prefillDate: d.toISOString() } })}
        activeOpacity={0.55}
      >
        <View style={styles.sectionLeft}>
          <Text style={[styles.sectionDayNum, { color: isToday ? theme.tint : theme.text }]}>
            {String(dayNum).padStart(2, '0')}
          </Text>
          <View>
            <View style={[styles.sectionDayBadge, { backgroundColor: isWeekend ? `${theme.expense}22` : `${theme.tint}18` }]}>
              <Text style={[styles.sectionDayName, { color: isWeekend ? theme.expense : theme.tint }]}>
                {dayName}
              </Text>
            </View>
            <Text style={[styles.sectionMonthYr, { color: theme.secondaryText }]}>{monthYr}</Text>
          </View>
        </View>
        <View style={styles.sectionRight}>
          {section.income > 0 && (
            <Text style={[styles.sectionAmount, { color: theme.income }]}>
              +{Currency.format(section.income)}
            </Text>
          )}
          {section.expense > 0 && (
            <Text style={[styles.sectionAmount, { color: theme.expense }]}>
              -{Currency.format(section.expense)}
            </Text>
          )}
          <Ionicons name="add-circle-outline" size={15} color={theme.tint} style={{ opacity: 0.5, marginLeft: 4 }} />
        </View>
      </TouchableOpacity>
    );
  }, [theme]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isExpense = item.type === 'expense';
    const iconName = CATEGORY_ICONS[item.category] || 'receipt-outline';
    const iconColor = isExpense ? theme.expense : theme.income;
    const iconBg = isExpense ? `${theme.expense}15` : `${theme.income}15`;
    const time = new Date(item.date || item.createdAt).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 30, 150)).duration(220)}
        layout={LinearTransition.springify().damping(18)}
      >
        <TouchableOpacity
          style={[styles.txRow, { borderBottomColor: theme.border }]}
          onPress={() => handleEdit(item)}
          onLongPress={() => handleDelete(item._id)}
          delayLongPress={500}
          activeOpacity={0.65}
        >
          {/* Category icon + label */}
          <View style={styles.txLeft}>
            <View style={[styles.txIconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={iconName} size={20} color={iconColor} />
            </View>
            <Text style={[styles.txCatLabel, { color: theme.secondaryText }]} numberOfLines={1}>
              {t(item.category)}
            </Text>
          </View>

          {/* Note / title + user · time */}
          <View style={styles.txMiddle}>
            <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>
              {item.note || t(item.category)}
            </Text>
            <View style={styles.txMetaRow}>
              {item.userId?.profilePhoto ? (
                <Image source={{ uri: item.userId.profilePhoto }} style={styles.txUserPhoto} />
              ) : (
                <View style={[styles.txUserInitials, { backgroundColor: `${theme.tint}30` }]}>
                  <Text style={[styles.txInitialsText, { color: theme.tint }]}>
                    {(item.userId?.name || 'U').charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={[styles.txMeta, { color: theme.secondaryText }]} numberOfLines={1}>
                {item.userId?.name || 'Me'} · {time}
              </Text>
              {item.isRecurring && (
                <Ionicons name="repeat-outline" size={11} color={theme.tint} style={{ opacity: 0.7 }} />
              )}
            </View>
          </View>

          {/* Amount */}
          <Text style={[styles.txAmount, { color: isExpense ? theme.expense : theme.income }]}>
            {isExpense ? '-' : '+'}{Currency.format(item.amount)}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [theme, t, handleDelete, handleEdit]);

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 140, height: 24, borderRadius: 8, backgroundColor: 'rgba(150,150,150,0.1)' }} />
        </View>
        <View style={[styles.summaryStrip, { backgroundColor: theme.card }]}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 50, height: 11, borderRadius: 5, backgroundColor: 'rgba(150,150,150,0.12)' }} />
              <View style={{ width: 72, height: 16, borderRadius: 6, backgroundColor: 'rgba(150,150,150,0.1)' }} />
            </View>
          ))}
        </View>
        <SkeletonLoader rows={6} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={15}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.monthText}>
            {MONTHS[currentMonth - 1]} {currentYear}
          </ThemedText>
          <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={15}>
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.card }]}
            onPress={() => {
              const next = !showSearch;
              setShowSearch(next);
              if (next) setTimeout(() => searchInputRef.current?.focus(), 60);
              else setSearchQuery('');
            }}
          >
            <Ionicons name={showSearch ? 'close' : 'search-outline'} size={19} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.card }]}
            onPress={() => setShowNotifications(true)}
          >
            <Ionicons name="notifications-outline" size={19} color={theme.text} />
            {notifications.length > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Summary strip ── */}
      <View style={[styles.summaryStrip, { backgroundColor: theme.card }]}>
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>{t('income')}</Text>
          <Text style={[styles.summaryVal, { color: theme.income }]}>{Currency.format(summary.income)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>{t('expenses')}</Text>
          <Text style={[styles.summaryVal, { color: theme.expense }]}>{Currency.format(summary.expense)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Total</Text>
          <Text style={[styles.summaryVal, { color: summary.balance >= 0 ? theme.income : theme.expense }]}>
            {Currency.format(summary.balance)}
          </Text>
        </View>
      </View>

      {/* ── Budget bar ── */}
      {budget && (
        <View style={[styles.budgetBar, { backgroundColor: theme.card }]}>
          <View style={styles.budgetBarMeta}>
            <Text style={[styles.budgetBarLabel, { color: theme.secondaryText }]}>
              Budget · {Math.round(budgetProgress)}%
            </Text>
            <Text style={[styles.budgetBarRemaining, { color: budgetProgress >= 100 ? theme.expense : theme.secondaryText }]}>
              {Currency.format(Math.max(budget.amount - summary.expense, 0))} left
            </Text>
          </View>
          <View style={[styles.budgetBarTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.budgetBarFill, {
              width: `${budgetProgress}%` as any,
              backgroundColor: budgetProgress >= 100 ? theme.expense : budgetProgress >= 80 ? '#F59E0B' : '#34D399',
            }]} />
          </View>
        </View>
      )}

      {/* ── Budget alert banner ── */}
      {budget && budgetProgress >= 80 && (
        <Animated.View entering={FadeInDown} style={[styles.budgetAlert, {
          backgroundColor: budgetProgress >= 100 ? `${theme.expense}15` : '#FEF3C715',
        }]}>
          <Ionicons
            name={budgetProgress >= 100 ? 'warning' : 'alert-circle-outline'}
            size={15}
            color={budgetProgress >= 100 ? theme.expense : '#D97706'}
          />
          <ThemedText style={[styles.budgetAlertText, { color: budgetProgress >= 100 ? theme.expense : '#D97706' }]}>
            {budgetProgress >= 100 ? t('budget_exceeded') : t('budget_warning')}
          </ThemedText>
        </Animated.View>
      )}

      {/* ── Search bar (collapsible) ── */}
      {showSearch && (
        <Animated.View entering={FadeInDown.duration(160)} style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={16} color={theme.secondaryText} />
          <TextInput
            ref={searchInputRef}
            placeholder={t('search_placeholder')}
            placeholderTextColor={theme.secondaryText}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={15} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* ── Transaction list ── */}
      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={12}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={theme.secondaryText} style={{ opacity: 0.15, marginBottom: 12 }} />
            <ThemedText style={styles.emptyText}>{t('no_transactions')}</ThemedText>
          </View>
        }
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.tint }]}
        onPress={() => router.push('/(tabs)/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* ── Notifications modal ── */}
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
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryDivider: {
    width: 1,
    height: '55%',
    alignSelf: 'center',
  },
  // Budget bar
  budgetBar: {
    marginHorizontal: 20,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  budgetBarMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  budgetBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetBarRemaining: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetBarTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  // Budget alert
  budgetAlert: {
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  budgetAlertText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 120,
  },
  // Section header (tappable date row)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionDayNum: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    minWidth: 40,
  },
  sectionDayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 3,
    alignSelf: 'flex-start',
  },
  sectionDayName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionMonthYr: {
    fontSize: 10,
    fontWeight: '600',
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Transaction row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txLeft: {
    alignItems: 'center',
    width: 60,
    marginRight: 12,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  txCatLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  txMiddle: {
    flex: 1,
    marginRight: 10,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txUserPhoto: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  txUserInitials: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInitialsText: {
    fontSize: 8,
    fontWeight: '800',
  },
  txMeta: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    minWidth: 68,
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 104,
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 100,
  },
  // Notifications modal
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
