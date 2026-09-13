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
 *
 * First screen adopted onto the component layer (W2-31). It was 1,175 lines with 17 opacity-fade
 * touchables, two hand-rolled modals that could not be dismissed by tapping outside, and 113 raw
 * size and radius literals. Everything visual now comes from `@/components/ui`; what is left here
 * is the trip logic and the two pieces of layout that are genuinely this screen's own — a member
 * avatar and a "who pays whom" row.
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize, weight } from '@/constants/tokens';
import {
  Screen, Card, Row, Touchable, Button, Sheet, Field, Amount, EmptyState, SectionHeader, Chip, Skeleton,
  type SheetHandle,
} from '@/components/ui';
import {
  getTrip, addTripMember, removeTripMember, addTripExpense, updateTripExpense, deleteTripExpense,
  recordTripSettlement, deleteTripSettlement, getCurrentGroup,
  Trip, TripExpense, TripMember,
} from '@/src/services/dataService';
import { isLocalTrip, toSettlementInput } from '@/src/services/tripService';
import { computeSettlement, toMinorUnits, fromMinorUnits } from '@/src/utils/settlement';
import { avatarColor } from '@/constants/palettes';


import { reportError } from '@/src/utils/log';
/** Both halves of the service throw: the remote one a string, the local one an Error. */
const msg = (e: any, fallback: string) =>
  (typeof e === 'string' ? e : e?.message) || fallback;

/** A member's face: their photo when the account has one, their initial otherwise. */
function MemberAvatar({ name, photo, color, size = 38 }: {
  name: string; photo?: string | null; color: string; size?: number;
}) {
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={name} />;
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hexToRGBA(color, 0.18), justifyContent: 'center', alignItems: 'center' }}
      accessibilityLabel={name}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: weight.semibold, color }}>
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

  const myId = (authUser as any)?._id || (authUser as any)?.id || '';

  const [trip, setTrip]       = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-member sheet
  const memberSheet = useRef<SheetHandle>(null);
  const [memberName, setMemberName]     = useState('');
  const [candidates, setCandidates]     = useState<TripMember[]>([]);
  const [addingMember, setAddingMember] = useState(false);

  // Add/edit-expense sheet
  const expenseSheet = useRef<SheetHandle>(null);
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
      reportError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusRefresh(useCallback(() => { load(); }, [load]));

  // The trip's own currency, not the app preference — a Goa trip stays in rupees on a dollar account.
  const meta   = trip ? CURRENCY_META[trip.currency as CurrencyCode] : undefined;
  const money  = { symbol: meta?.symbol ?? '₹', locale: meta?.locale ?? 'en-IN' };

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
    memberSheet.current?.present();
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
      memberSheet.current?.dismiss();
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
    setEditingId(null);
    setExpDesc('');
    setExpAmount('');
    setExpPaidBy(trip.members[0].id);
    setExpParts(new Set(trip.members.map(m => m.id)));
    setSplitMode('equal');
    setCustom({});
    expenseSheet.current?.present();
  };

  const openEditExpense = (exp: TripExpense) => {
    if (!trip) return;
    if (!canEdit) return readOnly();
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
    expenseSheet.current?.present();
  };

  const toggleParticipant = (mid: string) => {
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
      expenseSheet.current?.dismiss();
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
   * Recording a payment belongs to whoever received it (W1-13). The trip owner stands in only for
   * a member who has no account to confirm from — never for one who does. This is the same rule
   * the server's `mayConfirm` applies; the button is hidden here so nobody is offered an action
   * that will be refused.
   */
  const canConfirm = useCallback((toId: string) => {
    if (!trip) return false;
    if (isLocalTrip(trip)) return true;
    const to = trip.members.find(m => m.id === toId);
    if (to?.userId) return to.userId === myId;
    return trip.ownerId === myId;
  }, [trip, myId]);

  const fmt = (minor: number) => `${money.symbol}${fromMinorUnits(minor).toLocaleString(money.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleRecordSettlement = (fromId: string, toId: string, amountMinor: number) => {
    if (!trip) return;
    Alert.alert(
      'Mark as paid?',
      `${getMemberName(fromId)} paid ${getMemberName(toId)} ${fmt(amountMinor)}.`,
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
      `${getMemberName(fromId)} will owe ${getMemberName(toId)} ${fmt(amountMinor)} again.`,
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
      <Screen title="Trip">
        <Skeleton.Group style={{ paddingTop: space.md }}>
          <Skeleton.Block height={120} round={radius.lg} />
          <Skeleton.Block height={14} width="30%" style={{ marginTop: space.lg }} />
          <Skeleton.Row />
          <Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen title="Trip">
        <EmptyState icon="airplane-outline" title="This trip no longer exists" body="It may have been deleted by its owner." />
      </Screen>
    );
  }

  const hasExpenses  = trip.expenses.length > 0;
  const hasMembers   = trip.members.length > 0;
  const hasPayments  = trip.settlements.length > 0;
  const allSettled   = settlement?.transfers.length === 0;
  const totalMinor   = trip.expenses.reduce((sum, e) => sum + e.amountMinor, 0);

  return (
    <Screen
      title={trip.name}
      right={hasMembers && canEdit ? (
        <Touchable onPress={openAddExpense} size={36} style={S.headerAdd} accessibilityLabel="Add expense" rippleBorderless>
          <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
        </Touchable>
      ) : undefined}
    >
      {/* ── Summary. Neutral surface, not an accent gradient — the accent is for actions (W2-29). ── */}
      <Card style={{ marginTop: space.sm }}>
        <Text style={[type.overline, { color: theme.secondaryText }]}>Total trip spend</Text>
        <Amount minor={totalMinor} role="display" symbol={money.symbol} locale={money.locale} style={{ marginTop: space.xs }} />
        <View style={S.metaRow}>
          <Chip size="sm" icon="people-outline" label={`${trip.members.length} ${trip.members.length === 1 ? 'person' : 'people'}`} />
          <Chip size="sm" icon="receipt-outline" label={`${trip.expenses.length} ${trip.expenses.length === 1 ? 'expense' : 'expenses'}`} />
          {hasExpenses && (
            <Chip
              size="sm"
              tone={allSettled ? 'income' : 'warning'}
              icon={allSettled ? 'checkmark-circle-outline' : 'time-outline'}
              label={allSettled ? 'All settled' : `${settlement!.transfers.length} to settle`}
            />
          )}
        </View>
      </Card>

      {!canEdit && (
        <Card tone="alt" style={{ marginTop: space.md }}>
          <View style={S.notice}>
            <Ionicons name="eye-outline" size={iconSize.sm} color={theme.secondaryText} />
            <Text style={[type.label, { color: theme.secondaryText, flex: 1 }]}>
              {trip.name} belongs to someone else. You can see it and confirm payments made to you.
            </Text>
          </View>
        </Card>
      )}

      {/* ── People ── */}
      <SectionHeader title="People" action={canEdit ? { label: 'Add', onPress: openAddMember } : undefined} />
      {!hasMembers ? (
        <Card><EmptyState compact icon="person-add-outline" title="Nobody here yet" body="Add the people who went on this trip." /></Card>
      ) : (
        <Card padded={false}>
          {trip.members.map((m, idx) => (
            <Row
              key={m.id}
              title={m.name}
              subtitle={(m.isSelf || m.userId === myId) ? 'You' : undefined}
              leading={<MemberAvatar name={m.name} photo={m.photo} color={avatarColor(idx)} />}
              last={idx === trip.members.length - 1}
              right={canEdit ? (
                <Touchable onPress={() => handleRemoveMember(m.id)} size={28} style={S.removeBtn} accessibilityLabel={`Remove ${m.name}`} rippleBorderless>
                  <Ionicons name="close" size={iconSize.sm} color={theme.expense} />
                </Touchable>
              ) : undefined}
            />
          ))}
        </Card>
      )}

      {/* ── Expenses ── */}
      <SectionHeader title="Expenses" action={canEdit ? { label: 'Add', onPress: openAddExpense } : undefined} />
      {!hasExpenses ? (
        <Card>
          <EmptyState
            compact icon="receipt-outline" title="No expenses yet"
            body={hasMembers ? 'Tap Add to log the first one.' : 'Add people first, then log expenses.'}
          />
        </Card>
      ) : (
        <Card padded={false}>
          {trip.expenses.map((exp, i) => (
            <Row
              key={exp.id}
              title={exp.description || 'Expense'}
              subtitle={`${getMemberName(exp.paidById)} paid · ${exp.sharesMinor ? `uneven, ${exp.participantIds.length} people` : `${exp.participantIds.length}-way split`}`}
              leading={<MemberAvatar name={getMemberName(exp.paidById)} color={avatarColor(getMemberIndex(exp.paidById))} />}
              right={<Amount minor={exp.amountMinor} symbol={money.symbol} locale={money.locale} />}
              onPress={canEdit ? () => openEditExpense(exp) : undefined}
              onLongPress={canEdit ? () => handleDeleteExpense(exp) : undefined}
              last={i === trip.expenses.length - 1}
            />
          ))}
        </Card>
      )}
      {hasExpenses && canEdit && (
        <Text style={[type.label, S.hint, { color: theme.secondaryText }]}>Tap to edit · hold to delete</Text>
      )}

      {/* ── Settle up ── */}
      {hasExpenses && (
        <>
          <SectionHeader title="Balances" />
          <Card padded={false}>
            {settlement!.balances.map((b, i) => {
              const owes = b.netMinor < 0;
              const even = b.netMinor === 0;
              const idx  = trip.members.findIndex(m => m.id === b.id);
              return (
                <Row
                  key={b.id}
                  title={b.name}
                  subtitle={`paid ${fmt(b.paidMinor)} · share ${fmt(b.shareMinor)}`}
                  leading={<MemberAvatar name={b.name} photo={idx >= 0 ? trip.members[idx]?.photo : null} color={idx >= 0 ? avatarColor(idx) : theme.tint} />}
                  right={even
                    ? <Chip size="sm" label="Even" />
                    : <Amount minor={Math.abs(b.netMinor)} kind={owes ? 'expense' : 'income'} symbol={money.symbol} locale={money.locale} />}
                  last={i === settlement!.balances.length - 1}
                />
              );
            })}
          </Card>

          <SectionHeader title="Who pays whom" />
          {allSettled ? (
            <Card><EmptyState compact icon="checkmark-circle-outline" title="All settled" body="Everyone is even." /></Card>
          ) : (
            <Card padded={false}>
              {settlement!.transfers.map((t, i) => {
                const fromIdx = trip.members.findIndex(m => m.id === t.fromId);
                const toIdx   = trip.members.findIndex(m => m.id === t.toId);
                return (
                  <View key={`${t.fromId}-${t.toId}-${i}`} style={[S.transfer, i < settlement!.transfers.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <MemberAvatar name={t.fromName} photo={trip.members[fromIdx]?.photo} color={fromIdx >= 0 ? avatarColor(fromIdx) : theme.expense} size={32} />
                    <View style={S.transferBody}>
                      <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                        {t.fromName} <Text style={{ color: theme.secondaryText }}>pays</Text> {t.toName}
                      </Text>
                      <Amount minor={t.amountMinor} role="label" symbol={money.symbol} locale={money.locale} color={theme.secondaryText} />
                    </View>
                    <MemberAvatar name={t.toName} photo={trip.members[toIdx]?.photo} color={toIdx >= 0 ? avatarColor(toIdx) : theme.income} size={32} />
                    {canConfirm(t.toId) && (
                      <Button size="sm" variant="secondary" label="Paid" icon="checkmark" onPress={() => handleRecordSettlement(t.fromId, t.toId, t.amountMinor)} />
                    )}
                  </View>
                );
              })}
            </Card>
          )}

          {hasPayments && (
            <>
              <SectionHeader title="Payments made" count={trip.settlements.length} />
              <Card padded={false}>
                {trip.settlements.map((s, i) => (
                  <Row
                    key={s.id}
                    title={`${getMemberName(s.fromId)} → ${getMemberName(s.toId)}`}
                    icon="arrow-forward"
                    iconBg={hexToRGBA(theme.income, 0.12)}
                    iconColor={theme.income}
                    right={(
                      <View style={S.paymentRight}>
                        <Amount minor={s.amountMinor} symbol={money.symbol} locale={money.locale} color={theme.secondaryText} role="label" />
                        {canConfirm(s.toId) && (
                          <Touchable onPress={() => handleUndoSettlement(s.id, s.fromId, s.toId, s.amountMinor)} size={28} style={S.removeBtn} accessibilityLabel="Undo payment" rippleBorderless>
                            <Ionicons name="arrow-undo-outline" size={iconSize.sm} color={theme.expense} />
                          </Touchable>
                        )}
                      </View>
                    )}
                    last={i === trip.settlements.length - 1}
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Add person ── */}
      <Sheet ref={memberSheet} title="Add person">
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.md }]}>
          Anyone can be on a trip — they do not need an account.
        </Text>
        <Field
          placeholder="e.g. Rahul, Priya"
          value={memberName}
          onChangeText={setMemberName}
          autoFocus
          maxLength={30}
          onSubmitEditing={() => addMember(memberName)}
          returnKeyType="done"
        />
        <Button label="Add person" onPress={() => addMember(memberName)} loading={addingMember} disabled={!memberName.trim()} style={{ marginTop: space.md }} />
        {candidates.length > 0 && (
          <>
            <SectionHeader title="From your group" />
            <Card padded={false}>
              {candidates.map((c, i) => (
                <Row
                  key={c.userId}
                  title={c.name}
                  leading={<MemberAvatar name={c.name} photo={c.photo} color={theme.tint} size={32} />}
                  right={<Ionicons name="add-circle-outline" size={iconSize.md} color={theme.tint} />}
                  onPress={() => addMember(c.name, c.userId)}
                  disabled={addingMember}
                  last={i === candidates.length - 1}
                />
              ))}
            </Card>
          </>
        )}
      </Sheet>

      {/* ── Add / edit expense ── */}
      <Sheet ref={expenseSheet} title={editingId ? 'Edit expense' : 'Add expense'} scroll snapPoints={['85%']}>
        {splitMode === 'custom' ? (
          // Read-only in custom mode: the shares below are the total, and a second field that could
          // disagree with them is exactly what the minor-unit model removes.
          <Field label="Amount" value={fmt(customTotalMinor)} editable={false} />
        ) : (
          <Field
            label="Amount"
            value={expAmount}
            onChangeText={t => setExpAmount(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            autoFocus={!editingId}
            right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{money.symbol}</Text>}
          />
        )}

        <Field
          label="Description (optional)"
          value={expDesc}
          onChangeText={setExpDesc}
          placeholder="e.g. Hotel, Dinner, Cab"
          maxLength={50}
          style={{ marginTop: space.md }}
        />

        <Text style={[type.label, S.fieldLabel, { color: theme.secondaryText }]}>Paid by</Text>
        <View style={S.chips}>
          {trip.members.map(m => (
            <Chip key={m.id} label={m.name} selected={expPaidBy === m.id} onPress={() => setExpPaidBy(m.id)} />
          ))}
        </View>

        <View style={S.splitHead}>
          <Text style={[type.label, { color: theme.secondaryText }]}>Split between</Text>
          <Touchable onPress={switchToCustom} haptic="selection" size={32} style={S.splitToggle} rippleBorderless>
            <Text style={[type.label, { color: theme.tint }]}>{splitMode === 'custom' ? 'Split evenly' : 'Enter amounts'}</Text>
          </Touchable>
        </View>

        {splitMode === 'equal' ? (
          <>
            <View style={S.chips}>
              {trip.members.map(m => (
                <Chip key={m.id} label={m.name} icon={expParts.has(m.id) ? 'checkmark' : undefined} selected={expParts.has(m.id)} onPress={() => toggleParticipant(m.id)} />
              ))}
            </View>
            {amountMinorEqual > 0 && expParts.size > 0 && (
              <Text style={[type.label, S.preview, { color: theme.secondaryText }]}>
                {fmt(Math.floor(amountMinorEqual / expParts.size))} each
                {amountMinorEqual % expParts.size !== 0 ? ' (1 paisa difference)' : ''}
              </Text>
            )}
          </>
        ) : (
          <>
            {trip.members.map(m => {
              const included = expParts.has(m.id);
              return (
                <View key={m.id} style={S.shareRow}>
                  <Chip label={m.name} icon={included ? 'checkmark' : undefined} selected={included} onPress={() => toggleParticipant(m.id)} style={S.shareChip} />
                  <Field
                    value={customAmounts[m.id] ?? ''}
                    editable={included}
                    onChangeText={t => setCustom(prev => ({ ...prev, [m.id]: t.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    accessibilityLabel={`${m.name}'s share`}
                    right={<Text style={[type.label, { color: theme.secondaryText }]}>{money.symbol}</Text>}
                    style={S.shareField}
                  />
                </View>
              );
            })}
            <Text style={[type.label, S.preview, { color: theme.secondaryText }]}>
              Total {fmt(customTotalMinor)} across {Object.keys(customShares).length} {Object.keys(customShares).length === 1 ? 'person' : 'people'}
            </Text>
          </>
        )}

        <Button
          label={editingId ? 'Save changes' : 'Add expense'}
          onPress={handleSaveExpense}
          loading={saving}
          disabled={!canSaveExpense}
          style={{ marginTop: space.xl }}
        />
      </Sheet>
    </Screen>
  );
}

// What is left is genuinely this screen's layout — nothing here is a colour, a size or a radius.
const S = StyleSheet.create({
  headerAdd:    { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  notice:       { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  removeBtn:    { width: 28, height: 28, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  hint:         { textAlign: 'center', marginTop: space.sm },
  transfer:     { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  transferBody: { flex: 1, gap: 2 },
  paymentRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fieldLabel:   { marginTop: space.lg, marginBottom: space.sm, marginLeft: space.xs },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  splitHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm, paddingLeft: space.xs },
  splitToggle:  { paddingHorizontal: space.xs, paddingVertical: 2 },
  preview:      { marginTop: space.md, marginLeft: space.xs },
  shareRow:     { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  shareChip:    { flexShrink: 1 },
  shareField:   { width: 140 },
});
