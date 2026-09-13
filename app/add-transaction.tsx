import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, Alert, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { addTransaction, getCurrentGroup, getTransactions, getAccounts, setTxAccount } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import type { Account } from '@/src/services/accountService';
import { saveReceipt } from '@/src/services/receiptService';
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
  const h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${min} ${h >= 12 ? 'pm' : 'am'}`;
}

export default function AddTransactionScreen() {
  const { theme } = useTheme();
  const { prefs } = usePreferences();

  const [type, setType]             = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount]         = useState('');
  const [category, setCategory]     = useState<string | null>(null);
  const [note, setNote]             = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]             = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [fromAccountId, setFromAccountId]         = useState<string | null>(null);
  const [toAccountId, setToAccountId]             = useState<string | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate]   = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [loading, setLoading]       = useState(false);
  const [categoriesFetching, setCategoriesFetching] = useState(false);
  const [recentCategories, setRecentCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });

  const [successToast, setSuccessToast] = useState(false);
  const categorySheet = useRef<SheetHandle>(null);
  const calculator    = useRef<CalculatorHandle>(null);
  const amountInput   = useRef<TextInput>(null);
  const [iosPicker, setIosPicker]                 = useState<{ mode: 'date' | 'time' } | null>(null);
  const iosPickerSheet = useRef<SheetHandle>(null);

  const animValue = useSharedValue(0);
  const hasAnimatedOut = useRef(false);

  const animStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: animValue.value,
    transform: [{ translateY: (1 - animValue.value) * 50 }],
  }));

  useEffect(() => {
    animValue.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, []);


  const { prefillDate, prefillAccountId, prefillAmount, prefillType, prefillCategory, prefillNote } =
    useLocalSearchParams<{ prefillDate?: string; prefillAccountId?: string; prefillAmount?: string; prefillType?: string; prefillCategory?: string; prefillNote?: string }>();



  useEffect(() => {
    if (prefillDate) {
      const d = new Date(prefillDate as string);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setDate(d);
    }
    if (prefillAccountId) {
      setSelectedAccountId(prefillAccountId as string);
      setFromAccountId(prefillAccountId as string);
    }
    if (prefillAmount) setAmount(prefillAmount as string);
    if (prefillType && (prefillType === 'income' || prefillType === 'expense' || prefillType === 'transfer')) {
      setType(prefillType as 'income' | 'expense' | 'transfer');
    }
    if (prefillCategory) setCategory(prefillCategory as string);
    if (prefillNote) setNote(prefillNote as string);
  }, [prefillDate, prefillAccountId, prefillAmount, prefillType, prefillCategory, prefillNote]);

  const loadData = useCallback(async () => {
    setCategoriesFetching(true);
    try {
      const [g, accs, txs] = await Promise.all([
        getCurrentGroup(),
        getAccounts(),
        // Newest 50 is deliberate here — this only feeds the 6 most-recent category chips,
        // so paging the whole history would be wasted work.
        (getTransactions() as Promise<any[]>).catch(() => []),
      ]);
      setCategories(g.categories || []);
      setAccounts(accs);
      if (accs.length > 0) {
        if (!selectedAccountId) setSelectedAccountId(accs[0].id);
        if (!fromAccountId) setFromAccountId(accs[0].id);
        if (!toAccountId && accs.length > 1) setToAccountId(accs[1].id);
      }
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
  }, [selectedAccountId, fromAccountId, toAccountId]);

  useFocusRefresh(useCallback(() => { loadData(); }, [loadData]));

  const navigation = useNavigation();
  const isDirty = !!(amount || category || note || description || receiptUri);
  useEffect(() => {
    const unsub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (hasAnimatedOut.current) return;
      e.preventDefault();
      const performExit = () => {
        hasAnimatedOut.current = true;
        const action = e.data.action;
        const dispatch = () => (navigation as any).dispatch(action);
        animValue.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.cubic) }, (finished) => {
          'worklet';
          if (finished) runOnJS(dispatch)();
        });
      };
      if (isDirty) {
        Alert.alert(
          'Discard changes?',
          'You have unsaved data. Leave without saving?',
          [
            { text: 'Keep editing', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: performExit },
          ],
        );
      } else {
        performExit();
      }
    });
    return unsub;
  }, [navigation, isDirty]);

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date, mode: 'date',
        onChange: (_, d) => { if (d) { const upd = new Date(d); upd.setHours(date.getHours(), date.getMinutes()); setDate(upd); } },
      });
    } else {
      setIosPicker({ mode: 'date' });
      iosPickerSheet.current?.present();
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
      iosPickerSheet.current?.present();
    }
  };

  const handleTypeChange = (t: 'income' | 'expense' | 'transfer') => {
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

    if (type === 'transfer') {
      if (!fromAccountId || !toAccountId) { Alert.alert('Select Accounts', 'Please select both source and destination accounts.'); return; }
      if (fromAccountId === toAccountId) { Alert.alert('Same Account', 'Source and destination accounts must be different.'); return; }
      setLoading(true);
      try {
        const fromAcc = accounts.find(a => a.id === fromAccountId);
        const toAcc   = accounts.find(a => a.id === toAccountId);
        const fullNote = [note, description].filter(Boolean).join(' — ');
        const dateIso = date.toISOString();

        const outTx = await addTransaction({
          amount: parsed, type: 'expense', category: 'Transfer',
          note: fullNote ? `Transfer to ${toAcc?.name} · ${fullNote}` : `Transfer to ${toAcc?.name}`,
          date: dateIso, currency: prefs.currency, isPrivate,
        });
        const inTx = await addTransaction({
          amount: parsed, type: 'income', category: 'Transfer',
          note: fullNote ? `Transfer from ${fromAcc?.name} · ${fullNote}` : `Transfer from ${fromAcc?.name}`,
          date: dateIso, currency: prefs.currency, isPrivate,
        });

        if (outTx?._id) await setTxAccount(outTx._id, fromAccountId);
        if (inTx?._id)  await setTxAccount(inTx._id, toAccountId);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetForm();
        setSuccessToast(true);
        if (andContinue) {
          // Straight back to the number pad for the next one.
          setTimeout(() => amountInput.current?.focus(), 50);
          setTimeout(() => setSuccessToast(false), 1500);
        } else {
          setTimeout(() => { setSuccessToast(false); router.back(); }, 1200);
        }
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', err.msg || err.message || 'Failed to save transfer');
      } finally { setLoading(false); }
      return;
    }

    if (!category) { Alert.alert('Select Category', 'Please select a category.'); return; }
    setLoading(true);
    try {
      const fullNote = [note, description].filter(Boolean).join(' — ');
      const newTx = await addTransaction({
        amount: parsed, type, category, note: fullNote,
        date: date.toISOString(), currency: prefs.currency,
        isRecurring, recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
        isPrivate,
      });
      if (selectedAccountId && newTx?._id) await setTxAccount(newTx._id, selectedAccountId);
      if (receiptUri && newTx?._id) await saveReceipt(newTx._id, receiptUri).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setSuccessToast(true);
      if (andContinue) {
        setTimeout(() => amountInput.current?.focus(), 50);
        setTimeout(() => setSuccessToast(false), 1500);
      } else {
        setTimeout(() => { setSuccessToast(false); router.back(); }, 1200);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.msg || err.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const accent     = type === 'expense' ? theme.expense : type === 'income' ? theme.income : theme.tint;
  const accentText = type === 'expense' ? theme.expenseText : type === 'income' ? theme.incomeText : theme.tintText;

  const dateChip = (label: string, onPress: () => void, a11y: string) => (
    <Touchable onPress={onPress} haptic="selection" style={[S.dateBtn, { backgroundColor: theme.cardAlt }]} accessibilityLabel={a11y}>
      <Text style={[text.label, { color: theme.text }]}>{label}</Text>
    </Touchable>
  );

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ false: theme.border, true: accent }} thumbColor={theme.card} accessibilityLabel={label} />
  );

  const calcButton = (
    <Touchable onPress={() => calculator.current?.present(amount)} size={36} style={S.headerBtn} accessibilityLabel="Calculator" rippleBorderless>
      <Ionicons name="calculator-outline" size={iconSize.lg} color={theme.text} />
    </Touchable>
  );

  return (
    <Animated.View style={animStyle}>
      <Screen
        title="New transaction"
        right={calcButton}
        keyboard
        footer={(
          <View style={S.footer}>
            <Button label="Save" onPress={() => doSave(false)} loading={loading} style={{ flex: 2, backgroundColor: accent }} accessibilityLabel="Save transaction" />
            <Button label="Continue" variant="secondary" onPress={() => doSave(true)} disabled={loading} style={{ flex: 1 }} accessibilityLabel="Save and add another" />
          </View>
        )}
      >
        {/* Type — the one place the semantic colours paint chrome, because here the chip *is* the type. */}
        <View style={S.chips}>
          {(['expense', 'income', 'transfer'] as const).map(tab => (
            <Chip
              key={tab}
              label={tab === 'expense' ? 'Expense' : tab === 'income' ? 'Income' : 'Transfer'}
              selected={type === tab}
              color={type === tab ? (tab === 'expense' ? theme.expense : tab === 'income' ? theme.income : theme.tint) : undefined}
              onPress={() => handleTypeChange(tab)}
            />
          ))}
        </View>

        {/* Amount — the OS number pad; the calculator is in the header. */}
        <AmountField ref={amountInput} value={amount} onChange={setAmount} accent={accent} autoFocus />

        {/* Details */}
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
          {type !== 'transfer' ? (
            <Row
              icon="grid-outline"
              title="Category"
              right={<Text style={[text.body, { color: category ? theme.text : theme.secondaryText }]}>{category || 'Select'}</Text>}
              chevron
              onPress={() => categorySheet.current?.present()}
            />
          ) : (
            <Row icon="swap-horizontal-outline" title="Category" right={<Text style={[text.body, { color: theme.secondaryText }]}>Transfer (auto)</Text>} />
          )}
          {type !== 'transfer' ? (
            <Row icon="wallet-outline" title="Account" right={<AccountPicker accounts={accounts} selectedId={selectedAccountId} onChange={setSelectedAccountId} theme={theme} />} />
          ) : (
            <>
              <Row icon="arrow-up-circle-outline"   iconColor={theme.expense} title="From" right={<AccountPicker accounts={accounts} selectedId={fromAccountId} onChange={setFromAccountId} theme={theme} />} />
              <Row icon="arrow-down-circle-outline" iconColor={theme.income}  title="To"   right={<AccountPicker accounts={accounts} selectedId={toAccountId}   onChange={setToAccountId}   theme={theme} />} />
            </>
          )}
          {type !== 'transfer' && (
            <Row icon="repeat" title="Repeat" right={toggle(isRecurring, setIsRecurring, 'Repeat this transaction')} />
          )}
          <Row icon="lock-closed-outline" title="Private" subtitle="Hidden from other group members" right={toggle(isPrivate, setIsPrivate, 'Private')} last />
        </Card>

        {type !== 'transfer' && isRecurring && (
          <View style={{ marginTop: space.md }}>
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

        {/* Note, description + receipt */}
        <Card style={{ marginTop: space.md }}>
          <Text style={[text.overline, { color: theme.secondaryText, marginBottom: space.sm }]}>Note</Text>
          <Field placeholder="What was this for?" lines={2} value={note} onChangeText={setNote} accessibilityLabel="Note" />
          <Text style={[text.overline, { color: theme.secondaryText, marginTop: space.md, marginBottom: space.sm }]}>Description & attachment</Text>
          <View style={S.descRow}>
            {receiptUri && (
              <View style={S.thumbWrap}>
                <Image source={{ uri: receiptUri }} style={S.thumb} accessibilityLabel="Receipt" />
                <Touchable onPress={() => setReceiptUri(null)} size={24} style={S.thumbRemove} accessibilityLabel="Remove receipt" rippleBorderless>
                  <Ionicons name="close-circle" size={iconSize.sm} color={theme.danger} />
                </Touchable>
              </View>
            )}
            <Field placeholder="Add more details…" lines={3} value={description} onChangeText={setDescription} style={{ flex: 1 }} accessibilityLabel="Description" />
            <Touchable onPress={pickReceipt} size={44} style={[S.cameraBtn, { backgroundColor: theme.cardAlt }]} accessibilityLabel={receiptUri ? 'Change receipt' : 'Attach receipt'}>
              <Ionicons name="camera-outline" size={iconSize.md} color={receiptUri ? accent : theme.secondaryText} />
            </Touchable>
          </View>
        </Card>

        {successToast && (
          <View style={[S.toast, { backgroundColor: theme.tint }]} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={iconSize.md} color={theme.tintText} />
            <Text style={[text.label, { color: theme.tintText }]}>Transaction added</Text>
          </View>
        )}
      </Screen>

      {/* iOS date/time */}
      {Platform.OS === 'ios' && (
        <Sheet ref={iosPickerSheet} title={iosPicker?.mode === 'time' ? 'Select time' : 'Select date'} keyboard="none" onDismiss={() => setIosPicker(null)}>
          {iosPicker && (
            <DateTimePicker value={date} mode={iosPicker.mode} display="spinner" onChange={(_, d) => { if (d) setDate(d); }} style={{ width: '100%' }} />
          )}
          <Button label="Done" onPress={() => iosPickerSheet.current?.dismiss()} style={{ marginTop: space.md }} />
        </Sheet>
      )}

      <CalculatorSheet ref={calculator} onUse={setAmount} accentColor={accent} theme={theme} />

      <CategoryPicker
        ref={categorySheet}
        categories={categories}
        value={category}
        type={type === 'transfer' ? 'expense' : type}
        onTypeChange={handleTypeChange}
        onChange={setCategory}
        theme={theme}
        loading={categoriesFetching}
        onRetry={loadData}
        recentCategories={recentCategories[type === 'transfer' ? 'expense' : type]}
      />
    </Animated.View>
  );
}

const S = StyleSheet.create({
  chips:       { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  headerBtn:   { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  dateRow:     { flexDirection: 'row', gap: space.xs },
  dateBtn:     { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.sm },
  descRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  thumbWrap:   { width: 56, height: 56 },
  thumb:       { width: 56, height: 56, borderRadius: radius.sm },
  thumbRemove: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  cameraBtn:   { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  footer:      { flexDirection: 'row', gap: space.sm },
  toast:       { position: 'absolute', bottom: space.lg, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.full },
});
