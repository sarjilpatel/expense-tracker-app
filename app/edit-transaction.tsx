import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal, StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
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

  const navigation = useNavigation();
  useEffect(() => {
    const unsub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (hasAnimatedOut.current) return;
      e.preventDefault();
      hasAnimatedOut.current = true;
      const action = e.data.action;
      const dispatch = () => (navigation as any).dispatch(action);
      animValue.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(dispatch)();
      });
    });
    return unsub;
  }, [navigation]);

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
        <ActivityIndicator color={theme.tint} size="large" />
      </View>
    );
  }

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Edit Transaction
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Type Selector (Pill segmented control) */}
      <View style={[styles.segmentedWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(['expense', 'income'] as const).map(tab => {
          const active = type === tab;
          const bg = tab === 'expense' ? theme.expense : theme.income;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.segmentedBtn,
                active && { backgroundColor: bg },
              ]}
              onPress={() => handleTypeChange(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentedText,
                  { color: active ? '#FFF' : theme.secondaryText }
                ]}
              >
                {tab === 'expense' ? 'Expense' : 'Income'}
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
            <Text style={[styles.heroCurrency, { color: accent }]}>₹</Text>
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

          {/* Category Dropdown Row */}
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

          {/* Account Picker Row */}
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

          {/* Inline Note Row */}
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

          {/* Private Toggle Row */}
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

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottom, { borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accent }, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveTxt}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
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
      </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    height: 48,
  },
  segmentedBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '700',
  },

  scroll:  { flex: 1, paddingHorizontal: 12 },

  heroCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCurrency: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 6,
  },
  heroAmountText: {
    fontSize: 38,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroEditIcon: {
    marginLeft: 8,
  },

  formCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  formRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flex: 1,
  },
  dateTimeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  formValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
    textAlign: 'right',
  },

  bottom:    { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn:   { flex: 2, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveTxt:   { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  cancelTxt: { fontSize: 15, fontWeight: '700' },

  iosOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosSheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  iosSheetTitle:  { fontSize: 15, fontWeight: '600' },
  iosDone:        { fontSize: 15, fontWeight: '600' },
});
