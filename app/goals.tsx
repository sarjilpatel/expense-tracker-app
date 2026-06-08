import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Modal, Alert, Platform, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Currency } from '@/constants/theme';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import {
  getGoals, createGoal, updateGoal, deleteGoal, Goal,
} from '@/src/services/goalService';

const ICONS = [
  'flag-outline', 'home-outline', 'airplane-outline', 'car-outline',
  'school-outline', 'gift-outline', 'heart-outline', 'trophy-outline',
  'laptop-outline', 'medkit-outline', 'restaurant-outline', 'fitness-outline',
  'cash-outline', 'business-outline', 'rocket-outline',
];

const COLORS = [
  '#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
];

type GoalStatus = 'completed' | 'on-track' | 'behind' | 'overdue' | 'active';

function getStatus(goal: Goal): GoalStatus {
  const pct = goal.savedAmount / goal.targetAmount;
  if (pct >= 1) return 'completed';
  if (!goal.deadline) return 'active';
  const now = Date.now();
  const deadline = new Date(goal.deadline).getTime();
  if (now > deadline) return 'overdue';
  const created = new Date(goal.createdAt).getTime();
  const totalMs = deadline - created;
  if (totalMs <= 0) return 'active';
  const expected = (now - created) / totalMs;
  return pct >= expected - 0.05 ? 'on-track' : 'behind';
}

function statusColor(status: GoalStatus, goal: Goal, theme: any): string {
  if (status === 'completed') return theme.income;
  if (status === 'overdue')   return theme.expense;
  if (status === 'behind')    return '#F59E0B';
  return goal.color;
}

function deadlineLabel(goal: Goal): string {
  if (!goal.deadline) return 'No deadline';
  const ms = new Date(goal.deadline).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days < 30) return `${days}d left`;
  const months = Math.round(days / 30.44);
  return months < 12 ? `${months}mo left` : `${Math.floor(months / 12)}yr ${months % 12}mo`;
}

function RingProgress({
  size, progress, color, bg,
}: { size: number; progress: number; color: string; bg: string }) {
  const sw  = 9;
  const r   = (size - sw) / 2;
  const c   = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={bg}    strokeWidth={sw} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

type FormState = {
  name: string;
  targetAmount: string;
  savedAmount: string;
  deadline: Date | null;
  icon: string;
  color: string;
};

const EMPTY_FORM: FormState = {
  name: '', targetAmount: '', savedAmount: '',
  deadline: null, icon: ICONS[0], color: COLORS[0],
};

export default function GoalsScreen() {
  const { theme } = useTheme();
  const { isGuest } = useAuth();
  const { top, bottom } = useSafeAreaInsets();

  const [goals,       setGoals]       = useState<Goal[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editGoal,    setEditGoal]    = useState<Goal | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [fundsGoal,   setFundsGoal]   = useState<Goal | null>(null);
  const [fundsAmt,    setFundsAmt]    = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      const data = await getGoals();
      setGoals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchGoals();
  }, [fetchGoals]));

  const openAdd = () => {
    setEditGoal(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditGoal(goal);
    setForm({
      name:         goal.name,
      targetAmount: String(goal.targetAmount),
      savedAmount:  String(goal.savedAmount),
      deadline:     goal.deadline ? new Date(goal.deadline) : null,
      icon:         goal.icon,
      color:        goal.color,
    });
    setModalOpen(true);
  };

  const saveGoal = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Please enter a goal name.'); return; }
    const target = parseFloat(form.targetAmount);
    if (!target || target < 1) { Alert.alert('Error', 'Enter a valid target amount.'); return; }
    setSaving(true);
    try {
      const payload = {
        name:         form.name.trim(),
        targetAmount: target,
        savedAmount:  parseFloat(form.savedAmount) || 0,
        deadline:     form.deadline ? form.deadline.toISOString() : null,
        icon:         form.icon,
        color:        form.color,
      };
      if (editGoal) {
        const updated = await updateGoal(editGoal._id, payload);
        setGoals(g => g.map(x => x._id === updated._id ? updated : x));
      } else {
        const created = await createGoal(payload);
        setGoals(g => [created, ...g]);
      }
      setModalOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.msg || 'Could not save goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFunds = async () => {
    if (!fundsGoal) return;
    const amt = parseFloat(fundsAmt);
    if (!amt || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const updated = await updateGoal(fundsGoal._id, { addAmount: amt });
      setGoals(g => g.map(x => x._id === updated._id ? updated : x));
      setFundsGoal(null);
      setFundsAmt('');
    } catch (e: any) {
      Alert.alert('Error', e?.msg || 'Could not add funds.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (goal: Goal) => {
    Alert.alert('Delete Goal', `Delete "${goal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(goal._id);
            setGoals(g => g.filter(x => x._id !== goal._id));
          } catch (e: any) {
            Alert.alert('Error', e?.msg || 'Could not delete goal.');
          }
        },
      },
    ]);
  };

  const openDatePicker = () => {
    const date = form.deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (_, d) => { if (d) setForm(f => ({ ...f, deadline: d })); },
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const pct = (goal: Goal) => Math.min(goal.savedAmount / goal.targetAmount, 1);

  if (isGuest) {
    return (
      <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={S.headerTitle}>Savings Goals</ThemedText>
          <View style={{ width: 32 }} />
        </View>
        <View style={S.empty}>
          <Ionicons name="flag-outline" size={64} color={theme.icon} />
          <ThemedText style={S.emptyTitle}>Sign in to track goals</ThemedText>
          <ThemedText style={S.emptyBody}>Savings goals are synced with your group. Create an account to get started.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={S.headerTitle}>Savings Goals</ThemedText>
        <TouchableOpacity onPress={openAdd} hitSlop={8} style={[S.addBtn, { backgroundColor: theme.tint }]}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonLoader type="card" /><SkeletonLoader type="card" />
        </View>
      ) : goals.length === 0 ? (
        <View style={S.empty}>
          <Ionicons name="trophy-outline" size={64} color={theme.icon} />
          <ThemedText style={S.emptyTitle}>No goals yet</ThemedText>
          <ThemedText style={S.emptyBody}>Set a savings goal to track your progress toward something meaningful.</ThemedText>
          <TouchableOpacity style={[S.emptyBtn, { backgroundColor: theme.tint }]} onPress={openAdd}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={S.emptyBtnText}>Add First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.list, { paddingBottom: bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {goals.map((goal, i) => {
            const status  = getStatus(goal);
            const sColor  = statusColor(status, goal, theme);
            const ringBg  = sColor + '22';
            const progress = pct(goal);
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
            return (
              <Animated.View
                key={goal._id}
                entering={FadeInDown.delay(i * 70).duration(280)}
                style={[S.card, { backgroundColor: theme.card }]}
              >
                {/* Card top row */}
                <View style={S.cardTop}>
                  <View style={[S.iconBox, { backgroundColor: goal.color + '22' }]}>
                    <Ionicons name={goal.icon as any} size={22} color={goal.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[S.goalName, { color: theme.text }]} numberOfLines={1}>{goal.name}</Text>
                    <View style={S.statusRow}>
                      {status === 'completed' && (
                        <View style={[S.badge, { backgroundColor: theme.income + '22' }]}>
                          <Text style={[S.badgeText, { color: theme.income }]}>✓ Completed</Text>
                        </View>
                      )}
                      {status === 'overdue' && (
                        <View style={[S.badge, { backgroundColor: theme.expense + '22' }]}>
                          <Text style={[S.badgeText, { color: theme.expense }]}>Overdue</Text>
                        </View>
                      )}
                      {status === 'behind' && (
                        <View style={[S.badge, { backgroundColor: '#F59E0B22' }]}>
                          <Text style={[S.badgeText, { color: '#F59E0B' }]}>Behind pace</Text>
                        </View>
                      )}
                      {(status === 'on-track' || status === 'active') && goal.deadline && (
                        <View style={[S.badge, { backgroundColor: goal.color + '22' }]}>
                          <Text style={[S.badgeText, { color: goal.color }]}>On track</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(goal)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>

                {/* Progress ring + amounts */}
                <View style={S.progressRow}>
                  <View style={S.ringWrap}>
                    <RingProgress size={80} progress={progress} color={sColor} bg={ringBg} />
                    <View style={S.ringCenter}>
                      <Text style={[S.ringPct, { color: sColor }]}>{Math.round(progress * 100)}%</Text>
                    </View>
                  </View>
                  <View style={S.amountCol}>
                    <Text style={[S.savedAmt, { color: theme.text }]}>{Currency.format(goal.savedAmount)}</Text>
                    <Text style={[S.targetAmt, { color: theme.secondaryText }]}>of {Currency.format(goal.targetAmount)}</Text>
                    {remaining > 0 && (
                      <Text style={[S.remaining, { color: theme.secondaryText }]}>
                        {Currency.format(remaining)} to go
                      </Text>
                    )}
                    <View style={S.deadlineRow}>
                      <Ionicons name="calendar-outline" size={11} color={theme.secondaryText} />
                      <Text style={[S.deadlineText, { color: theme.secondaryText }]}>
                        {' '}{deadlineLabel(goal)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={[S.barTrack, { backgroundColor: sColor + '22' }]}>
                  <View style={[S.barFill, { backgroundColor: sColor, width: `${Math.round(progress * 100)}%` as any }]} />
                </View>

                {/* Actions */}
                <View style={S.actions}>
                  <TouchableOpacity
                    style={[S.actionBtn, { backgroundColor: goal.color }]}
                    onPress={() => { setFundsGoal(goal); setFundsAmt(''); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={15} color="#FFF" />
                    <Text style={S.actionBtnText}>Add Funds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.editBtn2, { borderColor: theme.border }]}
                    onPress={() => openEdit(goal)}
                  >
                    <Ionicons name="pencil-outline" size={15} color={theme.secondaryText} />
                    <Text style={[S.editBtnText, { color: theme.secondaryText }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[S.modal, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
            {/* Modal header */}
            <View style={S.modalHeader}>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={[S.modalCancel, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[S.modalTitle, { color: theme.text }]}>{editGoal ? 'Edit Goal' : 'New Goal'}</Text>
              <TouchableOpacity onPress={saveGoal} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={theme.tint} /> : (
                  <Text style={[S.modalSave, { color: theme.tint }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 20 }}>
              {/* Name */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>GOAL NAME</Text>
                <TextInput
                  style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={form.name}
                  onChangeText={t => setForm(f => ({ ...f, name: t }))}
                  placeholder="e.g. Emergency Fund"
                  placeholderTextColor={theme.secondaryText}
                  maxLength={60}
                  autoFocus
                />
              </View>

              {/* Amounts */}
              <View style={S.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[S.label, { color: theme.secondaryText }]}>TARGET (₹)</Text>
                  <TextInput
                    style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                    value={form.targetAmount}
                    onChangeText={t => setForm(f => ({ ...f, targetAmount: t }))}
                    keyboardType="numeric"
                    placeholder="50000"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.label, { color: theme.secondaryText }]}>SAVED SO FAR (₹)</Text>
                  <TextInput
                    style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                    value={form.savedAmount}
                    onChangeText={t => setForm(f => ({ ...f, savedAmount: t }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>
              </View>

              {/* Deadline */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>DEADLINE (OPTIONAL)</Text>
                <TouchableOpacity
                  style={[S.input, S.dateRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={openDatePicker}
                >
                  <Ionicons name="calendar-outline" size={16} color={theme.secondaryText} />
                  <Text style={{ color: form.deadline ? theme.text : theme.secondaryText, marginLeft: 8 }}>
                    {form.deadline ? form.deadline.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline'}
                  </Text>
                  {form.deadline && (
                    <TouchableOpacity onPress={() => setForm(f => ({ ...f, deadline: null }))} style={{ marginLeft: 'auto' }}>
                      <Ionicons name="close-circle" size={16} color={theme.secondaryText} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {showDatePicker && Platform.OS === 'ios' && (
                  <DateTimePicker
                    value={form.deadline ?? new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(f => ({ ...f, deadline: d })); }}
                  />
                )}
              </View>

              {/* Icon picker */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>ICON</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {ICONS.map(ic => (
                      <TouchableOpacity
                        key={ic}
                        style={[S.iconPick, { backgroundColor: form.color + '22', borderColor: form.icon === ic ? form.color : 'transparent', borderWidth: 2 }]}
                        onPress={() => setForm(f => ({ ...f, icon: ic }))}
                      >
                        <Ionicons name={ic as any} size={22} color={form.color} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Color picker */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>COLOR</Text>
                <View style={S.colorRow}>
                  {COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[S.colorDot, { backgroundColor: c }, form.color === c && S.colorSelected]}
                      onPress={() => setForm(f => ({ ...f, color: c }))}
                    >
                      {form.color === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Funds Modal ── */}
      <Modal visible={!!fundsGoal} transparent animationType="fade" onRequestClose={() => setFundsGoal(null)}>
        <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={() => setFundsGoal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[S.fundsCard, { backgroundColor: theme.background }]}>
                <Text style={[S.modalTitle, { color: theme.text, marginBottom: 4 }]}>Add Funds</Text>
                {fundsGoal && (
                  <Text style={[S.fundsGoalName, { color: theme.secondaryText }]}>{fundsGoal.name}</Text>
                )}
                <TextInput
                  style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border, marginTop: 16 }]}
                  value={fundsAmt}
                  onChangeText={setFundsAmt}
                  keyboardType="numeric"
                  placeholder="Amount (₹)"
                  placeholderTextColor={theme.secondaryText}
                  autoFocus
                />
                <View style={S.fundsActions}>
                  <TouchableOpacity style={[S.cancelBtn, { borderColor: theme.border }]} onPress={() => setFundsGoal(null)}>
                    <Text style={{ color: theme.secondaryText, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.confirmBtn, { backgroundColor: fundsGoal?.color ?? theme.tint }]}
                    onPress={handleAddFunds}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                      <Text style={{ color: '#FFF', fontWeight: '700' }}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800' },
  addBtn:       { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  list:         { paddingHorizontal: 16, paddingTop: 4, gap: 16 },

  card:         { borderRadius: 24, padding: 20, gap: 16 },
  cardTop:      { flexDirection: 'row', alignItems: 'center' },
  iconBox:      { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalName:     { fontSize: 16, fontWeight: '700' },
  statusRow:    { flexDirection: 'row', marginTop: 2 },
  badge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText:    { fontSize: 11, fontWeight: '700' },

  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringWrap:     { position: 'relative', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ringCenter:   { position: 'absolute', alignItems: 'center' },
  ringPct:      { fontSize: 15, fontWeight: '900' },
  amountCol:    { flex: 1, gap: 2 },
  savedAmt:     { fontSize: 22, fontWeight: '900' },
  targetAmt:    { fontSize: 13, fontWeight: '500' },
  remaining:    { fontSize: 12 },
  deadlineRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  deadlineText: { fontSize: 12 },

  barTrack:     { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: 6, borderRadius: 3 },

  actions:      { flexDirection: 'row', gap: 10 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14 },
  actionBtnText:{ color: '#FFF', fontSize: 13, fontWeight: '700' },
  editBtn2:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  editBtnText:  { fontSize: 13, fontWeight: '600' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, marginTop: 8 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Modal
  modal:        { flex: 1 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12 },
  modalTitle:   { fontSize: 16, fontWeight: '800' },
  modalCancel:  { fontSize: 15 },
  modalSave:    { fontSize: 15, fontWeight: '700' },
  label:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input:        { padding: 14, borderRadius: 14, fontSize: 15, borderWidth: 1 },
  dateRow:      { flexDirection: 'row', alignItems: 'center' },
  row2:         { flexDirection: 'row', gap: 12 },
  iconPick:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  colorRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  colorDot:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  colorSelected:{ transform: [{ scale: 1.15 }] },

  // Add Funds modal
  overlay:      { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', paddingHorizontal: 24 },
  fundsCard:    { borderRadius: 24, padding: 24 },
  fundsGoalName:{ fontSize: 13 },
  fundsActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:    { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  confirmBtn:   { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14 },
});
