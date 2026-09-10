import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { hexToRGBA } from '@/constants/theme';
import {
  getTrip, addMember, removeMember, addExpense, updateExpense, deleteExpense,
  Trip, TripExpense,
} from '@/src/services/local/tripMasterService';
import { computeSettlement, formatMinor, toMinorUnits, fromMinorUnits } from '@/src/utils/settlement';

// Palette for member avatars — cycles if more than 10 people
const AVATAR_PALETTE = [
  '#5856D6', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24',
  '#6C5CE7', '#00B894', '#E17055', '#A29BFE', '#FD79A8',
];
function avatarColor(index: number) { return AVATAR_PALETTE[index % AVATAR_PALETTE.length]; }

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={SH.row}>
      <Text style={[SH.title, { color: theme.text }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity style={[SH.actionBtn, { backgroundColor: hexToRGBA(theme.tint, 0.12) }]} onPress={onAction} hitSlop={10}>
          <Ionicons name="add" size={15} color={theme.tint} />
          <Text style={[SH.actionText, { color: theme.tint }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const SH = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10, paddingHorizontal: 2 },
  title:      { fontSize: 17, fontWeight: '800' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionText: { fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();

  const [trip, setTrip]       = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-member modal
  const [showMember, setShowMember] = useState(false);
  const [memberName, setMemberName] = useState('');

  // Add/edit-expense sheet
  const [showExpense, setShowExpense]   = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [expDesc, setExpDesc]           = useState('');
  const [expAmount, setExpAmount]       = useState('');
  const [expPaidBy, setExpPaidBy]       = useState<string>('');
  const [expParts, setExpParts]         = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTrip(await getTrip(id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const symbol = trip ? (CURRENCY_META[trip.currency as CurrencyCode]?.symbol ?? '₹') : '₹';

  const settlement = useMemo(
    () => (trip ? computeSettlement(trip.members, trip.expenses) : null),
    [trip],
  );

  const getMemberName = useCallback(
    (mid: string) => trip?.members.find(m => m.id === mid)?.name ?? 'Unknown',
    [trip],
  );

  const getMemberIndex = useCallback(
    (mid: string) => trip?.members.findIndex(m => m.id === mid) ?? 0,
    [trip],
  );

  // ── Member handlers ──
  const handleAddMember = async () => {
    if (!trip || !memberName.trim()) return;
    const updated = await addMember(trip.id, memberName);
    setTrip(updated);
    setMemberName('');
    setShowMember(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveMember = (mid: string) => {
    if (!trip) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const involved = trip.expenses.some(e => e.paidById === mid || e.participantIds.includes(mid));
    Alert.alert(
      'Remove Person',
      involved
        ? `${getMemberName(mid)} is part of some expenses. Removing them also removes expenses they paid for. Continue?`
        : `Remove ${getMemberName(mid)} from this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => setTrip(await removeMember(trip.id, mid)) },
      ],
    );
  };

  // ── Expense handlers ──
  const openAddExpense = () => {
    if (!trip || trip.members.length === 0) {
      Alert.alert('Add people first', 'Add at least one person before logging an expense.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingId(null);
    setExpDesc('');
    setExpAmount('');
    setExpPaidBy(trip.members[0].id);
    setExpParts(new Set(trip.members.map(m => m.id)));
    setShowExpense(true);
  };

  const openEditExpense = (exp: TripExpense) => {
    if (!trip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(exp.id);
    setExpDesc(exp.description);
    setExpAmount(String(fromMinorUnits(exp.amountMinor)));
    setExpPaidBy(exp.paidById);
    setExpParts(new Set(exp.participantIds));
    setShowExpense(true);
  };

  const toggleParticipant = (mid: string) => {
    Haptics.selectionAsync();
    setExpParts(prev => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid); else next.add(mid);
      return next;
    });
  };

  const amountMinorPreview = toMinorUnits(parseFloat(expAmount));
  const canSaveExpense = amountMinorPreview > 0 && !!expPaidBy && expParts.size > 0;

  const handleSaveExpense = async () => {
    if (!trip || !canSaveExpense) return;
    setSaving(true);
    try {
      const payload = {
        description: expDesc,
        amountMinor: amountMinorPreview,
        paidById: expPaidBy,
        participantIds: [...expParts],
      };
      const updated = editingId
        ? await updateExpense(trip.id, editingId, payload)
        : await addExpense(trip.id, payload);
      setTrip(updated);
      setShowExpense(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (exp: TripExpense) => {
    if (!trip) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Expense', `Delete "${exp.description || 'this expense'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => setTrip(await deleteExpense(trip.id, exp.id)) },
    ]);
  };

  // ── Loading / not found ──
  if (loading) {
    return (
      <ThemedView style={[S.container, { paddingTop: top }]}>
        <View style={S.center}><ActivityIndicator color={theme.tint} size="large" /></View>
      </ThemedView>
    );
  }

  if (!trip) {
    return (
      <ThemedView style={[S.container, { paddingTop: top }]}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.iconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { color: theme.text }]}>TripMaster</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={S.center}>
          <Text style={{ color: theme.secondaryText }}>This trip no longer exists.</Text>
        </View>
      </ThemedView>
    );
  }

  const hasExpenses  = trip.expenses.length > 0;
  const hasMembers   = trip.members.length > 0;
  const allSettled   = settlement?.transfers.length === 0;

  return (
    <ThemedView style={[S.container, { paddingTop: top }]}>

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: theme.text }]} numberOfLines={1}>{trip.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero / Summary card ── */}
        <LinearGradient
          colors={[theme.tint, hexToRGBA(theme.tint, 0.72)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.2 }}
          style={S.heroCard}
        >
          <Text style={S.heroLabel}>TOTAL TRIP SPEND</Text>
          <Text style={S.heroAmount}>
            {formatMinor(settlement!.totalSpentMinor, symbol)}
          </Text>
          <View style={S.heroMeta}>
            <View style={S.heroPill}>
              <Ionicons name="people-outline" size={13} color={theme.tintText} />
              <Text style={[S.heroPillText, { color: theme.tintText }]}>
                {trip.members.length} {trip.members.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
            <View style={[S.heroDot, { backgroundColor: hexToRGBA(theme.tintText, 0.4) }]} />
            <View style={S.heroPill}>
              <Ionicons name="receipt-outline" size={13} color={theme.tintText} />
              <Text style={[S.heroPillText, { color: theme.tintText }]}>
                {trip.expenses.length} {trip.expenses.length === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>
            {hasExpenses && (
              <>
                <View style={[S.heroDot, { backgroundColor: hexToRGBA(theme.tintText, 0.4) }]} />
                <View style={[S.heroBadge, { backgroundColor: hexToRGBA(theme.tintText, allSettled ? 0.25 : 0.18) }]}>
                  <Ionicons
                    name={allSettled ? 'checkmark-circle-outline' : 'time-outline'}
                    size={13}
                    color={theme.tintText}
                  />
                  <Text style={[S.heroPillText, { color: theme.tintText }]}>
                    {allSettled ? 'All settled' : `${settlement!.transfers.length} to settle`}
                  </Text>
                </View>
              </>
            )}
          </View>
        </LinearGradient>

        {/* ── People section ── */}
        <SectionHeader
          title="People"
          action="Add"
          onAction={() => { setMemberName(''); setShowMember(true); }}
        />

        {!hasMembers ? (
          <View style={[S.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="person-add-outline" size={24} color={theme.secondaryText} style={{ marginBottom: 8 }} />
            <Text style={[S.emptyCardText, { color: theme.secondaryText }]}>
              Add people who went on this trip.
            </Text>
          </View>
        ) : (
          <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {trip.members.map((m, idx) => {
              const color = avatarColor(idx);
              return (
                <View key={m.id}>
                  {idx > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                  <View style={S.memberRow}>
                    <View style={[S.memberAvatar, { backgroundColor: hexToRGBA(color, 0.18) }]}>
                      <Text style={[S.memberAvatarText, { color }]}>{m.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[S.memberName, { color: theme.text }]}>{m.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(m.id)}
                      style={[S.memberRemove, { backgroundColor: hexToRGBA(theme.expense, 0.1) }]}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={theme.expense} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Expenses section ── */}
        <SectionHeader
          title="Expenses"
          action="Add"
          onAction={openAddExpense}
        />

        {!hasExpenses ? (
          <View style={[S.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="receipt-outline" size={24} color={theme.secondaryText} style={{ marginBottom: 8 }} />
            <Text style={[S.emptyCardText, { color: theme.secondaryText }]}>
              {hasMembers ? 'No expenses yet. Tap "Add" to log one.' : 'Add people first, then log expenses.'}
            </Text>
          </View>
        ) : (
          <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {trip.expenses.map((exp, i) => {
              const payerIdx = getMemberIndex(exp.paidById);
              const payerColor = avatarColor(payerIdx);
              return (
                <View key={exp.id}>
                  {i > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                  <TouchableOpacity
                    style={S.expRow}
                    onPress={() => openEditExpense(exp)}
                    onLongPress={() => handleDeleteExpense(exp)}
                    activeOpacity={0.65}
                  >
                    <View style={[S.expIconBox, { backgroundColor: hexToRGBA(theme.tint, 0.12) }]}>
                      <Ionicons name="receipt-outline" size={18} color={theme.tint} />
                    </View>
                    <View style={S.expBody}>
                      <Text style={[S.expDesc, { color: theme.text }]} numberOfLines={1}>
                        {exp.description || 'Expense'}
                      </Text>
                      <View style={S.expMetaRow}>
                        <View style={[S.expPayerDot, { backgroundColor: hexToRGBA(payerColor, 0.2) }]}>
                          <Text style={[S.expPayerLetter, { color: payerColor }]}>
                            {getMemberName(exp.paidById).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[S.expMeta, { color: theme.secondaryText }]} numberOfLines={1}>
                          {getMemberName(exp.paidById)} paid · {exp.participantIds.length}-way split
                        </Text>
                      </View>
                    </View>
                    <Text style={[S.expAmount, { color: theme.text }]}>{formatMinor(exp.amountMinor, symbol)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
        {hasExpenses && (
          <Text style={[S.hint, { color: theme.secondaryText }]}>Tap to edit · long-press to delete</Text>
        )}

        {/* ── Settle Up section ── */}
        {hasExpenses && (
          <>
            <View style={[SH.row, { marginTop: 32 }]}>
              <Text style={[SH.title, { color: theme.text }]}>Settle Up</Text>
              {allSettled && (
                <View style={[S.settledBadge, { backgroundColor: hexToRGBA(theme.income, 0.15) }]}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.income} />
                  <Text style={[S.settledBadgeText, { color: theme.income }]}>All even</Text>
                </View>
              )}
            </View>

            {/* Per-person balances */}
            <Text style={[S.subLabel, { color: theme.secondaryText }]}>BALANCES</Text>
            <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {settlement!.balances.map((b, i) => {
                const owes  = b.netMinor < 0;
                const even  = b.netMinor === 0;
                const color = even ? theme.secondaryText : owes ? theme.expense : theme.income;
                const memberIdx = trip.members.findIndex(m => m.id === b.id);
                const memberColor = memberIdx >= 0 ? avatarColor(memberIdx) : theme.tint;
                return (
                  <View key={b.id}>
                    {i > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                    <View style={S.balRow}>
                      <View style={[S.memberAvatar, { backgroundColor: hexToRGBA(memberColor, 0.18) }]}>
                        <Text style={[S.memberAvatarText, { color: memberColor }]}>{b.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={S.balBody}>
                        <Text style={[S.balName, { color: theme.text }]}>{b.name}</Text>
                        <Text style={[S.balSub, { color: theme.secondaryText }]}>
                          paid {formatMinor(b.paidMinor, symbol)} · share {formatMinor(b.shareMinor, symbol)}
                        </Text>
                      </View>
                      <View style={[S.balPill, { backgroundColor: hexToRGBA(color, 0.12) }]}>
                        <Text style={[S.balNet, { color }]}>
                          {even ? 'Even' : owes ? `-${formatMinor(-b.netMinor, symbol)}` : `+${formatMinor(b.netMinor, symbol)}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Transfer instructions */}
            <Text style={[S.subLabel, { color: theme.secondaryText }]}>WHO PAYS WHOM</Text>
            {allSettled ? (
              <LinearGradient
                colors={[hexToRGBA(theme.income, 0.18), hexToRGBA(theme.income, 0.06)]}
                style={S.allSettledBanner}
              >
                <Ionicons name="checkmark-circle" size={22} color={theme.income} />
                <Text style={[S.allSettledText, { color: theme.income }]}>
                  All settled — everyone's even!
                </Text>
              </LinearGradient>
            ) : (
              <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {settlement!.transfers.map((t, i) => {
                  const fromIdx   = trip.members.findIndex(m => m.id === t.fromId);
                  const toIdx     = trip.members.findIndex(m => m.id === t.toId);
                  const fromColor = fromIdx >= 0 ? avatarColor(fromIdx) : theme.expense;
                  const toColor   = toIdx   >= 0 ? avatarColor(toIdx)   : theme.income;
                  return (
                    <View key={`${t.fromId}-${t.toId}-${i}`}>
                      {i > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                      <View style={S.transferRow}>
                        {/* From avatar */}
                        <View style={[S.transferAvatar, { backgroundColor: hexToRGBA(fromColor, 0.16) }]}>
                          <Text style={[S.memberAvatarText, { color: fromColor }]}>{t.fromName.charAt(0).toUpperCase()}</Text>
                        </View>
                        {/* Names + arrow */}
                        <View style={S.transferBody}>
                          <Text style={[S.transferFrom, { color: theme.text }]} numberOfLines={1}>{t.fromName}</Text>
                          <View style={S.transferArrowRow}>
                            <View style={[S.transferLine, { backgroundColor: theme.border }]} />
                            <Ionicons name="arrow-forward" size={12} color={theme.secondaryText} />
                          </View>
                          <Text style={[S.transferTo, { color: theme.secondaryText }]} numberOfLines={1}>{t.toName}</Text>
                        </View>
                        {/* To avatar */}
                        <View style={[S.transferAvatar, { backgroundColor: hexToRGBA(toColor, 0.16) }]}>
                          <Text style={[S.memberAvatarText, { color: toColor }]}>{t.toName.charAt(0).toUpperCase()}</Text>
                        </View>
                        {/* Amount */}
                        <View style={[S.transferAmtWrap, { backgroundColor: hexToRGBA(theme.tint, 0.1) }]}>
                          <Text style={[S.transferAmt, { color: theme.tint }]}>{formatMinor(t.amountMinor, symbol)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FAB: Add Expense ── */}
      {hasMembers && (
        <TouchableOpacity
          style={[S.fab, { backgroundColor: theme.tint, bottom: Math.max(bottom, 20) + 16 }]}
          onPress={openAddExpense}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={theme.tintText} />
        </TouchableOpacity>
      )}

      {/* ── Add Member modal ── */}
      <Modal visible={showMember} transparent animationType="fade" onRequestClose={() => setShowMember(false)}>
        <KeyboardAvoidingView style={S.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.modalCard, { backgroundColor: theme.card }]}>
            <View style={[S.modalIconWrap, { backgroundColor: hexToRGBA(theme.tint, 0.14) }]}>
              <Ionicons name="person-add-outline" size={28} color={theme.tint} />
            </View>
            <Text style={[S.modalTitle, { color: theme.text }]}>Add Person</Text>
            <Text style={[S.modalSub, { color: theme.secondaryText }]}>Enter the name of someone on this trip.</Text>
            <TextInput
              style={[S.input, { backgroundColor: theme.cardAlt, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. Rahul, Priya"
              placeholderTextColor={theme.secondaryText}
              value={memberName}
              onChangeText={setMemberName}
              autoFocus
              maxLength={30}
              onSubmitEditing={handleAddMember}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[S.modalBtn, { backgroundColor: theme.tint, opacity: memberName.trim() ? 1 : 0.5 }]}
              onPress={handleAddMember}
              disabled={!memberName.trim()}
            >
              <Text style={[S.modalBtnText, { color: theme.tintText }]}>Add Person</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.modalCancel} onPress={() => setShowMember(false)}>
              <Text style={[S.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add / Edit Expense bottom sheet ── */}
      <Modal visible={showExpense} transparent animationType="slide" onRequestClose={() => setShowExpense(false)}>
        <KeyboardAvoidingView style={S.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.sheet, { backgroundColor: theme.card, paddingBottom: Math.max(bottom, 16) + 8 }]}>
            {/* Handle */}
            <View style={S.handleWrap}>
              <View style={[S.handle, { backgroundColor: theme.border }]} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Sheet header */}
              <View style={S.sheetHead}>
                <View style={[S.sheetIconWrap, { backgroundColor: hexToRGBA(theme.tint, 0.14) }]}>
                  <Ionicons name="receipt-outline" size={22} color={theme.tint} />
                </View>
                <Text style={[S.sheetTitle, { color: theme.text }]}>
                  {editingId ? 'Edit Expense' : 'Add Expense'}
                </Text>
              </View>

              {/* Amount */}
              <Text style={[S.fieldLabel, { color: theme.secondaryText }]}>AMOUNT</Text>
              <View style={[S.amountRow, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
                <Text style={[S.amountSymbol, { color: theme.text }]}>{symbol}</Text>
                <TextInput
                  style={[S.amountInput, { color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={theme.secondaryText}
                  value={expAmount}
                  onChangeText={t => setExpAmount(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  autoFocus={!editingId}
                />
              </View>

              {/* Description */}
              <Text style={[S.fieldLabel, { color: theme.secondaryText }]}>DESCRIPTION (optional)</Text>
              <TextInput
                style={[S.input, { backgroundColor: theme.cardAlt, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. Hotel, Dinner, Cab"
                placeholderTextColor={theme.secondaryText}
                value={expDesc}
                onChangeText={setExpDesc}
                maxLength={50}
              />

              {/* Paid By */}
              <Text style={[S.fieldLabel, { color: theme.secondaryText }]}>PAID BY</Text>
              <View style={S.chipWrap}>
                {trip.members.map((m, idx) => {
                  const active = expPaidBy === m.id;
                  const color  = avatarColor(idx);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        S.paidChip,
                        {
                          borderColor: active ? color : theme.border,
                          backgroundColor: active ? hexToRGBA(color, 0.14) : 'transparent',
                        },
                      ]}
                      onPress={() => { setExpPaidBy(m.id); Haptics.selectionAsync(); }}
                      activeOpacity={0.75}
                    >
                      <View style={[S.chipAvatar, { backgroundColor: hexToRGBA(color, active ? 0.3 : 0.15) }]}>
                        <Text style={[S.chipAvatarText, { color }]}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[S.chipName, { color: active ? color : theme.text }]}>{m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Split between */}
              <View style={S.splitHeadRow}>
                <Text style={[S.fieldLabel, { color: theme.secondaryText, marginTop: 0 }]}>SPLIT BETWEEN</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExpParts(prev =>
                      prev.size === trip.members.length ? new Set() : new Set(trip.members.map(m => m.id)),
                    );
                  }}
                  hitSlop={8}
                >
                  <Text style={[S.selectAllText, { color: theme.tint }]}>
                    {expParts.size === trip.members.length ? 'Clear all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={S.chipWrap}>
                {trip.members.map((m, idx) => {
                  const active = expParts.has(m.id);
                  const color  = avatarColor(idx);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        S.paidChip,
                        {
                          borderColor: active ? color : theme.border,
                          backgroundColor: active ? hexToRGBA(color, 0.1) : 'transparent',
                        },
                      ]}
                      onPress={() => toggleParticipant(m.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[S.chipAvatar, { backgroundColor: hexToRGBA(color, active ? 0.3 : 0.15) }]}>
                        {active
                          ? <Ionicons name="checkmark" size={12} color={color} />
                          : <Text style={[S.chipAvatarText, { color }]}>{m.name.charAt(0).toUpperCase()}</Text>}
                      </View>
                      <Text style={[S.chipName, { color: active ? color : theme.text }]}>{m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {amountMinorPreview > 0 && expParts.size > 0 && (
                <View style={[S.splitPreviewBox, { backgroundColor: hexToRGBA(theme.tint, 0.08), borderColor: hexToRGBA(theme.tint, 0.2) }]}>
                  <Ionicons name="calculator-outline" size={14} color={theme.tint} />
                  <Text style={[S.splitPreviewText, { color: theme.tint }]}>
                    {formatMinor(Math.floor(amountMinorPreview / expParts.size), symbol)} each
                    {amountMinorPreview % expParts.size !== 0 ? ' (1 paisa difference)' : ''}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[S.sheetBtn, { backgroundColor: theme.tint, opacity: canSaveExpense && !saving ? 1 : 0.45, marginTop: 22 }]}
                onPress={handleSaveExpense}
                disabled={!canSaveExpense || saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={theme.tintText} />
                  : <Text style={[S.sheetBtnText, { color: theme.tintText }]}>{editingId ? 'Save Changes' : 'Add Expense'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={S.sheetCancel} onPress={() => setShowExpense(false)} disabled={saving}>
                <Text style={[S.sheetCancelText, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ThemedView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, gap: 8,
  },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 16, paddingTop: 4 },

  // Hero card
  heroCard: {
    borderRadius: 20, padding: 22, marginBottom: 4,
  },
  heroLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.75)' },
  heroAmount:  { fontSize: 38, fontWeight: '900', color: '#FFFFFF', marginTop: 6, letterSpacing: -1 },
  heroMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  heroPill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroPillText:{ fontSize: 12, fontWeight: '600' },
  heroDot:     { width: 3, height: 3, borderRadius: 2 },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },

  // Cards
  card:         { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep:          { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  emptyCard:    { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyCardText:{ fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Member rows
  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  memberAvatar:    { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText:{ fontSize: 14, fontWeight: '800' },
  memberName:      { flex: 1, fontSize: 15, fontWeight: '600' },
  memberRemove:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Expense rows
  expRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  expIconBox:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expBody:     { flex: 1, minWidth: 0 },
  expDesc:     { fontSize: 15, fontWeight: '600' },
  expMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  expPayerDot: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  expPayerLetter:{ fontSize: 9, fontWeight: '800' },
  expMeta:     { fontSize: 12, flex: 1 },
  expAmount:   { fontSize: 15, fontWeight: '800' },

  // Balance rows
  balRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  balBody: { flex: 1 },
  balName: { fontSize: 15, fontWeight: '700' },
  balSub:  { fontSize: 12, marginTop: 2 },
  balPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  balNet:  { fontSize: 13, fontWeight: '800' },

  // Transfer rows
  transferRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  transferAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  transferBody:   { flex: 1, alignItems: 'center', gap: 2 },
  transferFrom:   { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  transferArrowRow:{ flexDirection: 'row', alignItems: 'center', gap: 2 },
  transferLine:   { flex: 1, height: 1 },
  transferTo:     { fontSize: 12, textAlign: 'center' },
  transferAmtWrap:{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  transferAmt:    { fontSize: 14, fontWeight: '800' },

  // Settle-up labels / banners
  subLabel:       { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8, paddingHorizontal: 2 },
  settledBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  settledBadgeText:{ fontSize: 12, fontWeight: '700' },
  allSettledBanner:{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 18 },
  allSettledText: { fontSize: 15, fontWeight: '700' },

  hint: { fontSize: 11, marginTop: 8, paddingHorizontal: 2 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
  },

  // Centered modal (Add Person)
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { width: '100%', borderRadius: 26, padding: 24, alignItems: 'center' },
  modalIconWrap:{ width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitle:   { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  modalSub:     { fontSize: 13, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  input:        { width: '100%', height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, marginBottom: 14 },
  modalBtn:     { width: '100%', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
  modalCancel:  { paddingVertical: 14, alignItems: 'center' },
  modalCancelText:{ fontSize: 14 },

  // Bottom sheet (Add / Edit Expense)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, maxHeight: '92%' },
  handleWrap:   { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle:       { width: 38, height: 4, borderRadius: 2 },
  sheetHead:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18, marginTop: 6 },
  sheetIconWrap:{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  sheetTitle:   { fontSize: 18, fontWeight: '800' },
  fieldLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 18, marginBottom: 10 },
  amountRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 60 },
  amountSymbol: { fontSize: 24, fontWeight: '800', marginRight: 8 },
  amountInput:  { flex: 1, fontSize: 28, fontWeight: '800', padding: 0 },

  // Paid-by / split chips
  chipWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paidChip:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 12 },
  chipAvatar:     { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  chipAvatarText: { fontSize: 10, fontWeight: '800' },
  chipName:       { fontSize: 14, fontWeight: '700' },

  splitHeadRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  selectAllText: { fontSize: 13, fontWeight: '700' },

  splitPreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  splitPreviewText:{ fontSize: 13, fontWeight: '600' },

  sheetBtn:      { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sheetBtnText:  { fontSize: 16, fontWeight: '700' },
  sheetCancel:   { paddingVertical: 14, alignItems: 'center' },
  sheetCancelText:{ fontSize: 14 },
});
