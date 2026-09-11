/**
 * Trip detail — people, expenses, and who pays whom.
 *
 * The merged screen from W2-28: the old TripMaster detail view, plus the two things only the
 * server-side splits screen could do — members that are real accounts, and recording a payment that
 * someone actually made. Everything goes through `dataService`, so the same screen drives a trip on
 * this device and a trip in the group.
 *
 * Money is integer minor units end to end; `settlement.ts` does the arithmetic and never sees a
 * float. A recorded payment is fed to it as an expense the sender paid for the recipient — see
 * `tripService.toSettlementInput` — so "settled" needs no special case anywhere.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { hexToRGBA } from '@/constants/theme';
import {
  getTrip, addTripMember, removeTripMember, addTripExpense, updateTripExpense, deleteTripExpense,
  recordTripSettlement, deleteTripSettlement, getCurrentGroup,
  Trip, TripExpense, TripMember,
} from '@/src/services/dataService';
import { isLocalTrip, toSettlementInput } from '@/src/services/tripService';
import { computeSettlement, formatMinor, toMinorUnits, fromMinorUnits } from '@/src/utils/settlement';

// Palette for member avatars — cycles if more than 10 people
const AVATAR_PALETTE = [
  '#5856D6', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24',
  '#6C5CE7', '#00B894', '#E17055', '#A29BFE', '#FD79A8',
];
function avatarColor(index: number) { return AVATAR_PALETTE[index % AVATAR_PALETTE.length]; }

/** Both halves of the service throw: the remote one a string, the local one an Error. */
const msg = (e: any, fallback: string) =>
  (typeof e === 'string' ? e : e?.message) || fallback;

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

/** A member's face: their photo when the account has one, their initial otherwise. */
function MemberAvatar({ name, photo, color, size = 34 }: {
  name: string; photo?: string | null; color: string; size?: number;
}) {
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: hexToRGBA(color, 0.18), justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color }}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user: authUser, isGuest } = useAuth();
  const { top, bottom } = useSafeAreaInsets();

  const myId = (authUser as any)?._id || (authUser as any)?.id || '';

  const [trip, setTrip]       = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-member modal
  const [showMember, setShowMember]     = useState(false);
  const [memberName, setMemberName]     = useState('');
  const [candidates, setCandidates]     = useState<TripMember[]>([]);
  const [addingMember, setAddingMember] = useState(false);

  // Add/edit-expense sheet
  const [showExpense, setShowExpense]   = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [expDesc, setExpDesc]           = useState('');
  const [expAmount, setExpAmount]       = useState('');
  const [expPaidBy, setExpPaidBy]       = useState<string>('');
  const [expParts, setExpParts]         = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode]       = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustom]      = useState<Record<string, string>>({});
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

  // A recorded payment is part of the input, not a flag on top of it, so the balances below already
  // account for everything anyone has paid back.
  const settlement = useMemo(
    () => (trip ? computeSettlement(trip.members, toSettlementInput(trip)) : null),
    [trip],
  );

  /**
   * Whether the viewer may change this trip.
   *
   * A trip on the device is entirely theirs. A trip in the group belongs to whoever made it — the
   * rule W1-27 settled for splits, because group membership alone would let any member delete the
   * record of what they owe. Confirming a payment is the documented exception and is handled by
   * `canConfirm` below.
   */
  const canEdit = !!trip && (isLocalTrip(trip) || trip.ownerId === myId);

  const getMemberName = useCallback(
    (mid: string) => trip?.members.find(m => m.id === mid)?.name ?? 'Unknown',
    [trip],
  );

  const getMemberIndex = useCallback(
    (mid: string) => trip?.members.findIndex(m => m.id === mid) ?? 0,
    [trip],
  );

  const readOnly = () =>
    Alert.alert('Not your trip', 'Only the person who created this trip can change it.');

  // ── Member handlers ──
  const openAddMember = async () => {
    if (!canEdit) return readOnly();
    setMemberName('');
    setCandidates([]);
    setShowMember(true);
    if (isGuest || !trip) return;

    // Group members are offered as a shortcut, not a requirement: linking a member to an account is
    // what lets that person confirm a payment made to them. Anyone else is still just a name.
    try {
      const group: any = await getCurrentGroup();
      const taken = new Set(trip.members.map(m => m.userId).filter(Boolean));
      setCandidates(
        (group?.members || [])
          .filter((m: any) => !taken.has(String(m._id)))
          .map((m: any) => ({ id: '', name: m.name, userId: String(m._id), photo: m.profilePhoto })),
      );
    } catch {
      // The name field still works; only the shortcut is missing.
    }
  };

  const addMember = async (name: string, userId?: string | null) => {
    if (!trip || !name.trim()) return;
    setAddingMember(true);
    try {
      setTrip(await addTripMember(trip.id, name.trim(), userId ?? null));
      setMemberName('');
      setShowMember(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', msg(e, 'Could not add that person.'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (mid: string) => {
    if (!trip) return;
    if (!canEdit) return readOnly();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const involved = trip.expenses.some(e => e.paidById === mid || e.participantIds.includes(mid));
    Alert.alert(
      'Remove Person',
      involved
        ? `${getMemberName(mid)} is part of some expenses. Removing them also removes expenses they paid for. Continue?`
        : `Remove ${getMemberName(mid)} from this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try { setTrip(await removeTripMember(trip.id, mid)); }
            catch (e: any) { Alert.alert('Error', msg(e, 'Could not remove them.')); }
          },
        },
      ],
    );
  };

  // ── Expense handlers ──
  const openAddExpense = () => {
    if (!trip) return;
    if (!canEdit) return readOnly();
    if (trip.members.length === 0) {
      Alert.alert('Add people first', 'Add at least one person before logging an expense.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingId(null);
    setExpDesc('');
    setExpAmount('');
    setExpPaidBy(trip.members[0].id);
    setExpParts(new Set(trip.members.map(m => m.id)));
    setSplitMode('equal');
    setCustom({});
    setShowExpense(true);
  };

  const openEditExpense = (exp: TripExpense) => {
    if (!trip) return;
    if (!canEdit) return readOnly();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(exp.id);
    setExpDesc(exp.description);
    setExpAmount(String(fromMinorUnits(exp.amountMinor)));
    setExpPaidBy(exp.paidById);
    setExpParts(new Set(exp.participantIds));
    setSplitMode(exp.sharesMinor ? 'custom' : 'equal');
    setCustom(
      exp.sharesMinor
        ? Object.fromEntries(Object.entries(exp.sharesMinor).map(([k, v]) => [k, String(fromMinorUnits(v))]))
        : {},
    );
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

  // In custom mode the shares are the truth and the total is their sum — the same rule the engine
  // and the server enforce, so the form cannot submit a total that contradicts its own shares.
  const customShares = useMemo(() => {
    const out: Record<string, number> = {};
    for (const mid of expParts) {
      const minor = toMinorUnits(parseFloat(customAmounts[mid] ?? ''));
      if (minor > 0) out[mid] = minor;
    }
    return out;
  }, [customAmounts, expParts]);

  const customTotalMinor  = Object.values(customShares).reduce((a, b) => a + b, 0);
  const amountMinorEqual  = toMinorUnits(parseFloat(expAmount));
  const totalMinorPreview = splitMode === 'custom' ? customTotalMinor : amountMinorEqual;

  const canSaveExpense = splitMode === 'custom'
    ? Object.keys(customShares).length > 0 && !!expPaidBy
    : amountMinorEqual > 0 && !!expPaidBy && expParts.size > 0;

  /** Seeds the custom fields from the even split, so switching modes starts from what is on screen. */
  const switchToCustom = () => {
    Haptics.selectionAsync();
    if (splitMode === 'custom') { setSplitMode('equal'); return; }
    const ids = [...expParts];
    if (amountMinorEqual > 0 && ids.length > 0) {
      const each = Math.floor(amountMinorEqual / ids.length);
      setCustom(Object.fromEntries(ids.map(mid => [mid, String(fromMinorUnits(each))])));
    }
    setSplitMode('custom');
  };

  const handleSaveExpense = async () => {
    if (!trip || !canSaveExpense) return;
    setSaving(true);
    try {
      const payload = {
        description:    expDesc,
        amountMinor:    totalMinorPreview,
        paidById:       expPaidBy,
        participantIds: splitMode === 'custom' ? Object.keys(customShares) : [...expParts],
        sharesMinor:    splitMode === 'custom' ? customShares : null,
      };
      const updated = editingId
        ? await updateTripExpense(trip.id, editingId, payload)
        : await addTripExpense(trip.id, payload);
      setTrip(updated);
      setShowExpense(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', msg(e, 'Could not save the expense.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (exp: TripExpense) => {
    if (!trip) return;
    if (!canEdit) return readOnly();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Expense', `Delete "${exp.description || 'this expense'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { setTrip(await deleteTripExpense(trip.id, exp.id)); }
          catch (e: any) { Alert.alert('Error', msg(e, 'Could not delete the expense.')); }
        },
      },
    ]);
  };

  // ── Settlement handlers ──

  /**
   * Recording a payment belongs to whoever received it (W1-13), with the trip owner as the fallback
   * for a member who has no account to confirm from. The server checks this again; the button is
   * hidden here so nobody is offered an action that will be refused.
   */
  const canConfirm = useCallback((toId: string) => {
    if (!trip) return false;
    if (isLocalTrip(trip)) return true;
    const to = trip.members.find(m => m.id === toId);
    return (to?.userId && to.userId === myId) || trip.ownerId === myId;
  }, [trip, myId]);

  const handleRecordSettlement = (fromId: string, toId: string, amountMinor: number) => {
    if (!trip) return;
    Alert.alert(
      'Mark as paid?',
      `${getMemberName(fromId)} paid ${getMemberName(toId)} ${formatMinor(amountMinor, symbol)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              setTrip(await recordTripSettlement(trip.id, { fromId, toId, amountMinor }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert('Error', msg(e, 'Could not record the payment.'));
            }
          },
        },
      ],
    );
  };

  /** Undoing a payment is deleting its record, not a second flag over the top of it (W1-29). */
  const handleUndoSettlement = (settlementId: string, fromId: string, toId: string, amountMinor: number) => {
    if (!trip) return;
    Alert.alert(
      'Undo this payment?',
      `${getMemberName(fromId)} will owe ${getMemberName(toId)} ${formatMinor(amountMinor, symbol)} again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo', style: 'destructive',
          onPress: async () => {
            try { setTrip(await deleteTripSettlement(trip.id, settlementId)); }
            catch (e: any) { Alert.alert('Error', msg(e, 'Could not undo the payment.')); }
          },
        },
      ],
    );
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
          <Text style={[S.headerTitle, { color: theme.text }]}>Trip</Text>
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
  const hasPayments  = trip.settlements.length > 0;
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
          <Text style={[S.heroLabel, { color: theme.tintText }]}>TOTAL TRIP SPEND</Text>
          <Text style={[S.heroAmount, { color: theme.tintText }]}>
            {formatMinor(trip.expenses.reduce((sum, e) => sum + e.amountMinor, 0), symbol)}
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

        {!canEdit && (
          <View style={[S.noticeBox, { backgroundColor: hexToRGBA(theme.tint, 0.08), borderColor: hexToRGBA(theme.tint, 0.2) }]}>
            <Ionicons name="eye-outline" size={14} color={theme.tint} />
            <Text style={[S.noticeText, { color: theme.tint }]}>
              {trip.name} belongs to someone else. You can see it and confirm payments made to you.
            </Text>
          </View>
        )}

        {/* ── People section ── */}
        <SectionHeader
          title="People"
          action={canEdit ? 'Add' : undefined}
          onAction={canEdit ? openAddMember : undefined}
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
            {trip.members.map((m, idx) => (
              <View key={m.id}>
                {idx > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                <View style={S.memberRow}>
                  <MemberAvatar name={m.name} photo={m.photo} color={avatarColor(idx)} />
                  <View style={S.memberBody}>
                    <Text style={[S.memberName, { color: theme.text }]}>{m.name}</Text>
                    {m.userId === myId && (
                      <Text style={[S.memberTag, { color: theme.secondaryText }]}>You</Text>
                    )}
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(m.id)}
                      style={[S.memberRemove, { backgroundColor: hexToRGBA(theme.expense, 0.1) }]}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={theme.expense} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Expenses section ── */}
        <SectionHeader
          title="Expenses"
          action={canEdit ? 'Add' : undefined}
          onAction={canEdit ? openAddExpense : undefined}
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
                          {getMemberName(exp.paidById)} paid ·{' '}
                          {exp.sharesMinor
                            ? `uneven, ${exp.participantIds.length} people`
                            : `${exp.participantIds.length}-way split`}
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
        {hasExpenses && canEdit && (
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
                const member    = memberIdx >= 0 ? trip.members[memberIdx] : null;
                const memberColor = memberIdx >= 0 ? avatarColor(memberIdx) : theme.tint;
                return (
                  <View key={b.id}>
                    {i > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                    <View style={S.balRow}>
                      <MemberAvatar name={b.name} photo={member?.photo} color={memberColor} />
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
                  All settled — everyone&apos;s even!
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
                        <MemberAvatar name={t.fromName} photo={trip.members[fromIdx]?.photo} color={fromColor} />
                        <View style={S.transferBody}>
                          <Text style={[S.transferFrom, { color: theme.text }]} numberOfLines={1}>{t.fromName}</Text>
                          <View style={S.transferArrowRow}>
                            <View style={[S.transferLine, { backgroundColor: theme.border }]} />
                            <Ionicons name="arrow-forward" size={12} color={theme.secondaryText} />
                          </View>
                          <Text style={[S.transferTo, { color: theme.secondaryText }]} numberOfLines={1}>{t.toName}</Text>
                        </View>
                        <MemberAvatar name={t.toName} photo={trip.members[toIdx]?.photo} color={toColor} />
                        <View style={[S.transferAmtWrap, { backgroundColor: hexToRGBA(theme.tint, 0.1) }]}>
                          <Text style={[S.transferAmt, { color: theme.tint }]}>{formatMinor(t.amountMinor, symbol)}</Text>
                        </View>
                      </View>
                      {canConfirm(t.toId) && (
                        <TouchableOpacity
                          style={[S.markPaidBtn, { borderColor: hexToRGBA(theme.income, 0.35) }]}
                          onPress={() => handleRecordSettlement(t.fromId, t.toId, t.amountMinor)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={theme.income} />
                          <Text style={[S.markPaidText, { color: theme.income }]}>Mark paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Payments already made */}
            {hasPayments && (
              <>
                <Text style={[S.subLabel, { color: theme.secondaryText }]}>PAYMENTS MADE</Text>
                <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {trip.settlements.map((s, i) => (
                    <View key={s.id}>
                      {i > 0 && <View style={[S.sep, { backgroundColor: theme.separator }]} />}
                      <View style={S.paymentRow}>
                        <View style={[S.paymentIcon, { backgroundColor: hexToRGBA(theme.income, 0.12) }]}>
                          <Ionicons name="arrow-forward" size={15} color={theme.income} />
                        </View>
                        <View style={S.paymentBody}>
                          <Text style={[S.paymentText, { color: theme.text }]} numberOfLines={1}>
                            {getMemberName(s.fromId)} → {getMemberName(s.toId)}
                          </Text>
                          <Text style={[S.paymentAmt, { color: theme.secondaryText }]}>
                            {formatMinor(s.amountMinor, symbol)}
                          </Text>
                        </View>
                        {canConfirm(s.toId) && (
                          <TouchableOpacity
                            onPress={() => handleUndoSettlement(s.id, s.fromId, s.toId, s.amountMinor)}
                            style={[S.undoBtn, { backgroundColor: hexToRGBA(theme.expense, 0.1) }]}
                            hitSlop={8}
                          >
                            <Ionicons name="arrow-undo-outline" size={14} color={theme.expense} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FAB: Add Expense ── */}
      {hasMembers && canEdit && (
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
            <Text style={[S.modalSub, { color: theme.secondaryText }]}>
              Anyone can be on a trip — they do not need an account.
            </Text>
            <TextInput
              style={[S.input, { backgroundColor: theme.cardAlt, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. Rahul, Priya"
              placeholderTextColor={theme.secondaryText}
              value={memberName}
              onChangeText={setMemberName}
              autoFocus
              maxLength={30}
              onSubmitEditing={() => addMember(memberName)}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[S.modalBtn, { backgroundColor: theme.tint, opacity: memberName.trim() && !addingMember ? 1 : 0.5 }]}
              onPress={() => addMember(memberName)}
              disabled={!memberName.trim() || addingMember}
            >
              {addingMember
                ? <ActivityIndicator size="small" color={theme.tintText} />
                : <Text style={[S.modalBtnText, { color: theme.tintText }]}>Add Person</Text>}
            </TouchableOpacity>

            {candidates.length > 0 && (
              <>
                <Text style={[S.candidateLabel, { color: theme.secondaryText }]}>FROM YOUR GROUP</Text>
                <ScrollView style={S.candidateList} keyboardShouldPersistTaps="handled">
                  {candidates.map(c => (
                    <TouchableOpacity
                      key={c.userId}
                      style={[S.candidateRow, { borderColor: theme.border }]}
                      onPress={() => addMember(c.name, c.userId)}
                      disabled={addingMember}
                      activeOpacity={0.7}
                    >
                      <MemberAvatar name={c.name} photo={c.photo} color={theme.tint} size={28} />
                      <Text style={[S.candidateName, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
                      <Ionicons name="add-circle-outline" size={18} color={theme.tint} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={S.modalCancel} onPress={() => setShowMember(false)} disabled={addingMember}>
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
              {splitMode === 'custom' ? (
                <View style={[S.amountRow, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
                  <Text style={[S.amountSymbol, { color: theme.text }]}>{symbol}</Text>
                  {/* Read-only in custom mode: the shares below are the total, and a second field
                      that could disagree with them is exactly what the minor-unit model removes. */}
                  <Text style={[S.amountInput, { color: customTotalMinor > 0 ? theme.text : theme.secondaryText }]}>
                    {fromMinorUnits(customTotalMinor).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ) : (
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
              )}

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
                <TouchableOpacity onPress={switchToCustom} hitSlop={8}>
                  <Text style={[S.selectAllText, { color: theme.tint }]}>
                    {splitMode === 'custom' ? 'Split evenly' : 'Enter amounts'}
                  </Text>
                </TouchableOpacity>
              </View>

              {splitMode === 'equal' ? (
                <>
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

                  {amountMinorEqual > 0 && expParts.size > 0 && (
                    <View style={[S.splitPreviewBox, { backgroundColor: hexToRGBA(theme.tint, 0.08), borderColor: hexToRGBA(theme.tint, 0.2) }]}>
                      <Ionicons name="calculator-outline" size={14} color={theme.tint} />
                      <Text style={[S.splitPreviewText, { color: theme.tint }]}>
                        {formatMinor(Math.floor(amountMinorEqual / expParts.size), symbol)} each
                        {amountMinorEqual % expParts.size !== 0 ? ' (1 paisa difference)' : ''}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {trip.members.map((m, idx) => {
                    const included = expParts.has(m.id);
                    const color    = avatarColor(idx);
                    return (
                      <View key={m.id} style={S.shareRow}>
                        <TouchableOpacity onPress={() => toggleParticipant(m.id)} hitSlop={6} style={S.shareWho}>
                          <View style={[S.chipAvatar, { backgroundColor: hexToRGBA(color, included ? 0.3 : 0.12) }]}>
                            {included
                              ? <Ionicons name="checkmark" size={12} color={color} />
                              : <Text style={[S.chipAvatarText, { color }]}>{m.name.charAt(0).toUpperCase()}</Text>}
                          </View>
                          <Text style={[S.shareName, { color: included ? theme.text : theme.secondaryText }]} numberOfLines={1}>
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                        <View style={[S.shareInputWrap, { backgroundColor: theme.cardAlt, borderColor: theme.border, opacity: included ? 1 : 0.4 }]}>
                          <Text style={[S.shareSymbol, { color: theme.secondaryText }]}>{symbol}</Text>
                          <TextInput
                            style={[S.shareInput, { color: theme.text }]}
                            placeholder="0"
                            placeholderTextColor={theme.secondaryText}
                            value={customAmounts[m.id] ?? ''}
                            editable={included}
                            onChangeText={t => setCustom(prev => ({ ...prev, [m.id]: t.replace(/[^0-9.]/g, '') }))}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                    );
                  })}
                  <View style={[S.splitPreviewBox, { backgroundColor: hexToRGBA(theme.tint, 0.08), borderColor: hexToRGBA(theme.tint, 0.2) }]}>
                    <Ionicons name="calculator-outline" size={14} color={theme.tint} />
                    <Text style={[S.splitPreviewText, { color: theme.tint }]}>
                      Total {formatMinor(customTotalMinor, symbol)} across {Object.keys(customShares).length}{' '}
                      {Object.keys(customShares).length === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                </>
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
  heroLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1, opacity: 0.75 },
  heroAmount:  { fontSize: 38, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  heroMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  heroPill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroPillText:{ fontSize: 12, fontWeight: '600' },
  heroDot:     { width: 3, height: 3, borderRadius: 2 },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },

  noticeBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Cards
  card:         { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep:          { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  emptyCard:    { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyCardText:{ fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Member rows
  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  memberBody:      { flex: 1, minWidth: 0 },
  memberName:      { fontSize: 15, fontWeight: '600' },
  memberTag:       { fontSize: 11, marginTop: 1 },
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
  transferBody:   { flex: 1, alignItems: 'center', gap: 2 },
  transferFrom:   { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  transferArrowRow:{ flexDirection: 'row', alignItems: 'center', gap: 2 },
  transferLine:   { flex: 1, height: 1 },
  transferTo:     { fontSize: 12, textAlign: 'center' },
  transferAmtWrap:{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  transferAmt:    { fontSize: 14, fontWeight: '800' },
  markPaidBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    marginHorizontal: 14, marginBottom: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  markPaidText:   { fontSize: 13, fontWeight: '700' },

  // Payments made
  paymentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  paymentIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  paymentBody: { flex: 1, minWidth: 0 },
  paymentText: { fontSize: 14, fontWeight: '600' },
  paymentAmt:  { fontSize: 12, marginTop: 2 },
  undoBtn:     { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

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

  candidateLabel: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
  candidateList:  { width: '100%', maxHeight: 160 },
  candidateRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  candidateName:  { flex: 1, fontSize: 14, fontWeight: '600' },

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

  // Per-person amount rows (uneven split)
  shareRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  shareWho:       { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  shareName:      { fontSize: 14, fontWeight: '600', flex: 1 },
  shareInputWrap: { flexDirection: 'row', alignItems: 'center', width: 130, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  shareSymbol:    { fontSize: 14, fontWeight: '700', marginRight: 6 },
  shareInput:     { flex: 1, fontSize: 15, fontWeight: '700', padding: 0 },

  splitHeadRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  selectAllText: { fontSize: 13, fontWeight: '700' },

  splitPreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  splitPreviewText:{ fontSize: 13, fontWeight: '600' },

  sheetBtn:      { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sheetBtnText:  { fontSize: 16, fontWeight: '700' },
  sheetCancel:   { paddingVertical: 14, alignItems: 'center' },
  sheetCancelText:{ fontSize: 14 },
});
