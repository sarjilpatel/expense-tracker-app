import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Image,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { addTransaction, getCurrentGroup, getTransactions } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';
import { getAccounts, Account, setTxAccount } from '@/src/services/accountService';
import { saveReceipt } from '@/src/services/receiptService';
import { CURRENCY_META } from '@/src/services/preferencesService';
import type { CurrencyCode } from '@/src/services/preferencesService';

import { CategoryPicker } from '@/components/transaction/CategoryPicker';
import { AccountPicker } from '@/components/transaction/AccountPicker';
import { AmountKeypad } from '@/components/transaction/AmountKeypad';
import { RecurringToggle } from '@/components/transaction/RecurringToggle';
import { CurrencyPicker } from '@/components/transaction/CurrencyPicker';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dd}/${mm}/${yyyy} (${days[d.getDay()]})`;
}
function fmtTime(d: Date) {
  const h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${min} ${h >= 12 ? 'pm' : 'am'}`;
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function AddTransactionScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [type, setType]             = useState<'income' | 'expense'>('expense');
  const [amount, setAmount]         = useState('');
  const [category, setCategory]     = useState<string | null>(null);
  const [note, setNote]             = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]             = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [currency, setCurrency]     = useState<CurrencyCode>('INR');
  const [isPrivate, setIsPrivate]   = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [loading, setLoading]       = useState(false);
  const [categoriesFetching, setCategoriesFetching] = useState(false);
  const [recentCategories, setRecentCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });

  const [successToast, setSuccessToast]         = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showKeypad, setShowKeypad]               = useState(false);
  const [showCategory, setShowCategory]           = useState(false);
  // iOS-only date/time modal
  const [iosPicker, setIosPicker]                 = useState<{ mode: 'date' | 'time' } | null>(null);

  const { prefillDate, prefillAccountId } = useLocalSearchParams<{ prefillDate?: string; prefillAccountId?: string }>();

  useEffect(() => {
    if (prefillDate) {
      const d = new Date(prefillDate as string);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setDate(d);
    }
    if (prefillAccountId) setSelectedAccountId(prefillAccountId as string);
  }, [prefillDate, prefillAccountId]);

  const loadData = useCallback(async () => {
    setCategoriesFetching(true);
    try {
      const [g, accs, txs] = await Promise.all([
        getCurrentGroup(),
        getAccounts(),
        (getTransactions() as Promise<any[]>).catch(() => []),
      ]);
      setCategories(g.categories || []);
      setAccounts(accs);
      if (Array.isArray(txs)) {
        const seen = new Set<string>();
        const recent: { income: string[]; expense: string[] } = { income: [], expense: [] };
        for (const tx of txs) {
          if (!tx.category || !tx.type) continue;
          const key = tx.type + '|' + tx.category;
          if (seen.has(key)) continue;
          seen.add(key);
          if (tx.type === 'income' && recent.income.length < 6) recent.income.push(tx.category);
          if (tx.type === 'expense' && recent.expense.length < 6) recent.expense.push(tx.category);
        }
        setRecentCategories(recent);
      }
    } catch {}
    finally { setCategoriesFetching(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const navigation = useNavigation();
  const isDirty = !!(amount || category || note || description || receiptUri);
  useEffect(() => {
    if (!isDirty) return;
    const unsub = (navigation as any).addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'You have unsaved data. Leave without saving?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => (navigation as any).dispatch(e.data.action) },
        ],
      );
    });
    return unsub;
  }, [navigation, isDirty]);

  // ── date / time pickers ─────────────────────────────────────────────────────

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date, mode: 'date',
        onChange: (_, d) => { if (d) { const upd = new Date(d); upd.setHours(date.getHours(), date.getMinutes()); setDate(upd); } },
      });
    } else {
      setIosPicker({ mode: 'date' });
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date, mode: 'time', is24Hour: false,
        onChange: (_, d) => { if (d) setDate(d); },
      });
    } else {
      setIosPicker({ mode: 'time' });
    }
  };

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleTypeChange = (t: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setType(t);
    setCategory(null);
  };

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Allow photo library access to attach a receipt.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setReceiptUri(result.assets[0].uri);
  };

  const resetForm = () => {
    setAmount(''); setCategory(null); setNote(''); setDescription('');
    setDate(new Date()); setIsRecurring(false); setSelectedAccountId(null);
    setReceiptUri(null); setIsPrivate(false);
  };

  const doSave = async (andContinue = false) => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { Alert.alert('Enter Amount', 'Please enter a valid amount.'); return; }
    if (!category) { Alert.alert('Select Category', 'Please select a category.'); return; }
    setLoading(true);
    try {
      const fullNote = [note, description].filter(Boolean).join(' — ');
      const newTx = await addTransaction({
        amount: parsed, type, category, note: fullNote,
        date: date.toISOString(), currency,
        isRecurring, recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
        isPrivate,
      });
      if (selectedAccountId && newTx?._id) await setTxAccount(newTx._id, selectedAccountId);
      if (receiptUri && newTx?._id) await saveReceipt(newTx._id, receiptUri).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateAllTransactionCache();
      resetForm();
      setSuccessToast(true);
      if (andContinue) {
        setTimeout(() => setSuccessToast(false), 1500);
      } else {
        setTimeout(() => { setSuccessToast(false); router.replace('/(tabs)'); }, 1200);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.msg || err.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const accent = type === 'expense' ? theme.expense : theme.income;

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
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="star-outline" size={22} color={theme.secondaryText} />
        </TouchableOpacity>
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
        <TouchableOpacity style={styles.tab} onPress={() => router.push('/add-transfer')} activeOpacity={0.7}>
          <Text style={[styles.tabText, { color: theme.secondaryText }]}>Transfer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Form rows */}
        <View style={[styles.section, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>

          {/* Date + Time row */}
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
            <TouchableOpacity
              style={[styles.repBtn, { borderColor: isRecurring ? accent : theme.border }]}
              onPress={() => setIsRecurring(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="repeat-outline" size={12} color={isRecurring ? accent : theme.secondaryText} />
              <Text style={[styles.repText, { color: isRecurring ? accent : theme.secondaryText }]}>Rep/Inst.</Text>
            </TouchableOpacity>
          </View>

          {/* Amount row */}
          <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => setShowKeypad(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Amount</Text>
            <View style={[styles.amountLine, showKeypad && { borderBottomColor: accent, borderBottomWidth: 1.5 }]}>
              <Text style={[styles.value, { color: amount ? theme.text : theme.secondaryText }]}>{amount || ''}</Text>
            </View>
          </TouchableOpacity>

          {/* Currency row */}
          <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => setShowCurrencyPicker(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Currency</Text>
            <Text style={[styles.value, { color: theme.text }]}>{CURRENCY_META[currency].symbol} {currency}</Text>
          </TouchableOpacity>

          {/* Category row */}
          <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => setShowCategory(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Category</Text>
            <Text style={[styles.value, { color: category ? theme.text : theme.secondaryText }]}>{category || ''}</Text>
          </TouchableOpacity>

          {/* Account row */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Account</Text>
            <AccountPicker accounts={accounts} selectedId={selectedAccountId} onChange={setSelectedAccountId} theme={theme} />
          </View>

          {/* Note row */}
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

          {/* Private row */}
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

        {/* Recurring settings */}
        {isRecurring && (
          <View style={{ marginTop: 1 }}>
            <RecurringToggle
              enabled={isRecurring}
              frequency={recurrenceFrequency}
              onToggle={() => setIsRecurring(v => !v)}
              onFrequencyChange={setRecurrenceFrequency}
              tintColor={accent}
              textColor={theme.text}
              borderColor={theme.border}
            />
          </View>
        )}

        {/* Description + camera */}
        <View style={[styles.descRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          {receiptUri && (
            <View style={styles.receiptThumb}>
              <Image source={{ uri: receiptUri }} style={styles.thumbImg} />
              <TouchableOpacity style={styles.thumbRemove} onPress={() => setReceiptUri(null)} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={theme.expense} />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={[styles.descInput, { color: theme.text }]}
            placeholder="Description"
            placeholderTextColor={theme.secondaryText}
            multiline
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity onPress={pickReceipt} hitSlop={8}>
            <Ionicons name="camera-outline" size={20} color={receiptUri ? accent : theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottom, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accent }, loading && { opacity: 0.6 }]}
          onPress={() => doSave(false)}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveTxt}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.contBtn, { borderColor: theme.border }]}
          onPress={() => doSave(true)}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.contTxt, { color: theme.text }]}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Success toast */}
      {successToast && (
        <View style={[styles.toast, { backgroundColor: theme.tint }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
          <Text style={styles.toastText}>Transaction added!</Text>
        </View>
      )}

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

      <AmountKeypad
        visible={showKeypad}
        value={amount}
        onChange={setAmount}
        onClose={() => setShowKeypad(false)}
        onDone={() => setShowKeypad(false)}
        accentColor={accent}
        theme={theme}
      />

      <CategoryPicker
        visible={showCategory}
        onClose={() => setShowCategory(false)}
        categories={categories}
        value={category}
        type={type}
        onTypeChange={handleTypeChange}
        onChange={setCategory}
        theme={theme}
        loading={categoriesFetching}
        onRetry={loadData}
        recentCategories={recentCategories[type]}
      />

      <CurrencyPicker
        value={currency}
        onChange={setCurrency}
        visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </View>
  );
}

const LW = 80; // label width

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  tabs:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab:     { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },

  scroll:  { flex: 1 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 14 },

  row:        { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  label:      { width: LW, fontSize: 14 },
  value:      { fontSize: 14 },
  dateRow:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timeBtn:    { marginLeft: 10 },
  amountLine: { flex: 1, paddingVertical: 2 },
  inlineInput:{ flex: 1, fontSize: 14, paddingVertical: 6 },

  repBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  repText: { fontSize: 10, fontWeight: '600' },

  descRow:  {
    flexDirection: 'row', alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 1, paddingHorizontal: 16, paddingVertical: 10, minHeight: 52,
  },
  descInput: { flex: 1, fontSize: 14, paddingTop: 0, minHeight: 36 },

  bottom:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn:  { flex: 3, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  saveTxt:  { color: '#FFF', fontSize: 15, fontWeight: '700' },
  contBtn:  { flex: 1.2, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  contTxt:  { fontSize: 14, fontWeight: '600' },

  iosOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosSheet:       { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 20 },
  iosSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  iosSheetTitle:  { fontSize: 15, fontWeight: '600' },
  iosDone:        { fontSize: 15, fontWeight: '600' },

  receiptThumb: { marginRight: 8, position: 'relative' },
  thumbImg:     { width: 40, height: 40, borderRadius: 6 },
  thumbRemove:  { position: 'absolute', top: -6, right: -6 },

  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
