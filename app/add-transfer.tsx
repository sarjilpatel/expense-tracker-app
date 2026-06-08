import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { DateTimeField } from '@/components/transaction/DateTimeField';
import { addTransaction } from '@/src/services/dataService';
import { getAccounts, setTxAccount, Account } from '@/src/services/accountService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';

export default function AddTransferScreen() {
  const { theme } = useTheme();

  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId]     = useState<string | null>(null);
  const [amount, setAmount]               = useState('');
  const [note, setNote]                   = useState('');
  const [date, setDate]                   = useState(new Date());
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    getAccounts().then(accs => {
      setAccounts(accs);
      if (accs.length > 0) setFromAccountId(accs[0].id);
      if (accs.length > 1) setToAccountId(accs[1].id);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
    }
    if (!fromAccountId || !toAccountId) {
      return Alert.alert('Select Accounts', 'Please select both source and destination accounts.');
    }
    if (fromAccountId === toAccountId) {
      return Alert.alert('Same Account', 'Source and destination accounts must be different.');
    }

    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc   = accounts.find(a => a.id === toAccountId);

    setLoading(true);
    try {
      const dateIso = date.toISOString();
      const noteStr = note.trim();

      // Debit from source
      const outTx = await addTransaction({
        amount: num,
        type: 'expense',
        category: 'Transfer',
        note: noteStr ? `Transfer to ${toAcc?.name} · ${noteStr}` : `Transfer to ${toAcc?.name}`,
        date: dateIso,
      });

      // Credit to destination
      const inTx = await addTransaction({
        amount: num,
        type: 'income',
        category: 'Transfer',
        note: noteStr ? `Transfer from ${fromAcc?.name} · ${noteStr}` : `Transfer from ${fromAcc?.name}`,
        date: dateIso,
      });

      // Link to accounts
      if (outTx?._id) await setTxAccount(outTx._id, fromAccountId);
      if (inTx?._id)  await setTxAccount(inTx._id, toAccountId);

      await invalidateAllTransactionCache();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err?.message || 'Failed to record transfer');
    } finally {
      setLoading(false);
    }
  };

  const AccountSelector = ({
    label, selectedId, onSelect, excludeId,
  }: { label: string; selectedId: string | null; onSelect: (id: string) => void; excludeId?: string | null }) => {
    const options = accounts.filter(a => a.id !== excludeId);
    return (
      <View style={styles.inputGroup}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <View style={styles.accountOptions}>
          {options.map(acc => {
            const selected = acc.id === selectedId;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[
                  styles.accountChip,
                  {
                    backgroundColor: selected ? theme.tint : theme.card,
                    borderColor: selected ? theme.tint : theme.border,
                  },
                ]}
                onPress={() => onSelect(acc.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.accountChipText, { color: selected ? '#FFF' : theme.text }]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {options.length === 0 && (
            <Text style={[styles.noAccountsText, { color: theme.secondaryText }]}>
              No accounts available — add one first
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>

        {/* Header */}
        <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.headerTitle}>Transfer</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Amount</ThemedText>
            <View style={[styles.amountRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.currencySymbol, { color: theme.secondaryText }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.secondaryText}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          </View>

          {/* From → To visual */}
          <View style={[styles.arrowBanner, { backgroundColor: theme.card }]}>
            <Text style={[styles.arrowAccountName, { color: theme.text }]} numberOfLines={1}>
              {accounts.find(a => a.id === fromAccountId)?.name || 'Select account'}
            </Text>
            <View style={[styles.arrowCircle, { backgroundColor: theme.tint }]}>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </View>
            <Text style={[styles.arrowAccountName, { color: theme.text }]} numberOfLines={1}>
              {accounts.find(a => a.id === toAccountId)?.name || 'Select account'}
            </Text>
          </View>

          {/* From account */}
          <AccountSelector
            label="From Account"
            selectedId={fromAccountId}
            onSelect={setFromAccountId}
            excludeId={toAccountId}
          />

          {/* To account */}
          <AccountSelector
            label="To Account"
            selectedId={toAccountId}
            onSelect={setToAccountId}
            excludeId={fromAccountId}
          />

          {/* Date */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Date & Time</ThemedText>
            <DateTimeField
              value={date}
              onChange={setDate}
              tintColor={theme.tint}
              borderColor={theme.border}
            />
          </View>

          {/* Note */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Note (optional)</ThemedText>
            <TextInput
              style={[styles.noteInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              placeholder="What is this transfer for?"
              placeholderTextColor={theme.secondaryText}
              multiline
              numberOfLines={2}
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.tint }, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.submitRow}>
                <Ionicons name="swap-horizontal" size={22} color="#FFF" />
                <Text style={styles.submitText}>Transfer Funds</Text>
              </View>
            )}
          </TouchableOpacity>

        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingTop: 56 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  content: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 60 },

  inputGroup: { marginBottom: 24 },
  label:      { fontSize: 14, fontWeight: '600', marginBottom: 10 },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, height: 60,
  },
  currencySymbol: { fontSize: 22, fontWeight: '700', marginRight: 8 },
  amountInput:    { flex: 1, fontSize: 28, fontWeight: '800' },

  arrowBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 24, gap: 10,
  },
  arrowAccountName: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  arrowCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },

  accountOptions:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  accountChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  accountChipText: { fontSize: 13, fontWeight: '700' },
  noAccountsText:  { fontSize: 13, marginTop: 4 },

  noteInput: {
    borderRadius: 16, padding: 14, fontSize: 15, height: 80,
    textAlignVertical: 'top', borderWidth: 1,
  },

  submitBtn: {
    height: 60, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#5856D6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  submitRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
