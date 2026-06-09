import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal, StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { Currency } from '@/constants/theme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { addTransaction, getCurrentGroup, getTransactions } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { invalidateAllTransactionCache } from '@/src/cache/transactionCache';
import { getAccounts, Account, setTxAccount } from '@/src/services/accountService';
import { saveReceipt } from '@/src/services/receiptService';
import { CategoryPicker } from '@/components/transaction/CategoryPicker';
import { AccountPicker } from '@/components/transaction/AccountPicker';
import { AmountKeypad } from '@/components/transaction/AmountKeypad';
import { RecurringToggle } from '@/components/transaction/RecurringToggle';

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
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { prefs } = usePreferences();
  const insets = useSafeAreaInsets();

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
  const [showKeypad, setShowKeypad]     = useState(false);
  const [showCategory, setShowCategory]           = useState(false);
  const [iosPicker, setIosPicker]                 = useState<{ mode: 'date' | 'time' } | null>(null);

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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
        await invalidateAllTransactionCache();
        resetForm();
        setSuccessToast(true);
        if (andContinue) {
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
      await invalidateAllTransactionCache();
      resetForm();
      setSuccessToast(true);
      if (andContinue) {
        setTimeout(() => setSuccessToast(false), 1500);
      } else {
        setTimeout(() => { setSuccessToast(false); router.back(); }, 1200);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.msg || err.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const accent = type === 'expense' ? theme.expense : type === 'income' ? theme.income : theme.tint;
  const isDark = theme.background === '#0D1117';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <Animated.View style={animStyle}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            New Transaction
          </Text>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="star-outline" size={22} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Type Selector */}
        <View style={[styles.segmentedWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(['expense', 'income', 'transfer'] as const).map(tab => {
            const active = type === tab;
            const bg = tab === 'expense' ? theme.expense : tab === 'income' ? theme.income : theme.tint;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.segmentedBtn, active && { backgroundColor: bg }]}
                onPress={() => handleTypeChange(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentedText, { color: active ? '#FFF' : theme.secondaryText }]}>
                  {tab === 'expense' ? 'Expense' : tab === 'income' ? 'Income' : 'Transfer'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Amount Display Card */}
          <TouchableOpacity
            style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setShowKeypad(true)}
            activeOpacity={0.85}
          >
            <Text style={[styles.heroLabel, { color: theme.secondaryText }]}>AMOUNT</Text>
            <View style={styles.heroAmountRow}>
              <Text style={[styles.heroCurrency, { color: accent }]}>{Currency.symbol}</Text>
              <Text style={[styles.heroAmountText, { color: amount ? theme.text : theme.secondaryText }]} numberOfLines={1} adjustsFontSizeToFit>
                {amount || '0.00'}
              </Text>
              <Ionicons name="pencil" size={16} color={accent} style={styles.heroEditIcon} />
            </View>
          </TouchableOpacity>

          {/* Core Form Settings Card */}
          <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>

            {/* Date Picker Row */}
            <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
              <View style={styles.formRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.primary + '18' }]}>
                  <Ionicons name="calendar-outline" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.formLabel, { color: theme.text }]}>Date</Text>
              </View>
              <View style={styles.formRowRight}>
                <TouchableOpacity onPress={openDatePicker} activeOpacity={0.6} style={styles.dateTimeBtn}>
                  <Text style={[styles.formValue, { color: theme.text }]}>{fmtDate(date)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openTimePicker} activeOpacity={0.6} style={[styles.dateTimeBtn, { marginLeft: 8 }]}>
                  <Text style={[styles.formValue, { color: theme.text }]}>{fmtTime(date)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Row */}
            {type !== 'transfer' ? (
              <TouchableOpacity
                style={[styles.formRow, { borderBottomColor: theme.border }]}
                onPress={() => setShowCategory(true)}
                activeOpacity={0.7}
              >
                <View style={styles.formRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: theme.warning + '18' }]}>
                    <Ionicons name="grid-outline" size={18} color={theme.warning} />
                  </View>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Category</Text>
                </View>
                <View style={styles.formRowRight}>
                  <Text style={[styles.formValue, { color: category ? theme.text : theme.secondaryText }]}>
                    {category || 'Select Category'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
                <View style={styles.formRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: theme.warning + '18' }]}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={theme.warning} />
                  </View>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Category</Text>
                </View>
                <View style={styles.formRowRight}>
                  <Text style={[styles.formValue, { color: theme.secondaryText }]}>Transfer (Auto)</Text>
                </View>
              </View>
            )}

            {/* Account Row */}
            {type !== 'transfer' ? (
              <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
                <View style={styles.formRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: theme.success + '18' }]}>
                    <Ionicons name="wallet-outline" size={18} color={theme.success} />
                  </View>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Account</Text>
                </View>
                <View style={styles.formRowRight}>
                  <AccountPicker accounts={accounts} selectedId={selectedAccountId} onChange={setSelectedAccountId} theme={theme} />
                  <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
                </View>
              </View>
            ) : (
              <>
                <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.formRowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: theme.danger + '18' }]}>
                      <Ionicons name="arrow-up-circle-outline" size={18} color={theme.danger} />
                    </View>
                    <Text style={[styles.formLabel, { color: theme.text }]}>From Account</Text>
                  </View>
                  <View style={styles.formRowRight}>
                    <AccountPicker accounts={accounts} selectedId={fromAccountId} onChange={setFromAccountId} theme={theme} />
                    <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
                  </View>
                </View>
                <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.formRowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: theme.success + '18' }]}>
                      <Ionicons name="arrow-down-circle-outline" size={18} color={theme.success} />
                    </View>
                    <Text style={[styles.formLabel, { color: theme.text }]}>To Account</Text>
                  </View>
                  <View style={styles.formRowRight}>
                    <AccountPicker accounts={accounts} selectedId={toAccountId} onChange={setToAccountId} theme={theme} />
                    <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
                  </View>
                </View>
              </>
            )}

            {/* Note Row */}
            <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
              <View style={styles.formRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.primary + '18' }]}>
                  <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.formLabel, { color: theme.text }]}>Note</Text>
              </View>
              <View style={styles.formRowRight}>
                <TextInput
                  style={[styles.inlineInput, { color: theme.text }]}
                  placeholder="Brief note..."
                  placeholderTextColor={theme.secondaryText}
                  value={note}
                  onChangeText={setNote}
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            </View>

            {/* Repeat Row */}
            {type !== 'transfer' && (
              <View style={[styles.formRow, { borderBottomColor: theme.border }]}>
                <View style={styles.formRowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: accent + '18' }]}>
                    <Ionicons name="repeat" size={18} color={accent} />
                  </View>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Repeat</Text>
                </View>
                <View style={styles.formRowRight}>
                  <Switch
                    value={isRecurring}
                    onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsRecurring(v); }}
                    trackColor={{ false: theme.border, true: accent + '60' }}
                    thumbColor={isRecurring ? accent : '#f4f3f4'}
                  />
                </View>
              </View>
            )}

            {/* Private Row */}
            <View style={[styles.formRow, { borderBottomColor: 'transparent' }]}>
              <View style={styles.formRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.danger + '18' }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.danger} />
                </View>
                <Text style={[styles.formLabel, { color: theme.text }]}>Private</Text>
              </View>
              <View style={styles.formRowRight}>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: theme.border, true: accent + '60' }}
                  thumbColor={isPrivate ? accent : '#f4f3f4'}
                />
              </View>
            </View>

          </View>

          {/* Recurring Settings */}
          {type !== 'transfer' && isRecurring && (
            <View style={styles.recurringWrap}>
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

          {/* Description + Receipt */}
          <View style={[styles.descCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.descCardTitle, { color: theme.text }]}>Description & Attachment</Text>
            <View style={styles.descRow}>
              {receiptUri && (
                <View style={styles.receiptThumb}>
                  <Image source={{ uri: receiptUri }} style={styles.thumbImg} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => setReceiptUri(null)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              )}
              <TextInput
                style={[styles.descInput, { color: theme.text }]}
                placeholder="Add more details about this transaction..."
                placeholderTextColor={theme.secondaryText}
                multiline
                value={description}
                onChangeText={setDescription}
              />
              <TouchableOpacity onPress={pickReceipt} hitSlop={8} style={[styles.cameraBtn, { backgroundColor: theme.background }]}>
                <Ionicons name="camera-outline" size={20} color={receiptUri ? accent : theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom buttons */}
        <View style={[styles.bottom, { borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accent }, loading && { opacity: 0.6 }]}
            onPress={() => doSave(false)}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveTxt}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
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
        </Animated.View>

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
          type={type === 'transfer' ? 'expense' : type}
          onTypeChange={handleTypeChange}
          onChange={setCategory}
          theme={theme}
          loading={categoriesFetching}
          onRetry={loadData}
          recentCategories={recentCategories[type === 'transfer' ? 'expense' : type]}
        />

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  segmentedWrap: {
    flexDirection: 'row', borderRadius: 14, padding: 4,
    marginHorizontal: 12, marginBottom: 16, borderWidth: 1, height: 48,
  },
  segmentedBtn:  { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentedText: { fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1, paddingHorizontal: 12 },

  heroCard: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16,
    marginBottom: 16, alignItems: 'center', justifyContent: 'center',
  },
  heroLabel:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  heroAmountRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  heroCurrency:   { fontSize: 24, fontWeight: '700', marginRight: 6 },
  heroAmountText: { fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  heroEditIcon:   { marginLeft: 8 },

  formCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  formRow:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:      { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  formLabel:    { fontSize: 14, fontWeight: '600' },
  formRowRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flex: 1 },
  dateTimeBtn:  { paddingVertical: 6, paddingHorizontal: 8 },
  formValue:    { fontSize: 14, fontWeight: '600' },
  inlineInput:  { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 8, textAlign: 'right' },

  recurringWrap: { marginBottom: 16 },

  descCard:      { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 16 },
  descCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  descRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  descInput:     { flex: 1, fontSize: 14, paddingTop: 4, minHeight: 52, textAlignVertical: 'top' },
  cameraBtn:     { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  bottom:    { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn:   { flex: 2, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveTxt:   { color: '#FFF', fontSize: 16, fontWeight: '700' },
  contBtn:   { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  contTxt:   { fontSize: 15, fontWeight: '700' },

  iosOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosSheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  iosSheetTitle:  { fontSize: 15, fontWeight: '600' },
  iosDone:        { fontSize: 15, fontWeight: '600' },

  receiptThumb: { position: 'relative' },
  thumbImg:     { width: 44, height: 44, borderRadius: 8 },
  thumbRemove:  { position: 'absolute', top: -6, right: -6 },

  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
