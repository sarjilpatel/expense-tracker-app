import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/src/context/ThemeContext';
import { updateTransaction, getCurrentGroup, getAccounts, setTxAccount, removeTxAccount, getTxAccountMap } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import type { Account } from '@/src/services/accountService';

import { CategoryPicker } from '@/components/transaction/CategoryPicker';
import { AccountPicker } from '@/components/transaction/AccountPicker';
import { AmountField } from '@/components/transaction/AmountField';
import { CalculatorSheet, type CalculatorHandle } from '@/components/transaction/CalculatorSheet';
import { RecurringToggle } from '@/components/transaction/RecurringToggle';
import { space, radius, type as text, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, Touchable, Button, Sheet, Field, Chip, type SheetHandle } from '@/components/ui';

function fmtDate(d: Date) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dd}/${mm}/${yyyy} (${days[d.getDay()]})`;
}
function fmtTime(d: Date) {
  const h   = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${min} ${h >= 12 ? 'pm' : 'am'}`;
}

export default function EditTransactionScreen() {
  const { theme } = useTheme();

  const params          = useLocalSearchParams();
  const txId            = Array.isArray(params.id)         ? params.id[0]         : params.id;
  const initialCategory = Array.isArray(params.category)   ? params.category[0]   : params.category;
  const initialAmount   = Array.isArray(params.amount)     ? params.amount[0]     : params.amount;
  const initialType     = Array.isArray(params.type)       ? params.type[0]       : params.type;
  const initialNote     = Array.isArray(params.note)       ? params.note[0]       : params.note;
  const initialDate      = Array.isArray(params.date)       ? params.date[0]       : params.date;
  const initialIsPrivate = Array.isArray(params.isPrivate)  ? params.isPrivate[0]  : params.isPrivate;
  const initialIsRecurring = Array.isArray(params.isRecurring)         ? params.isRecurring[0]         : params.isRecurring;
  const initialFrequency   = Array.isArray(params.recurrenceFrequency) ? params.recurrenceFrequency[0] : params.recurrenceFrequency;

  const [type, setType]         = useState<'income' | 'expense'>((initialType as any) || 'expense');
  const [amount, setAmount]     = useState(initialAmount || '');
  const [category, setCategory] = useState<string | null>(initialCategory || null);
  const [note, setNote]         = useState(initialNote || '');
  const [date, setDate]         = useState(initialDate ? new Date(initialDate) : new Date());
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate === 'true');
  const [isRecurring, setIsRecurring] = useState(initialIsRecurring === 'true');
  // Server rejects a recurring transaction with no frequency, so keep a valid default even when
  // the row being edited was never recurring.
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<'daily' | 'weekly' | 'monthly'>(
      (initialFrequency as any) === 'daily' || (initialFrequency as any) === 'weekly'
        ? (initialFrequency as any)
        : 'monthly'
    );
  const [loading, setLoading]   = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  // What the transaction was filed under when the screen opened, so save can tell "unchanged"
  // from "cleared" and only issue a write when it actually changed.
  const [initialAccountId, setInitialAccountId]   = useState<string | null>(null);

  const categorySheet = useRef<SheetHandle>(null);
  const calculator    = useRef<CalculatorHandle>(null);
  const [iosPicker, setIosPicker]       = useState<{ mode: 'date' | 'time' } | null>(null);
  const iosPickerSheet = useRef<SheetHandle>(null);

  useEffect(() => {
    (async () => {
      try {
        const [g, accs, map] = await Promise.all([getCurrentGroup(), getAccounts(), getTxAccountMap()]);
        setCategories(g.categories || []);
        setAccounts(accs);
        if (txId && map[txId as string]) {
          setSelectedAccountId(map[txId as string]);
          setInitialAccountId(map[txId as string]);
        }
      } catch {}
    })();
  }, [txId]);

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date, mode: 'date',
        onChange: (_, d) => { if (d) { const upd = new Date(d); upd.setHours(date.getHours(), date.getMinutes()); setDate(upd); } },
      });
    } else { setIosPicker({ mode: 'date' }); }
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date, mode: 'time', is24Hour: false,
        onChange: (_, d) => { if (d) setDate(d); },
      });
    } else { setIosPicker({ mode: 'time' }); }
  };

  const handleTypeChange = (t: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setType(t);
    setCategory(null);
  };

  const displayCategories = [...categories];
  if (category && !categories.find(c => c.name === category)) {
    displayCategories.unshift({ _id: 'temp', name: category, icon: 'alert-circle-outline', type: 'both' as any });
  }

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { Alert.alert('Enter Amount', 'Please enter a valid amount.'); return; }
    if (!category) { Alert.alert('Select Category', 'Please select a category.'); return; }
    setLoading(true);
    try {
      await updateTransaction(txId as string, {
        amount: parsed, type, category, note, date: date.toISOString(), isPrivate,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
      });
      // Clearing the account used to be silently ignored — only assignment was ever written, so
      // the old link survived the edit.
      if (txId && selectedAccountId !== initialAccountId) {
        if (selectedAccountId) await setTxAccount(txId as string, selectedAccountId);
        else                   await removeTxAccount(txId as string);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.msg || err.message || 'Failed to update');
    } finally { setLoading(false); }
  };

  const accent = type === 'expense' ? theme.expense : theme.income;

  const dateChip = (label: string, onPress: () => void, a11y: string) => (
    <Touchable onPress={onPress} haptic="selection" style={[S.dateBtn, { backgroundColor: theme.cardAlt }]} accessibilityLabel={a11y}>
      <Text style={[text.label, { color: theme.text }]}>{label}</Text>
    </Touchable>
  );

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ false: theme.border, true: accent }} thumbColor={theme.card} accessibilityLabel={label} />
  );

  // The form is prefilled from the route params; the categories, accounts and the account link
  // come from memory a tick later. Nothing here is worth a skeleton.
  return (
    <>
      <Screen
        title="Edit transaction"
        right={(
          <Touchable onPress={() => calculator.current?.present(amount)} size={36} style={S.headerBtn} accessibilityLabel="Calculator" rippleBorderless>
            <Ionicons name="calculator-outline" size={iconSize.lg} color={theme.text} />
          </Touchable>
        )}
        keyboard
        footer={(
          <View style={S.footer}>
            <Button label="Save" onPress={handleSave} loading={loading} style={{ flex: 2, backgroundColor: accent }} accessibilityLabel="Save changes" />
            <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={loading} style={{ flex: 1 }} />
          </View>
        )}
      >
        <View style={S.chips}>
          {(['expense', 'income'] as const).map(tab => (
            <Chip
              key={tab}
              label={tab === 'expense' ? 'Expense' : 'Income'}
              selected={type === tab}
              color={type === tab ? (tab === 'expense' ? theme.expense : theme.income) : undefined}
              onPress={() => handleTypeChange(tab)}
            />
          ))}
        </View>

        <AmountField value={amount} onChange={setAmount} accent={accent} />

        <Card padded={false} style={{ marginTop: space.md }}>
          <Row
            icon="calendar-outline"
            title="Date"
            right={(
              <View style={S.dateRow}>
                {dateChip(fmtDate(date), openDatePicker, `Date ${fmtDate(date)}, change`)}
                {dateChip(fmtTime(date), openTimePicker, `Time ${fmtTime(date)}, change`)}
              </View>
            )}
          />
          <Row
            icon="grid-outline"
            title="Category"
            right={<Text style={[text.body, { color: category ? theme.text : theme.secondaryText }]}>{category || 'Select'}</Text>}
            chevron
            onPress={() => categorySheet.current?.present()}
          />
          <Row icon="wallet-outline" title="Account" right={<AccountPicker accounts={accounts} selectedId={selectedAccountId} onChange={setSelectedAccountId} theme={theme} />} />
          <Row icon="repeat" title="Repeat" right={toggle(isRecurring, setIsRecurring, 'Repeat this transaction')} />
          <Row icon="lock-closed-outline" title="Private" subtitle="Hidden from other group members" right={toggle(isPrivate, setIsPrivate, 'Private')} last />
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={[text.overline, { color: theme.secondaryText, marginBottom: space.sm }]}>Note</Text>
          <Field placeholder="What was this for?" lines={3} value={note} onChangeText={setNote} accessibilityLabel="Note" />
        </Card>

        {isRecurring && (
          <View style={{ marginTop: space.md }}>
            <RecurringToggle
              frequency={recurrenceFrequency}
              onFrequencyChange={setRecurrenceFrequency}
              tintColor={accent}
            />
          </View>
        )}
      </Screen>

      {Platform.OS === 'ios' && (
        <Sheet ref={iosPickerSheet} title={iosPicker?.mode === 'time' ? 'Select time' : 'Select date'} keyboard="none" onDismiss={() => setIosPicker(null)}>
          {iosPicker && (
            <DateTimePicker value={date} mode={iosPicker.mode} display="spinner" onChange={(_, d) => { if (d) setDate(d); }} style={{ width: '100%' }} />
          )}
          <Button label="Done" onPress={() => iosPickerSheet.current?.dismiss()} style={{ marginTop: space.md }} />
        </Sheet>
      )}

      <CalculatorSheet ref={calculator} onUse={setAmount} accentColor={accent} theme={theme} />
      <CategoryPicker ref={categorySheet} categories={displayCategories} value={category} type={type} onTypeChange={handleTypeChange} onChange={setCategory} theme={theme} />
    </>
  );
}

const S = StyleSheet.create({
  chips:       { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  headerBtn:   { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  dateRow:     { flexDirection: 'row', gap: space.xs },
  dateBtn:     { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.sm },
  footer:      { flexDirection: 'row', gap: space.sm },
});
