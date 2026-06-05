import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { setBudget, deleteBudget } from '@/src/services/budgetApi';
import { useLanguage } from '@/src/i18n/LanguageContext';

interface Props {
  currentBudget: any;
  theme: any;
  onUpdated: () => void;
}

export function BudgetSection({ currentBudget, theme, onUpdated }: Props) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(currentBudget?.amount?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!amount || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      await setBudget({ amount: parseFloat(amount), month: now.getMonth() + 1, year: now.getFullYear() });
      Alert.alert('Success', 'Budget updated successfully');
      onUpdated();
    } catch {
      Alert.alert('Error', 'Failed to update budget');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (!currentBudget?._id) return;
    Alert.alert('Remove Budget', 'Are you sure you want to remove the monthly budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteBudget(currentBudget._id);
            setAmount('');
            onUpdated();
          } catch {
            Alert.alert('Error', 'Failed to remove budget');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText style={styles.label}>{t('monthly_budget')}</ThemedText>
        {currentBudget && (
          <TouchableOpacity onPress={handleRemove}>
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}>
        <View style={styles.row}>
          <View style={[styles.inputWrap, { backgroundColor: 'rgba(150,150,150,0.1)' }]}>
            <Text style={{ color: theme.text, fontSize: 18, marginRight: 8, fontWeight: '600' }}>₹</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Enter amount"
              placeholderTextColor="#A0A0A0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.tint }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section:   { marginBottom: 24 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:     { fontSize: 12, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 },
  card:      { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row:       { flexDirection: 'row', gap: 12 },
  inputWrap: { flex: 1, height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input:     { flex: 1, fontSize: 16, fontWeight: '700' },
  saveBtn:   { paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '800' },
});
