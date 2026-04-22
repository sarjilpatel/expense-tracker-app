import React, { useState, useEffect, useCallback } from 'react';
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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Dropdown } from 'react-native-element-dropdown';
import { Colors, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { updateTransaction } from '@/src/services/transactionApi';
import { getCurrentGroup, Category } from '@/src/services/groupApi';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/i18n/LanguageContext';

export default function EditTransactionScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];
  
  const params = useLocalSearchParams();
  const txId = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const initialAmount = Array.isArray(params.amount) ? params.amount[0] : params.amount;
  const initialType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialNote = Array.isArray(params.note) ? params.note[0] : params.note;
  const initialDate = Array.isArray(params.date) ? params.date[0] : params.date;

  const [amount, setAmount] = useState(initialAmount || '');
  const [type, setType] = useState<'income' | 'expense'>((initialType as any) || 'expense');
  const [category, setCategory] = useState<string | null>(initialCategory || null);
  const [note, setNote] = useState(initialNote || '');
  const [date, setDate] = useState(initialDate ? new Date(initialDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const groupData = await getCurrentGroup();
      setCategories(groupData.categories || []);
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
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

  const dropdownData = categories
    .filter(cat => cat.type === type || cat.type === 'both' || !cat.type)
    .map(cat => ({ 
      label: t(cat.name), 
      value: cat.name,
      icon: cat.icon
    }));

  const handleTypeChange = (newType: 'income' | 'expense') => {
      setType(newType);
      setCategory(null);
  };

  const finalDropdownData = [...dropdownData];
  if (category && !dropdownData.find(d => d.value === category)) {
      finalDropdownData.unshift({
          label: t(category) + ' (Old)',
          value: category,
          icon: 'alert-circle-outline'
      });
  }

  const handleSubmit = async () => {
    if (!amount || !category) {
      Alert.alert(t('missing_info') || 'Missing Information', 'Please provide an amount and select a category.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        amount: parseFloat(amount),
        type,
        category,
        note,
        date: date.toISOString(),
      };
      await updateTransaction(txId as string, data);
      Alert.alert('Success', 'Transaction updated successfully!', [
        { text: 'Great', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      const errorMsg = error.msg || error.message || error.toString() || 'Failed to update transaction';
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
                    style={[styles.amountInput, { color: theme.text }]}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#A0A0A0"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>{t('category')}</ThemedText>
                <Dropdown
                  style={[styles.dropdown, { backgroundColor: 'rgba(150, 150, 150, 0.05)', borderColor: theme.border }]}
                  placeholderStyle={styles.placeholderStyle}
                  selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                  itemTextStyle={{ color: theme.text }}
                  containerStyle={{ backgroundColor: theme.card, borderRadius: 12 }}
                  activeColor={`${theme.tint}20`}
                  data={finalDropdownData}
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

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={styles.submitContainer}>
                    <Ionicons name="save-outline" size={24} color="#FFF" />
                    <Text style={styles.submitButtonText}>{t('update')}</Text>
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
  container: {
    flex: 1,
    paddingTop: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
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
});
