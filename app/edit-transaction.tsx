import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { updateTransaction, getCurrentGroup } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';
import { getAccounts, Account, setTxAccount, getTxAccountMap } from '@/src/services/accountService';

import { CategoryPicker } from '@/components/transaction/CategoryPicker';
import { AccountPicker } from '@/components/transaction/AccountPicker';
import { AmountKeypad } from '@/components/transaction/AmountKeypad';

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
  const insets = useSafeAreaInsets();

  const params          = useLocalSearchParams();
  const txId            = Array.isArray(params.id)         ? params.id[0]         : params.id;
  const initialCategory = Array.isArray(params.category)   ? params.category[0]   : params.category;
  const initialAmount   = Array.isArray(params.amount)     ? params.amount[0]     : params.amount;
  const initialType     = Array.isArray(params.type)       ? params.type[0]       : params.type;
  const initialNote     = Array.isArray(params.note)       ? params.note[0]       : params.note;
  const initialDate      = Array.isArray(params.date)       ? params.date[0]       : params.date;
  const initialIsPrivate = Array.isArray(params.isPrivate)  ? params.isPrivate[0]  : params.isPrivate;

  const [type, setType]         = useState<'income' | 'expense'>((initialType as any) || 'expense');
  const [amount, setAmount]     = useState(initialAmount || '');
  const [category, setCategory] = useState<string | null>(initialCategory || null);
  const [note, setNote]         = useState(initialNote || '');
  const [date, setDate]         = useState(initialDate ? new Date(initialDate) : new Date());
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate === 'true');
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [showKeypad, setShowKeypad]     = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [iosPicker, setIosPicker]       = useState<{ mode: 'date' | 'time' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [g, accs, map] = await Promise.all([getCurrentGroup(), getAccounts(), getTxAccountMap()]);
        setCategories(g.categories || []);
        setAccounts(accs);
        if (txId && map[txId as string]) setSelectedAccountId(map[txId as string]);
      } catch {}
      finally { setFetching(false); }
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

  const handleTypeChange = (t: 'income' | 'expense') => { setType(t); setCategory(null); };

  const displayCategories = [...categories];
  if (category && !categories.find(c => c.name === category)) {
    displayCategories.unshift({ name: category, icon: 'alert-circle-outline', type: 'both' as any });
  }

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { Alert.alert('Enter Amount', 'Please enter a valid amount.'); return; }
    if (!category) { Alert.alert('Select Category', 'Please select a category.'); return; }
    setLoading(true);
    try {
      await updateTransaction(txId as string, { amount: parsed, type, category, note, date: date.toISOString(), isPrivate });
      if (txId && selectedAccountId) await setTxAccount(txId as string, selectedAccountId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateAllTransactionCache();
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.msg || err.message || 'Failed to update');
    } finally { setLoading(false); }
  };

  const accent = type === 'expense' ? theme.expense : theme.income;

  if (fetching) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: accent }]}>
          {type === 'expense' ? 'Expense' : 'Income'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Type tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['income', 'expense'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, type === tab && { borderBottomColor: tab === 'expense' ? theme.expense : theme.income, borderBottomWidth: 2 }]}
            onPress={() => handleTypeChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: type === tab ? (tab === 'expense' ? theme.expense : theme.income) : theme.secondaryText }]}>
              {tab === 'expense' ? 'Expense' : 'Income'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.tab}>
          <Text style={[styles.tabText, { color: theme.secondaryText }]}>Transfer</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>

          {/* Date + Time */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Date</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={openDatePicker} activeOpacity={0.6}>
                <Text style={[styles.value, { color: theme.text }]}>{fmtDate(date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openTimePicker} activeOpacity={0.6} style={styles.timeBtn}>
                <Text style={[styles.value, { color: theme.text }]}>{fmtTime(date)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
          <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => setShowKeypad(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Amount</Text>
            <View style={[styles.amountLine, showKeypad && { borderBottomColor: accent, borderBottomWidth: 1.5 }]}>
              <Text style={[styles.value, { color: amount ? theme.text : theme.secondaryText }]}>{amount || ''}</Text>
            </View>
          </TouchableOpacity>

          {/* Category */}
          <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => setShowCategory(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Category</Text>
            <Text style={[styles.value, { color: category ? theme.text : theme.secondaryText }]}>{category || ''}</Text>
          </TouchableOpacity>

          {/* Account */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Account</Text>
            <AccountPicker accounts={accounts} selectedId={selectedAccountId} onChange={setSelectedAccountId} theme={theme} />
          </View>

          {/* Note */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Note</Text>
            <TextInput
              style={[styles.inlineInput, { color: theme.text }]}
              placeholderTextColor={theme.secondaryText}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              blurOnSubmit
            />
          </View>

          {/* Private */}
          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Private</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: theme.border, true: accent + '60' }}
              thumbColor={isPrivate ? accent : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottom, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accent }, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveTxt}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={[styles.cancelTxt, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* iOS date/time modal */}
      {Platform.OS === 'ios' && iosPicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setIosPicker(null)}>
          <View style={styles.iosOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setIosPicker(null)} />
            <View style={[styles.iosSheet, { backgroundColor: theme.card }]}>
              <View style={[styles.iosSheetHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.iosSheetTitle, { color: theme.text }]}>
                  {iosPicker.mode === 'date' ? 'Select Date' : 'Select Time'}
                </Text>
                <TouchableOpacity onPress={() => setIosPicker(null)}>
                  <Text style={[styles.iosDone, { color: accent }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode={iosPicker.mode}
                display="spinner"
                onChange={(_, d) => { if (d) setDate(d); }}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      <AmountKeypad visible={showKeypad} value={amount} onChange={setAmount} onClose={() => setShowKeypad(false)} onDone={() => setShowKeypad(false)} accentColor={accent} theme={theme} />
      <CategoryPicker visible={showCategory} onClose={() => setShowCategory(false)} categories={displayCategories} value={category} type={type} onTypeChange={handleTypeChange} onChange={setCategory} theme={theme} />
    </View>
  );
}

const LW = 80;

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  tabs:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab:     { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },

  scroll:  { flex: 1 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 14 },

  row:         { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  label:       { width: LW, fontSize: 14 },
  value:       { fontSize: 14 },
  dateRow:     { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timeBtn:     { marginLeft: 10 },
  amountLine:  { flex: 1, paddingVertical: 2 },
  inlineInput: { flex: 1, fontSize: 14, paddingVertical: 6 },

  bottom:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn:   { flex: 3, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  saveTxt:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cancelBtn: { flex: 1.2, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  cancelTxt: { fontSize: 14, fontWeight: '600' },

  iosOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosSheet:       { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 20 },
  iosSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  iosSheetTitle:  { fontSize: 15, fontWeight: '600' },
  iosDone:        { fontSize: 15, fontWeight: '600' },
});
