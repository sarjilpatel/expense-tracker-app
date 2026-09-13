import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { DateTimeField } from '@/components/transaction/DateTimeField';
import { addTransaction, getAccounts, setTxAccount } from '@/src/services/dataService';
import type { Account } from '@/src/services/accountService';
import { Currency } from '@/constants/theme';
import { space, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Field, Card, Chip } from '@/components/ui';

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err?.message || 'Failed to record transfer');
    } finally {
      setLoading(false);
    }
  };

  const fromName = accounts.find(a => a.id === fromAccountId)?.name || 'Select account';
  const toName   = accounts.find(a => a.id === toAccountId)?.name   || 'Select account';

  const selector = (label: string, selectedId: string | null, onSelect: (id: string) => void, excludeId: string | null) => {
    const options = accounts.filter(a => a.id !== excludeId);
    return (
      <View style={S.group}>
        <Text style={[type.label, S.label, { color: theme.secondaryText }]}>{label}</Text>
        <View style={S.chips}>
          {options.map(acc => (
            <Chip key={acc.id} label={acc.name} selected={acc.id === selectedId} onPress={() => onSelect(acc.id)} />
          ))}
          {options.length === 0 && (
            <Text style={[type.label, { color: theme.secondaryText }]}>No accounts available — add one first</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Screen title="Transfer" keyboard>
      <Field
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
        right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{Currency.symbol}</Text>}
        style={{ marginTop: space.md }}
      />

      <Card tone="alt" style={S.banner}>
        <Text style={[type.bodyStrong, S.bannerName, { color: theme.text }]} numberOfLines={1}>{fromName}</Text>
        <Ionicons name="arrow-forward" size={iconSize.md} color={theme.tint} />
        <Text style={[type.bodyStrong, S.bannerName, { color: theme.text, textAlign: 'right' }]} numberOfLines={1}>{toName}</Text>
      </Card>

      {selector('From account', fromAccountId, setFromAccountId, toAccountId)}
      {selector('To account',   toAccountId,   setToAccountId,   fromAccountId)}

      <View style={S.group}>
        <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Date & time</Text>
        <DateTimeField value={date} onChange={setDate} tintColor={theme.tint} borderColor={theme.border} />
      </View>

      <Field
        label="Note (optional)"
        placeholder="What is this transfer for?"
        value={note}
        onChangeText={setNote}
        multiline
        style={S.group}
      />

      <Button label="Record transfer" icon="swap-horizontal" onPress={handleSubmit} loading={loading} style={{ marginTop: space.xl }} />
    </Screen>
  );
}

const S = StyleSheet.create({
  group:      { marginTop: space.lg },
  label:      { marginLeft: space.xs, marginBottom: space.sm },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  banner:     { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, paddingVertical: space.md },
  bannerName: { flex: 1 },
});
