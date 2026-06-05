import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Dropdown } from 'react-native-element-dropdown';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addTransaction } from '@/src/services/transactionApi';
import { getCurrentGroup, Category } from '@/src/services/groupApi';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/i18n/LanguageContext';

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const { prefillDate } = useLocalSearchParams<{ prefillDate?: string }>();
  const amountInputRef = useRef<TextInput>(null);
  const toggleAnim = useSharedValue(0);

  // When navigated from a date header, pre-fill the date field
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
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      // Auto-focus the amount field after a brief layout settle
      const timer = setTimeout(() => amountInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }, [fetchCategories])
  );

  const toggleKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(toggleAnim.value * 18 + 2, { damping: 15, stiffness: 200 }) }],
  }));

  const toggleBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toggleAnim.value, [0, 1], ['rgba(150,150,150,0.2)', '#6366F1']),
  }));

  const dropdownData = categories
    .filter(cat => cat.type === type || cat.type === 'both' || !cat.type)
    .map(cat => ({ 
      label: t(cat.name), 
      value: cat.name,
      icon: cat.icon
    }));

  const handleTypeChange = (newType: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setType(newType);
    setCategory(null);
  };

  const handleToggleRecurring = () => {
    const next = !isRecurring;
    toggleAnim.value = next ? 1 : 0;
    setIsRecurring(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
        // On Android, the picker is already closed when this is called
        if (selectedDate) setDate(selectedDate);
    } else {
        setShowDatePicker(false);
        if (selectedDate) setDate(selectedDate);
    }
  };

  const showPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        onChange: (event, selectedDate) => {
          if (selectedDate) {
            // After date is picked, show time picker
            DateTimePickerAndroid.open({
              value: selectedDate,
              onChange: (e, selectedTime) => {
                if (selectedTime) setDate(selectedTime);
              },
              mode: 'time',
              is24Hour: true,
            });
          }
        },
        mode: 'date',
        is24Hour: true,
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !category) {
      Alert.alert(t('missing_info') || 'Missing Information', 'Please provide an amount and select a category.');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        amount: parseFloat(amount),
        type,
        category,
        note,
        date: date.toISOString(),
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
      };
      await addTransaction(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount('');
      setCategory(null);
      setNote('');
      setDate(new Date());
      toggleAnim.value = 0;
      setIsRecurring(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = error.msg || error.message || error.toString() || 'Failed to add transaction';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">{t('new_record')}</ThemedText>
            <ThemedText style={styles.subtitle}>Keep your history accurate</ThemedText>
          </View>

          <View style={[styles.typeSelector, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'expense' && { backgroundColor: theme.expense }
              ]}
              onPress={() => handleTypeChange('expense')}
            >
              <Ionicons name="arrow-up-circle" size={20} color={type === 'expense' ? '#FFF' : theme.expense} />
              <Text style={[styles.typeText, type === 'expense' && styles.activeTypeText]}>{t('expenses')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'income' && { backgroundColor: theme.income }
              ]}
              onPress={() => handleTypeChange('income')}
            >
              <Ionicons name="arrow-down-circle" size={20} color={type === 'income' ? '#FFF' : theme.income} />
              <Text style={[styles.typeText, type === 'income' && styles.activeTypeText]}>{t('income')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('amount')}</ThemedText>
            <View style={[styles.amountWrapper, { backgroundColor: 'rgba(150, 150, 150, 0.05)', borderColor: theme.border }]}>
              <Text style={[styles.currencySymbol, { color: theme.text }]}>{Currency.symbol}</Text>
              <TextInput
                ref={amountInputRef}
                style={[styles.amountInput, { color: theme.text }]}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                value={amount}
                onChangeText={setAmount}
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('category')}</ThemedText>
            {fetching ? (
                 <ActivityIndicator size="small" color={theme.tint} />
            ) : (
                <Dropdown
                style={[styles.dropdown, { backgroundColor: 'rgba(150, 150, 150, 0.05)', borderColor: theme.border }]}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                itemTextStyle={{ color: theme.text }}
                containerStyle={{ backgroundColor: theme.card, borderRadius: 12 }}
                activeColor={`${theme.tint}20`}
                data={dropdownData}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select Category"
                search
                searchPlaceholder="Search..."
                value={category}
                onChange={item => setCategory(item.value)}
                renderLeftIcon={() => (
                    <View style={styles.dropdownIcon}>
                        <Ionicons name="grid-outline" size={20} color={theme.tint} />
                    </View>
                )}
                />
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Date & Time</ThemedText>
            <TouchableOpacity 
                style={[styles.datePickerBtn, { backgroundColor: 'rgba(150, 150, 150, 0.05)', borderColor: theme.border }]}
                onPress={showPicker}
            >
                <Ionicons name="calendar-outline" size={20} color={theme.tint} />
                <ThemedText style={styles.dateText}>
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="datetime"
                    is24Hour={true}
                    onChange={onDateChange}
                />
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t('note')}</ThemedText>
            <TextInput
              style={[
                styles.noteInput,
                { 
                  color: theme.text, 
                  backgroundColor: 'rgba(150, 150, 150, 0.05)',
                  borderColor: theme.border 
                }
              ]}
              placeholder="Enter details..."
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.recurringRow}>
              <View>
                <ThemedText style={styles.label}>Recurring</ThemedText>
                <ThemedText style={styles.recurringHint}>Auto-repeat this transaction</ThemedText>
              </View>
              <TouchableOpacity onPress={handleToggleRecurring} activeOpacity={0.9}>
                <Animated.View style={[styles.toggle, toggleBgStyle]}>
                  <Animated.View style={[styles.toggleKnob, toggleKnobStyle]} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            {isRecurring && (
              <View style={[styles.frequencyRow, { backgroundColor: 'rgba(150,150,150,0.08)', borderColor: theme.border }]}>
                {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.freqBtn,
                      recurrenceFrequency === freq && { backgroundColor: theme.tint }
                    ]}
                    onPress={() => setRecurrenceFrequency(freq)}
                  >
                    <Text style={[
                      styles.freqText,
                      { color: recurrenceFrequency === freq ? '#FFF' : theme.text }
                    ]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.submitContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.submitButtonText}>{t('save')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
  },
  typeButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  typeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  activeTypeText: {
    color: '#FFF',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.8,
  },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderRadius: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
  },
  dropdown: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  selectedTextStyle: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownIcon: {
    marginRight: 12,
  },
  datePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      gap: 12,
  },
  dateText: {
      fontSize: 16,
      fontWeight: '500',
  },
  noteInput: {
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  submitButton: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recurringHint: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  frequencyRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  freqText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
