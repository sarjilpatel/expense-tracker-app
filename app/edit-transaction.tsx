import React, { useState, useEffect, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Currency } from '@/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { updateTransaction, getCurrentGroup } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';
import { getAccounts, getTxAccountMap, Account, setTxAccount } from '@/src/services/accountService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';

import { TypeSelector } from '@/components/transaction/TypeSelector';
import { AmountInput } from '@/components/transaction/AmountInput';
import { DateTimeField } from '@/components/transaction/DateTimeField';
import { CategoryDropdown } from '@/components/transaction/CategoryDropdown';
import { AccountPicker } from '@/components/transaction/AccountPicker';

export default function EditTransactionScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const params = useLocalSearchParams();
  const txId           = Array.isArray(params.id)       ? params.id[0]       : params.id;
  const initialCategory= Array.isArray(params.category) ? params.category[0] : params.category;
  const initialAmount  = Array.isArray(params.amount)   ? params.amount[0]   : params.amount;
  const initialType    = Array.isArray(params.type)     ? params.type[0]     : params.type;
  const initialNote    = Array.isArray(params.note)     ? params.note[0]     : params.note;
  const initialDate    = Array.isArray(params.date)     ? params.date[0]     : params.date;
  const initialIsPrivate = Array.isArray(params.isPrivate) ? params.isPrivate[0] : params.isPrivate;

  const [amount, setAmount]     = useState(initialAmount  || '');
  const [type, setType]         = useState<'income' | 'expense'>((initialType as any) || 'expense');
  const [category, setCategory] = useState<string | null>(initialCategory || null);
  const [note, setNote]         = useState(initialNote    || '');
  const [date, setDate]         = useState(initialDate ? new Date(initialDate) : new Date());
  const [loading, setLoading]   = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate === 'true');

  const fetchCategories = useCallback(async () => {
    try {
      const groupData = await getCurrentGroup();
      setCategories(groupData.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  useEffect(() => {
    Promise.all([getAccounts(), getTxAccountMap()]).then(([accs, map]) => {
      setAccounts(accs);
      if (txId && map[txId as string]) setSelectedAccountId(map[txId as string]);
    }).catch(() => {});
  }, [txId]);

  const dropdownData = categories
    .filter(c => c.type === type || c.type === 'both' || !c.type)
    .map(c => ({ label: t(c.name), value: c.name, icon: c.icon }));

  // Keep the old category visible even if it no longer exists in the list
  const finalDropdownData = [...dropdownData];
  if (category && !dropdownData.find(d => d.value === category)) {
    finalDropdownData.unshift({ label: `${t(category)} (Old)`, value: category, icon: 'alert-circle-outline' });
  }

  const handleTypeChange = (newType: 'income' | 'expense') => {
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
      await updateTransaction(txId as string, { amount: parsedAmount, type, category, note, date: date.toISOString(), isPrivate });
      if (txId) {
        if (selectedAccountId) await setTxAccount(txId as string, selectedAccountId);
      }
      await invalidateAllTransactionCache();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.msg || error.message || 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle">{t('edit_record')}</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {fetching ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <>
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
                  value={amount}
                  onChangeText={setAmount}
                  textColor={theme.text}
                  borderColor={theme.border}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>{t('category')}</ThemedText>
                <CategoryDropdown
                  data={finalDropdownData}
                  value={category}
                  onChange={setCategory}
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
                  value={note}
                  onChangeText={setNote}
                />
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
                style={[styles.submitBtn, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={theme.tintText} /> : (
                  <View style={styles.submitRow}>
                    <Ionicons name="save-outline" size={24} color={theme.tintText} />
                    <Text style={[styles.submitText, { color: theme.tintText }]}>{t('update')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingTop: 60 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 20 },
  backBtn:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 12, paddingTop: 16 },
  inputGroup:  { marginBottom: 24 },
  label:       { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  noteInput:   { borderRadius: 16, padding: 16, fontSize: 16, height: 120, textAlignVertical: 'top', borderWidth: 1 },
  submitBtn:   { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:   { color: '#FFF', fontSize: 18, fontWeight: '800' },
  privateRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  privateTextGroup: { flex: 1 },
  privateLabel: { fontSize: 15, fontWeight: '600' },
  privateHint:  { fontSize: 12, marginTop: 2 },
});
