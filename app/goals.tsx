import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Alert, Platform, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Currency, getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import {
  Screen, Card, Touchable, Button, Sheet, Field, Amount, EmptyState, Chip, Skeleton,
  type SheetHandle,
} from '@/components/ui';
import { getGoals, createGoal, updateGoal, deleteGoal, Goal } from '@/src/services/dataService';

const ICONS = [
  'flag-outline', 'home-outline', 'airplane-outline', 'car-outline',
  'school-outline', 'gift-outline', 'heart-outline', 'trophy-outline',
  'laptop-outline', 'medkit-outline', 'restaurant-outline', 'fitness-outline',
  'cash-outline', 'business-outline', 'rocket-outline',
];

// A goal's colour is its identity, like an account's — the one place a raw colour is chosen.
const COLORS = [
  '#18181B', '#1E3A5F', '#134E4A', '#14532D', '#4C1D95',
  '#7C2D12', '#92400E', '#881337', '#374151', '#0F4C75',
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

function RingProgress({ size, progress, color, bg }: { size: number; progress: number; color: string; bg: string }) {
  const sw  = 9;
  const r   = (size - sw) / 2;
  const c   = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={bg} strokeWidth={sw} fill="none" />
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

  const [goals,     setGoals]     = useState<Goal[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editGoal,  setEditGoal]  = useState<Goal | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [fundsGoal, setFundsGoal] = useState<Goal | null>(null);
  const [fundsAmt,  setFundsAmt]  = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const loaded = useRef(false);

  const formSheet  = useRef<SheetHandle>(null);
  const fundsSheet = useRef<SheetHandle>(null);

  const fetchGoals = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      setGoals(await getGoals());
      loaded.current = true;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  // Skeleton on the first load only; coming back refreshes silently (W2-13).
  useFocusEffect(useCallback(() => { if (!loaded.current) setLoading(true); fetchGoals(); }, [fetchGoals]));

  const openAdd = () => {
    setEditGoal(null);
    setForm(EMPTY_FORM);
    formSheet.current?.present();
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
    formSheet.current?.present();
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
      formSheet.current?.dismiss();
    } catch (e: any) {
      Alert.alert('Error', e?.msg || 'Could not save goal.');
    } finally {
      setSaving(false);
    }
  };

  const openFunds = (goal: Goal) => {
    setFundsGoal(goal);
    setFundsAmt('');
    fundsSheet.current?.present();
  };

  const handleAddFunds = async () => {
    if (!fundsGoal) return;
    const amt = parseFloat(fundsAmt);
    if (!amt || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const updated = await updateGoal(fundsGoal._id, { addAmount: amt });
      setGoals(g => g.map(x => x._id === updated._id ? updated : x));
      fundsSheet.current?.dismiss();
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

  const statusChip = (status: GoalStatus, goal: Goal) => {
    switch (status) {
      case 'completed': return <Chip size="sm" tone="income"  icon="checkmark" label="Completed" />;
      case 'overdue':   return <Chip size="sm" tone="expense" label="Overdue" />;
      case 'behind':    return <Chip size="sm" label="Behind pace" />;
      default:          return goal.deadline ? <Chip size="sm" color={goal.color} label="On track" /> : null;
    }
  };
  const statusColor = (status: GoalStatus, goal: Goal) =>
    status === 'completed' ? theme.income : status === 'overdue' ? theme.expense : status === 'behind' ? theme.secondaryText : goal.color;

  const addButton = (
    <Touchable onPress={openAdd} size={36} style={S.headerBtn} accessibilityLabel="Add goal" rippleBorderless>
      <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
    </Touchable>
  );

  if (isGuest) {
    return (
      <Screen title="Savings goals">
        <EmptyState icon="flag-outline" title="Sign in to track goals" body="Savings goals are synced with your group. Create an account to get started." />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Savings goals" right={addButton}>
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={200} round={radius.lg} />
          <Skeleton.Block height={200} round={radius.lg} />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="Savings goals" right={addButton}>
      {goals.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No goals yet"
          body="Set a savings goal to track your progress toward something meaningful."
          action={{ label: 'Add first goal', onPress: openAdd }}
        />
      ) : (
        <View style={S.list}>
          {goals.map(goal => {
            const status    = getStatus(goal);
            const sColor    = statusColor(status, goal);
            const progress  = Math.min(goal.savedAmount / goal.targetAmount, 1);
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
            return (
              <Card key={goal._id}>
                <View style={S.cardTop}>
                  <View style={[S.iconBox, { backgroundColor: hexToRGBA(goal.color, 0.14) }]}>
                    <Ionicons name={goal.icon as any} size={iconSize.lg} color={goal.color} />
                  </View>
                  <View style={{ flex: 1, gap: space.xs }}>
                    <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={1}>{goal.name}</Text>
                    <View style={{ flexDirection: 'row' }}>{statusChip(status, goal)}</View>
                  </View>
                  <Touchable onPress={() => handleDelete(goal)} size={28} style={S.trash} accessibilityLabel={`Delete ${goal.name}`} rippleBorderless>
                    <Ionicons name="trash-outline" size={iconSize.sm} color={theme.secondaryText} />
                  </Touchable>
                </View>

                <View style={S.progressRow}>
                  <View style={S.ringWrap} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
                    <RingProgress size={80} progress={progress} color={sColor} bg={hexToRGBA(sColor, 0.15)} />
                    <View style={S.ringCenter}>
                      <Text style={[type.bodyStrong, { color: sColor }]}>{Math.round(progress * 100)}%</Text>
                    </View>
                  </View>
                  <View style={S.amounts}>
                    <Amount value={goal.savedAmount} role="heading" />
                    <Text style={[type.label, { color: theme.secondaryText }]}>of {Currency.format(goal.targetAmount)}</Text>
                    {remaining > 0 && <Text style={[type.label, { color: theme.secondaryText }]}>{Currency.format(remaining)} to go</Text>}
                    <View style={S.deadline}>
                      <Ionicons name="calendar-outline" size={12} color={theme.secondaryText} />
                      <Text style={[type.label, { color: theme.secondaryText }]}>{deadlineLabel(goal)}</Text>
                    </View>
                  </View>
                </View>

                <View style={S.actions}>
                  <Button size="sm" icon="add" label="Add funds" onPress={() => openFunds(goal)} style={{ flex: 1 }} block />
                  <Button size="sm" variant="secondary" icon="create-outline" label="Edit" onPress={() => openEdit(goal)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* ── Add / edit goal ── */}
      <Sheet ref={formSheet} title={editGoal ? 'Edit goal' : 'New goal'} scroll snapPoints={['85%']}>
        <Field label="Goal name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="e.g. Emergency fund" autoCapitalize="words" />
        <View style={S.two}>
          <Field label="Target" value={form.targetAmount} onChangeText={t => setForm(f => ({ ...f, targetAmount: t }))} placeholder="50000" keyboardType="numeric"
            right={<Text style={[type.label, { color: theme.secondaryText }]}>{Currency.symbol}</Text>} style={{ flex: 1 }} />
          <Field label="Saved so far" value={form.savedAmount} onChangeText={t => setForm(f => ({ ...f, savedAmount: t }))} placeholder="0" keyboardType="numeric"
            right={<Text style={[type.label, { color: theme.secondaryText }]}>{Currency.symbol}</Text>} style={{ flex: 1 }} />
        </View>

        <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Deadline (optional)</Text>
        <View style={S.deadlineRow}>
          <Touchable onPress={openDatePicker} style={[S.dateField, { backgroundColor: theme.inputBg, borderColor: theme.border }]} accessibilityLabel={form.deadline ? `Deadline ${form.deadline.toDateString()}` : 'Set a deadline'}>
            <Ionicons name="calendar-outline" size={iconSize.md} color={theme.secondaryText} />
            <Text style={[type.body, { color: form.deadline ? theme.text : theme.secondaryText, flex: 1 }]}>
              {form.deadline ? form.deadline.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline'}
            </Text>
          </Touchable>
          {form.deadline && (
            <Touchable onPress={() => setForm(f => ({ ...f, deadline: null }))} size={36} style={S.clearDate} accessibilityLabel="Clear deadline" rippleBorderless>
              <Ionicons name="close-circle" size={iconSize.md} color={theme.secondaryText} />
            </Touchable>
          )}
        </View>
        {showDatePicker && Platform.OS === 'ios' && (
          <DateTimePicker
            value={form.deadline ?? new Date()}
            mode="date"
            display="inline"
            minimumDate={new Date()}
            onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(f => ({ ...f, deadline: d })); }}
          />
        )}

        <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.iconRow}>
          {ICONS.map(ic => (
            <Touchable
              key={ic}
              onPress={() => setForm(f => ({ ...f, icon: ic }))}
              haptic="selection"
              size={44}
              style={[S.iconPick, { backgroundColor: hexToRGBA(form.color, 0.14), borderColor: form.icon === ic ? form.color : 'transparent' }]}
              accessibilityLabel={ic.replace('-outline', '')}
              accessibilityState={{ selected: form.icon === ic }}
            >
              <Ionicons name={ic as any} size={iconSize.lg} color={form.color} />
            </Touchable>
          ))}
        </ScrollView>

        <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Colour</Text>
        <View style={S.colors}>
          {COLORS.map(c => (
            <Touchable
              key={c}
              onPress={() => setForm(f => ({ ...f, color: c }))}
              haptic="selection"
              size={36}
              style={[S.colorDot, { backgroundColor: c }, form.color === c && { borderColor: theme.text, borderWidth: 2 }]}
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: form.color === c }}
              rippleBorderless
            >
              {form.color === c && <Ionicons name="checkmark" size={iconSize.sm} color={getContrastText(c)} />}
            </Touchable>
          ))}
        </View>

        <Button label={editGoal ? 'Save changes' : 'Create goal'} onPress={saveGoal} loading={saving} style={{ marginTop: space.xl }} />
      </Sheet>

      {/* ── Add funds ── */}
      <Sheet ref={fundsSheet} title={fundsGoal ? `Add to ${fundsGoal.name}` : 'Add funds'}>
        <Field
          label="Amount"
          value={fundsAmt}
          onChangeText={setFundsAmt}
          placeholder="0"
          keyboardType="numeric"
          autoFocus
          right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{Currency.symbol}</Text>}
        />
        <Button label="Add funds" onPress={handleAddFunds} loading={saving} disabled={!fundsAmt} style={{ marginTop: space.lg }} />
      </Sheet>
    </Screen>
  );
}

const S = StyleSheet.create({
  headerBtn:   { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  list:        { gap: space.md, marginTop: space.sm },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBox:     { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  trash:       { width: 28, height: 28, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  ringWrap:    { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  ringCenter:  { position: 'absolute' },
  amounts:     { flex: 1, gap: 2 },
  deadline:    { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  actions:     { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  two:         { flexDirection: 'row', gap: space.md, marginTop: space.md },
  label:       { marginTop: space.lg, marginBottom: space.sm, marginLeft: space.xs },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateField:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md },
  clearDate:   { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  iconRow:     { flexDirection: 'row', gap: space.sm },
  iconPick:    { width: 44, height: 44, borderRadius: radius.md, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  colors:      { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  colorDot:    { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
});
