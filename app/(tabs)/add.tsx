import React, { useState } from 'react';
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
import { Dropdown } from 'react-native-element-dropdown';
import { Colors, CATEGORIES, Currency } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addTransaction } from '@/src/services/transactionApi';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const dropdownData = CATEGORIES.map(cat => ({ 
    label: cat.name, 
    value: cat.name,
    icon: cat.icon
  }));

  const handleSubmit = async () => {
    if (!amount || !category) {
      Alert.alert('Missing Information', 'Please provide an amount and select a category.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        amount: parseFloat(amount),
        type,
        category,
        note,
      };
      await addTransaction(data);
      Alert.alert('Success', 'Transaction saved successfully!', [
        { text: 'Great', onPress: () => router.replace('/(tabs)') }
      ]);
      setAmount('');
      setCategory(null);
      setNote('');
    } catch (error: any) {
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
            <ThemedText type="title">New Record</ThemedText>
            <ThemedText style={styles.subtitle}>Keep your history accurate</ThemedText>
          </View>

          <View style={[styles.typeSelector, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'expense' && { backgroundColor: theme.expense }
              ]}
              onPress={() => setType('expense')}
            >
              <Ionicons name="arrow-up-circle" size={20} color={type === 'expense' ? '#FFF' : theme.expense} />
              <Text style={[styles.typeText, type === 'expense' && styles.activeTypeText]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'income' && { backgroundColor: theme.income }
              ]}
              onPress={() => setType('income')}
            >
              <Ionicons name="arrow-down-circle" size={20} color={type === 'income' ? '#FFF' : theme.income} />
              <Text style={[styles.typeText, type === 'income' && styles.activeTypeText]}>Income</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Amount</ThemedText>
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
            <ThemedText style={styles.label}>Category</ThemedText>
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
            <ThemedText style={styles.label}>Note (Optional)</ThemedText>
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
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.submitButtonText}>Save Transaction</Text>
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
