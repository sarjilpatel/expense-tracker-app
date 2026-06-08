import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, StyleSheet, Text, Image, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';


import { useTheme } from '@/src/context/ThemeContext';
import { getCategoryColors } from '@/constants/theme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { addTransaction, getCurrentGroup, getTransactions } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';
import { getAccounts, getTxAccountMap, Account, setTxAccount } from '@/src/services/accountService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { saveReceipt } from '@/src/services/receiptService';

import { TypeSelector } from '@/components/transaction/TypeSelector';
import { AmountInput } from '@/components/transaction/AmountInput';
import { DateTimeField } from '@/components/transaction/DateTimeField';
import { CategoryDropdown } from '@/components/transaction/CategoryDropdown';
import { RecurringToggle } from '@/components/transaction/RecurringToggle';
import { AccountPicker } from '@/components/transaction/AccountPicker';
import { CurrencyPicker } from '@/components/transaction/CurrencyPicker';
import type { CurrencyCode } from '@/src/services/preferencesService';

const SHORTCUT_ICONS: Record<string, string> = {
  'Food': 'restaurant',
  'Transport': 'car',
  'Shopping': 'cart',
  'Health': 'heart',
  'Entertainment': 'game-controller',
  'Bills': 'receipt',
  'Rent': 'home',
  'Education': 'book',
  'Salary': 'cash',
  'Business': 'briefcase',
  'Investment': 'trending-up',
  'Other': 'ellipsis-horizontal',
};

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [isPrivate, setIsPrivate] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [showPrivateTip, setShowPrivateTip] = useState(false);

  const { prefillDate, prefillAccountId } = useLocalSearchParams<{ prefillDate?: string; prefillAccountId?: string }>();
  const amountInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // Warn if user tries to leave with unsaved data
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove' as any, (e: any) => {
      if (!amount && !note && !category) return;
      e.preventDefault();
      Alert.alert(
        'Discard transaction?',
        'You have unsaved changes. Leave without saving?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsub;
  }, [navigation, amount, note, category]);

  useEffect(() => {
    if (prefillDate) {
      const d = new Date(prefillDate as string);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setDate(d);
    }
    if (prefillAccountId) setSelectedAccountId(prefillAccountId as string);
  }, [prefillDate, prefillAccountId]);

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
    // Show one-time "Private" tooltip on first visit
    AsyncStorage.getItem('@private_tip_shown').then(val => {
      if (!val) setShowPrivateTip(true);
    });
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setFetching(true);
      const groupData = await getCurrentGroup();
      setCategories(groupData.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchRecentCategories = useCallback(async () => {
    try {
      const txs = await getTransactions();
      if (Array.isArray(txs)) {
        const counts: Record<string, number> = {};
        const recency: Record<string, number> = {};
        txs.forEach((tx: any, idx: number) => {
          if (tx.type === type && tx.category) {
            counts[tx.category] = (counts[tx.category] || 0) + 1;
            if (recency[tx.category] === undefined) {
              recency[tx.category] = txs.length - idx;
            }
          }
        });
        const sorted = Object.keys(counts).sort((a, b) => {
          const recencyA = recency[a] || 0;
          const recencyB = recency[b] || 0;
          return recencyB - recencyA;
        });
        setRecentCategories(sorted.slice(0, 6));
      }
    } catch {}
  }, [type]);

  useFocusEffect(useCallback(() => {
    fetchCategories();
    fetchRecentCategories();
    const timer = setTimeout(() => amountInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [fetchCategories, fetchRecentCategories]));

  const dropdownData = categories
    .filter(c => c.type === type || c.type === 'both' || !c.type)
    .map(c => ({ label: t(c.name), value: c.name, icon: c.icon }));

  const pickReceipt = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to attach a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  }, []);

  const handleTypeChange = (newType: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setType(newType);
    setCategory(null);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('missing_info') || 'Missing Information', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!category) {
      Alert.alert(t('missing_info') || 'Missing Information', 'Please select a category.');
      return;
    }
    setLoading(true);
    try {
      const newTx = await addTransaction({
        amount: parsedAmount,
        type,
        category,
        note,
        date: date.toISOString(),
        currency,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
        isPrivate,
      });
      if (selectedAccountId && newTx?._id) {
        await setTxAccount(newTx._id, selectedAccountId);
      }
      if (receiptUri && newTx?._id) {
        await saveReceipt(newTx._id, receiptUri).catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateAllTransactionCache();
      setAmount(''); setCategory(null); setNote(''); setDate(new Date()); setIsRecurring(false); setSelectedAccountId(null); setReceiptUri(null); setCurrency('INR'); setIsPrivate(false);
      setSuccessToast(true);
      setTimeout(() => { setSuccessToast(false); router.replace('/(tabs)'); }, 1500);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.msg || error.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">{t('new_record')}</ThemedText>
            <ThemedText style={styles.subtitle}>Keep your history accurate</ThemedText>
          </View>

          <TypeSelector
            type={type}
            onChange={handleTypeChange}
            incomeLabel={t('income')}
            expenseLabel={t('expenses')}
            incomeColor={theme.income}
            expenseColor={theme.expense}
          />

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('amount')}</ThemedText>
            <AmountInput
              ref={amountInputRef}
              value={amount}
              onChangeText={setAmount}
              textColor={theme.text}
              borderColor={theme.border}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Currency</ThemedText>
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('category')}</ThemedText>
            {recentCategories.length > 0 && (
              <View style={styles.recentGroup}>
                <Text style={[styles.recentLabel, { color: theme.secondaryText }]}>Recently Used Shortcuts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
                  {recentCategories.map(cat => {
                    const isSelected = category === cat;
                    const iconName = SHORTCUT_ICONS[cat] || 'grid-outline';
                    const activeColor = type === 'income' ? theme.income : theme.expense;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.recentChip,
                          {
                            backgroundColor: theme.cardAlt,
                            borderColor: activeColor,
                            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                          }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCategory(cat);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={iconName as any} size={20} color={activeColor} />
                        <Text style={[styles.recentChipText, { color: theme.text }]} numberOfLines={1}>
                          {t(cat)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <CategoryDropdown
              data={dropdownData}
              value={category}
              onChange={setCategory}
              loading={fetching}
              tintColor={theme.tint}
              textColor={theme.text}
              cardColor={theme.card}
              borderColor={theme.border}
              onRetry={fetchCategories}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Date & Time</ThemedText>
            <DateTimeField
              value={date}
              onChange={setDate}
              tintColor={theme.tint}
              borderColor={theme.border}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('note')}</ThemedText>
            <TextInput
              style={[styles.noteInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              placeholder="Enter details..."
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit
              value={note}
              onChangeText={setNote}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Receipt</ThemedText>
            <TouchableOpacity
              style={[styles.receiptBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={pickReceipt}
              activeOpacity={0.7}
            >
              {receiptUri ? (
                <View style={styles.receiptRow}>
                  <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
                  <Text style={[styles.receiptLabel, { color: theme.text }]}>Receipt attached</Text>
                  <TouchableOpacity onPress={() => setReceiptUri(null)}>
                    <Ionicons name="close-circle" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.receiptRow}>
                  <Ionicons name="camera-outline" size={20} color={theme.tint} />
                  <Text style={[styles.receiptLabel, { color: theme.secondaryText }]}>Add receipt photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Account</ThemedText>
            <AccountPicker
              accounts={accounts}
              selectedId={selectedAccountId}
              onChange={setSelectedAccountId}
              theme={theme}
            />
          </View>

          <View style={styles.inputGroup}>
            <RecurringToggle
              enabled={isRecurring}
              frequency={recurrenceFrequency}
              onToggle={() => setIsRecurring(v => !v)}
              onFrequencyChange={setRecurrenceFrequency}
              tintColor={theme.tint}
              textColor={theme.text}
              borderColor={theme.border}
            />
          </View>

          {showPrivateTip && (
            <TouchableOpacity
              style={[styles.privateTip, { backgroundColor: theme.tint + '18', borderColor: theme.tint }]}
              onPress={async () => {
                setShowPrivateTip(false);
                await AsyncStorage.setItem('@private_tip_shown', '1');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle-outline" size={18} color={theme.tint} />
              <Text style={[styles.privateTipText, { color: theme.tint }]}>
                Transactions are shared with your group by default. Toggle <Text style={{ fontWeight: '800' }}>Private</Text> below to hide one from others.
              </Text>
              <Ionicons name="close" size={16} color={theme.tint} />
            </TouchableOpacity>
          )}

          <View style={[styles.privateRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.privateTextGroup}>
              <ThemedText style={styles.privateLabel}>Private transaction</ThemedText>
              <ThemedText style={[styles.privateHint, { color: theme.secondaryText }]}>Only visible to you</ThemedText>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: theme.border, true: theme.tint }}
              thumbColor="#FFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.tint, shadowColor: theme.tint }, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={theme.tintText} /> : (
              <View style={styles.submitRow}>
                <Ionicons name="checkmark-circle" size={24} color={theme.tintText} />
                <Text style={[styles.submitText, { color: theme.tintText }]}>Add Transaction</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
      {successToast && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.successToastText}>Transaction added!</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingTop: 60 },
  scrollContent: { paddingHorizontal: 12, paddingTop: 16 },
  header:      { marginBottom: 32 },
  subtitle:    { fontSize: 16, marginTop: 4 },
  inputGroup:  { marginBottom: 24 },
  label:       { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  noteInput:   { borderRadius: 12, padding: 16, fontSize: 16, height: 120, textAlignVertical: 'top', borderWidth: 1 },
  receiptBtn:  { borderRadius: 12, borderWidth: 1, padding: 14 },
  receiptRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptThumb:{ width: 44, height: 44, borderRadius: 8 },
  receiptLabel:{ flex: 1, fontSize: 14 },
  submitBtn:   { height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:   { color: '#FFF', fontSize: 18, fontWeight: '800' },
  privateRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 24 },
  privateTextGroup: { flex: 1 },
  privateLabel: { fontSize: 15, fontWeight: '600' },
  privateHint:  { fontSize: 12, marginTop: 2 },
  privateTip:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  privateTipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  successToast: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#34C759', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  successToastText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  recentGroup: {
    marginBottom: 16,
  },
  recentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  recentChip: {
    width: 68,
    height: 68,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  recentChipText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
});
