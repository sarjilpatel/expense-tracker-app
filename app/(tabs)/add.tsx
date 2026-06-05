import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { addTransaction } from '@/src/services/transactionApi';
import { getCurrentGroup, Category } from '@/src/services/groupApi';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';

import { TypeSelector } from '@/components/transaction/TypeSelector';
import { AmountInput } from '@/components/transaction/AmountInput';
import { DateTimeField } from '@/components/transaction/DateTimeField';
import { CategoryDropdown } from '@/components/transaction/CategoryDropdown';
import { RecurringToggle } from '@/components/transaction/RecurringToggle';

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const { prefillDate } = useLocalSearchParams<{ prefillDate?: string }>();
  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (prefillDate) {
      const d = new Date(prefillDate as string);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setDate(d);
    }
  }, [prefillDate]);

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

  useFocusEffect(useCallback(() => {
    fetchCategories();
    const timer = setTimeout(() => amountInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [fetchCategories]));

  const dropdownData = categories
    .filter(c => c.type === type || c.type === 'both' || !c.type)
    .map(c => ({ label: t(c.name), value: c.name, icon: c.icon }));

  const handleTypeChange = (newType: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setType(newType);
    setCategory(null);
  };

  const handleSubmit = async () => {
    if (!amount || !category) {
      Alert.alert(t('missing_info') || 'Missing Information', 'Please provide an amount and select a category.');
      return;
    }
    setLoading(true);
    try {
      await addTransaction({
        amount: parseFloat(amount),
        type,
        category,
        note,
        date: date.toISOString(),
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount(''); setCategory(null); setNote(''); setDate(new Date()); setIsRecurring(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.msg || error.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
            <ThemedText style={styles.label}>{t('category')}</ThemedText>
            <CategoryDropdown
              data={dropdownData}
              value={category}
              onChange={setCategory}
              loading={fetching}
              tintColor={theme.tint}
              textColor={theme.text}
              cardColor={theme.card}
              borderColor={theme.border}
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
              style={[styles.noteInput, { color: theme.text, backgroundColor: 'rgba(150,150,150,0.05)', borderColor: theme.border }]}
              placeholder="Enter details..."
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
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

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <View style={styles.submitRow}>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.submitText}>{t('save')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingTop: 60 },
  scrollContent: { padding: 24 },
  header:      { marginBottom: 32 },
  subtitle:    { fontSize: 16, opacity: 0.6, marginTop: 4 },
  inputGroup:  { marginBottom: 24 },
  label:       { fontSize: 14, fontWeight: '600', marginBottom: 10, opacity: 0.8 },
  noteInput:   { borderRadius: 16, padding: 16, fontSize: 16, height: 120, textAlignVertical: 'top', borderWidth: 1 },
  submitBtn:   { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:  { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
