import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Modal, Alert, Platform, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Currency } from '@/constants/theme';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { getCurrentGroup } from '@/src/services/groupApi';
import {
  getSplits, createSplit, settleSplit, deleteSplit,
  Split, SplitMember,
} from '@/src/services/splitService';

// ── Net balance helpers ───────────────────────────────────────────────────────

type Balance = { from: SplitMember; to: SplitMember; amount: number };

function computeNetBalances(splits: Split[], myId: string): Balance[] {
  // owes[from_id][to_id] = net amount from owes to
  const owes: Record<string, Record<string, number>> = {};
  const userMap: Record<string, SplitMember> = {};

  for (const split of splits) {
    const payer = split.paidBy;
    userMap[payer._id] = payer;

    for (const entry of split.splits) {
      const debtor = entry.userId;
      userMap[debtor._id] = debtor;

      if (entry.settled || entry.userId._id === payer._id) continue;

      if (!owes[debtor._id]) owes[debtor._id] = {};
      owes[debtor._id][payer._id] = (owes[debtor._id][payer._id] || 0) + entry.amount;
    }
  }

  // Simplify: if A owes B 500 and B owes A 200 → A owes B 300
  const result: Balance[] = [];
  const seen = new Set<string>();
  for (const fromId of Object.keys(owes)) {
    for (const toId of Object.keys(owes[fromId])) {
      const key = [fromId, toId].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);

      const a2b = owes[fromId]?.[toId] || 0;
      const b2a = owes[toId]?.[fromId] || 0;
      const net = a2b - b2a;

      if (net > 0.01) {
        result.push({ from: userMap[fromId], to: userMap[toId], amount: net });
      } else if (net < -0.01) {
        result.push({ from: userMap[toId], to: userMap[fromId], amount: -net });
      }
    }
  }

  // Sort: current user first
  return result.sort((a, b) =>
    (a.from._id === myId || a.to._id === myId) ? -1
    : (b.from._id === myId || b.to._id === myId) ? 1 : 0
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 32, color }: { user: SplitMember; size?: number; color: string }) {
  return user.profilePhoto ? (
    <Image source={{ uri: user.profilePhoto }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color }}>{user.name?.charAt(0)}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
type FormMember = { user: SplitMember; amount: string; included: boolean };

export default function SplitsScreen() {
  const { theme }   = useTheme();
  const { user: authUser, isGuest } = useAuth();
  const { top, bottom } = useSafeAreaInsets();

  const [splits,    setSplits]    = useState<Split[]>([]);
  const [members,   setMembers]   = useState<SplitMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  // Form state
  const [title,     setTitle]     = useState('');
  const [total,     setTotal]     = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [formMembers, setFormMembers] = useState<FormMember[]>([]);
  const [formError, setFormError] = useState('');

  const myId = (authUser as any)?._id || (authUser as any)?.id || '';

  const fetchData = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      const [splitsData, groupData] = await Promise.all([getSplits(), getCurrentGroup()]);
      setSplits(splitsData);
      const mems: SplitMember[] = (groupData?.members || []).map((m: any) => ({
        _id:          m._id,
        name:         m.name,
        profilePhoto: m.profilePhoto,
      }));
      setMembers(mems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  // Distribute amounts equally among included members
  const recalcEqual = (mems: FormMember[], totalAmt: number): FormMember[] => {
    const included = mems.filter(m => m.included).length;
    if (!included) return mems;
    const each = (totalAmt / included).toFixed(2);
    return mems.map(m => ({ ...m, amount: m.included ? each : '0' }));
  };

  const openModal = () => {
    const t = parseFloat(total) || 0;
    const initial: FormMember[] = members.map(m => ({
      user: m, included: true,
      amount: members.length > 0 ? (t / members.length).toFixed(2) : '0',
    }));
    setFormMembers(initial);
    setTitle(''); setTotal(''); setSplitType('equal'); setFormError('');
    setModalOpen(true);
  };

  const onTotalChange = (val: string) => {
    setTotal(val);
    if (splitType === 'equal') {
      const t = parseFloat(val) || 0;
      setFormMembers(m => recalcEqual(m, t));
    }
  };

  const toggleMember = (idx: number) => {
    setFormMembers(m => {
      const updated = m.map((x, i) => i === idx ? { ...x, included: !x.included } : x);
      if (splitType === 'equal') return recalcEqual(updated, parseFloat(total) || 0);
      return updated;
    });
  };

  const onAmountChange = (idx: number, val: string) => {
    setFormMembers(m => m.map((x, i) => i === idx ? { ...x, amount: val } : x));
  };

  const handleCreate = async () => {
    setFormError('');
    if (!title.trim())             { setFormError('Enter a description.'); return; }
    const t = parseFloat(total);
    if (!t || t <= 0)              { setFormError('Enter a valid total amount.'); return; }
    const included = formMembers.filter(m => m.included);
    if (included.length < 2)       { setFormError('Select at least 2 members.'); return; }
    const sum = included.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    if (Math.abs(sum - t) > 0.01)  { setFormError(`Amounts must sum to ₹${t}. Current: ₹${sum.toFixed(2)}`); return; }

    setSaving(true);
    try {
      const created = await createSplit({
        title: title.trim(),
        totalAmount: t,
        splits: included.map(m => ({ userId: m.user._id, amount: parseFloat(m.amount) })),
      });
      setSplits(s => [created, ...s]);
      setModalOpen(false);
    } catch (e: any) {
      setFormError(e?.msg || 'Could not create split.');
    } finally {
      setSaving(false);
    }
  };

  const handleSettle = async (split: Split, userId: string) => {
    try {
      const updated = await settleSplit(split._id, userId);
      setSplits(s => s.map(x => x._id === updated._id ? updated : x));
    } catch (e: any) {
      Alert.alert('Error', e?.msg || 'Could not settle.');
    }
  };

  const handleDelete = (split: Split) => {
    Alert.alert('Delete Split', `Delete "${split.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSplit(split._id);
            setSplits(s => s.filter(x => x._id !== split._id));
          } catch (e: any) {
            Alert.alert('Error', e?.msg || 'Could not delete.');
          }
        },
      },
    ]);
  };

  const balances = computeNetBalances(splits, myId);

  if (isGuest) {
    return (
      <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={S.headerTitle}>Expense Splits</ThemedText>
          <View style={{ width: 32 }} />
        </View>
        <View style={S.empty}>
          <Ionicons name="people-outline" size={64} color={theme.icon} />
          <ThemedText style={S.emptyTitle}>Sign in to split expenses</ThemedText>
          <ThemedText style={S.emptyBody}>Expense splits are shared with your group members.</ThemedText>
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
        <ThemedText type="title" style={S.headerTitle}>Expense Splits</ThemedText>
        <TouchableOpacity
          onPress={openModal}
          style={[S.addBtn, { backgroundColor: theme.tint }]}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonLoader type="card" /><SkeletonLoader type="card" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.list, { paddingBottom: bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Net balance summary */}
          {balances.length > 0 && (
            <Animated.View entering={FadeInDown.duration(280)} style={[S.summaryCard, { backgroundColor: theme.card }]}>
              <View style={S.summaryHeader}>
                <Ionicons name="analytics-outline" size={16} color={theme.tint} />
                <ThemedText style={S.summaryTitle}>Net Balances</ThemedText>
              </View>
              {balances.map((b, i) => {
                const isMyDebt   = b.from._id === myId;
                const isMyCredit = b.to._id   === myId;
                const color = isMyDebt ? theme.expense : isMyCredit ? theme.income : theme.text;
                return (
                  <View key={i} style={S.balanceRow}>
                    <Avatar user={b.from} size={28} color={theme.tint} />
                    <Text style={[S.balanceText, { color }]} numberOfLines={1}>
                      {' '}{b.from._id === myId ? 'You' : b.from.name} owe{b.from._id === myId ? '' : 's'}{' '}
                      {b.to._id   === myId ? 'you' : b.to.name}{' '}
                      <Text style={{ fontWeight: '800' }}>{Currency.format(b.amount)}</Text>
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          )}

          {/* Splits list */}
          {splits.length === 0 ? (
            <View style={S.empty}>
              <Ionicons name="git-branch-outline" size={56} color={theme.icon} />
              <ThemedText style={S.emptyTitle}>No splits yet</ThemedText>
              <ThemedText style={S.emptyBody}>Track shared expenses with your group members.</ThemedText>
              <TouchableOpacity style={[S.emptyBtn, { backgroundColor: theme.tint }]} onPress={openModal}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={S.emptyBtnText}>New Split</Text>
              </TouchableOpacity>
            </View>
          ) : (
            splits.map((split, i) => {
              const isOpen = expanded === split._id;
              const unsettled = split.splits.filter(s => !s.settled && s.userId._id !== split.paidBy._id);
              const allDone = unsettled.length === 0;
              return (
                <Animated.View
                  key={split._id}
                  entering={FadeInDown.delay(i * 60).duration(260)}
                  style={[S.card, { backgroundColor: theme.card }]}
                >
                  <TouchableOpacity onPress={() => setExpanded(isOpen ? null : split._id)} activeOpacity={0.8}>
                    <View style={S.cardTop}>
                      <View style={[S.iconBox, { backgroundColor: theme.tint + '22' }]}>
                        <Ionicons name="git-branch-outline" size={20} color={theme.tint} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[S.splitTitle, { color: theme.text }]}>{split.title}</Text>
                        <View style={S.metaRow}>
                          <Avatar user={split.paidBy} size={16} color={theme.tint} />
                          <Text style={[S.meta, { color: theme.secondaryText }]}>
                            {' '}{split.paidBy._id === myId ? 'You' : split.paidBy.name} paid {Currency.format(split.totalAmount)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {allDone
                          ? <View style={[S.badge, { backgroundColor: theme.income + '22' }]}><Text style={[S.badgeTxt, { color: theme.income }]}>Settled</Text></View>
                          : <View style={[S.badge, { backgroundColor: theme.expense + '22' }]}><Text style={[S.badgeTxt, { color: theme.expense }]}>{unsettled.length} pending</Text></View>
                        }
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.secondaryText} />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={S.entriesWrap}>
                      <View style={[S.divider, { backgroundColor: theme.border }]} />
                      {split.splits.map((entry, j) => {
                        const isMe = entry.userId._id === myId;
                        const isPayer = entry.userId._id === split.paidBy._id;
                        const canSettle = !entry.settled && !isPayer && split.paidBy._id === myId;
                        return (
                          <View key={j} style={S.entryRow}>
                            <Avatar user={entry.userId} size={28} color={theme.tint} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[S.entryName, { color: theme.text }]}>
                                {isMe ? 'You' : entry.userId.name}
                              </Text>
                              <Text style={[S.entryAmt, { color: theme.secondaryText }]}>
                                {Currency.format(entry.amount)}
                              </Text>
                            </View>
                            {entry.settled ? (
                              <View style={[S.settledBadge, { backgroundColor: theme.income + '22' }]}>
                                <Ionicons name="checkmark" size={12} color={theme.income} />
                                <Text style={[S.settledTxt, { color: theme.income }]}>Paid</Text>
                              </View>
                            ) : canSettle ? (
                              <TouchableOpacity
                                style={[S.settleBtn, { backgroundColor: theme.tint }]}
                                onPress={() => handleSettle(split, entry.userId._id)}
                              >
                                <Text style={S.settleBtnTxt}>Mark Paid</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={[S.pendingBadge, { backgroundColor: theme.expense + '22' }]}>
                                <Text style={[S.pendingTxt, { color: theme.expense }]}>Pending</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      <View style={S.cardFooter}>
                        <Text style={[S.dateText, { color: theme.secondaryText }]}>
                          {new Date(split.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => handleDelete(split)}>
                          <Ionicons name="trash-outline" size={16} color={theme.secondaryText} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── New Split Modal ── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[S.modal, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
            <View style={S.modalHeader}>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={[S.modalCancel, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[S.modalTitle2, { color: theme.text }]}>New Split</Text>
              <TouchableOpacity onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={theme.tint} /> : (
                  <Text style={[S.modalSave, { color: theme.tint }]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 18 }}>
              {formError ? (
                <View style={[S.errorBanner, { backgroundColor: theme.expense + '22' }]}>
                  <Text style={{ color: theme.expense, fontSize: 13 }}>{formError}</Text>
                </View>
              ) : null}

              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>DESCRIPTION</Text>
                <TextInput
                  style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={title} onChangeText={setTitle}
                  placeholder="e.g. Dinner, Movie tickets"
                  placeholderTextColor={theme.secondaryText}
                  autoFocus maxLength={80}
                />
              </View>

              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>TOTAL AMOUNT ({Currency.symbol})</Text>
                <TextInput
                  style={[S.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={total} onChangeText={onTotalChange}
                  keyboardType="numeric" placeholder="0"
                  placeholderTextColor={theme.secondaryText}
                />
              </View>

              {/* Split type toggle */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>SPLIT TYPE</Text>
                <View style={[S.toggleRow, { backgroundColor: theme.card }]}>
                  {(['equal', 'custom'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[S.toggleBtn, splitType === t && { backgroundColor: theme.tint }]}
                      onPress={() => {
                        setSplitType(t);
                        if (t === 'equal') setFormMembers(m => recalcEqual(m, parseFloat(total) || 0));
                      }}
                    >
                      <Text style={[S.toggleTxt, { color: splitType === t ? '#FFF' : theme.secondaryText }]}>
                        {t === 'equal' ? 'Equal' : 'Custom'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Members */}
              <View>
                <Text style={[S.label, { color: theme.secondaryText }]}>MEMBERS</Text>
                <View style={{ gap: 10, marginTop: 4 }}>
                  {formMembers.map((fm, idx) => (
                    <View key={fm.user._id} style={[S.memberRow, { backgroundColor: theme.card }]}>
                      <TouchableOpacity onPress={() => toggleMember(idx)} style={S.checkbox}>
                        <View style={[S.check, { borderColor: theme.tint, backgroundColor: fm.included ? theme.tint : 'transparent' }]}>
                          {fm.included && <Ionicons name="checkmark" size={13} color="#FFF" />}
                        </View>
                      </TouchableOpacity>
                      <Avatar user={fm.user} size={30} color={theme.tint} />
                      <Text style={[S.memberName, { color: theme.text }]}>
                        {fm.user._id === myId ? 'You' : fm.user.name}
                      </Text>
                      <TextInput
                        style={[S.amtInput, { color: fm.included ? theme.text : theme.secondaryText, borderColor: theme.border }]}
                        value={fm.amount}
                        onChangeText={v => { if (splitType === 'custom') onAmountChange(idx, v); }}
                        keyboardType="numeric"
                        editable={splitType === 'custom' && fm.included}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800' },
  addBtn:       { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  list:         { paddingHorizontal: 16, paddingTop: 4, gap: 14 },

  summaryCard:  { borderRadius: 20, padding: 16, gap: 10 },
  summaryHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  summaryTitle: { fontSize: 13, fontWeight: '700' },
  balanceRow:   { flexDirection: 'row', alignItems: 'center' },
  balanceText:  { fontSize: 14, flex: 1 },

  card:         { borderRadius: 20, padding: 16, overflow: 'hidden' },
  cardTop:      { flexDirection: 'row', alignItems: 'center' },
  iconBox:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitTitle:   { fontSize: 15, fontWeight: '700' },
  metaRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  meta:         { fontSize: 12 },
  badge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' },

  divider:      { height: 1, marginVertical: 12 },
  entriesWrap:  {},
  entryRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  entryName:    { fontSize: 14, fontWeight: '600' },
  entryAmt:     { fontSize: 12, marginTop: 1 },
  settledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  settledTxt:   { fontSize: 11, fontWeight: '700' },
  settleBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  settleBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pendingTxt:   { fontSize: 11, fontWeight: '600' },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  dateText:     { fontSize: 11 },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12, paddingVertical: 60 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, marginTop: 8 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  modal:        { flex: 1 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  modalTitle2:  { fontSize: 16, fontWeight: '800' },
  modalCancel:  { fontSize: 15 },
  modalSave:    { fontSize: 15, fontWeight: '700' },
  label:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input:        { padding: 14, borderRadius: 14, fontSize: 15, borderWidth: 1 },
  errorBanner:  { padding: 12, borderRadius: 12 },
  toggleRow:    { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  toggleBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  toggleTxt:    { fontSize: 13, fontWeight: '700' },
  memberRow:    { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, gap: 10 },
  checkbox:     {},
  check:        { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  memberName:   { flex: 1, fontSize: 14, fontWeight: '600' },
  amtInput:     { width: 80, textAlign: 'right', fontSize: 14, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 2 },
});
