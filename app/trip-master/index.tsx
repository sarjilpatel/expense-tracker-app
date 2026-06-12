import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { getTrips, createTrip, deleteTrip, Trip } from '@/src/services/local/tripMasterService';
import { computeSettlement, formatMinor } from '@/src/utils/settlement';
import { hexToRGBA } from '@/constants/theme';

export default function TripMasterListScreen() {
  const { theme }   = useTheme();
  const { prefs }   = usePreferences();
  const { top }     = useSafeAreaInsets();

  const [trips, setTrips]           = useState<Trip[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [creating, setCreating]     = useState(false);

  const load = useCallback(async () => {
    try {
      setTrips(await getTrips());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const trip = await createTrip(newName, prefs.currency);
      setShowCreate(false);
      setNewName('');
      router.push(`/trip-master/${trip.id}` as any);
    } catch (e) {
      Alert.alert('Error', 'Could not create the trip. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (trip: Trip) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Trip',
      `Delete "${trip.name}" and all its expenses? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTrip(trip.id); load(); } },
      ],
    );
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNewName('');
    setShowCreate(true);
  };

  const symbolFor = (code: string) => CURRENCY_META[code as CurrencyCode]?.symbol ?? '₹';

  return (
    <ThemedView style={[S.container, { paddingTop: top }]}>

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: theme.text }]}>TripMaster</Text>
          {!loading && trips.length > 0 && (
            <Text style={[S.headerSub, { color: theme.secondaryText }]}>
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={openCreate}
          style={[S.addBtn, { backgroundColor: theme.tint }]}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color={theme.tintText} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color={theme.tint} size="large" />
        </View>
      ) : trips.length === 0 ? (
        <ScrollView contentContainerStyle={S.emptyScroll}>
          <LinearGradient
            colors={[hexToRGBA(theme.tint, 0.18), hexToRGBA(theme.tint, 0.04)]}
            style={S.emptyIconWrap}
          >
            <Ionicons name="people" size={44} color={theme.tint} />
          </LinearGradient>
          <Text style={[S.emptyTitle, { color: theme.text }]}>Split bills, settle up fast</Text>
          <Text style={[S.emptySub, { color: theme.secondaryText }]}>
            Add who paid for what on a trip or group outing, and TripMaster tells everyone exactly who owes whom — with the fewest payments.
          </Text>
          <TouchableOpacity
            style={[S.emptyBtn, { backgroundColor: theme.tint }]}
            onPress={openCreate}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={theme.tintText} />
            <Text style={[S.emptyBtnText, { color: theme.tintText }]}>Create your first trip</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          {trips.map(trip => {
            const { totalSpentMinor, transfers } = computeSettlement(trip.members, trip.expenses);
            const symbol = symbolFor(trip.currency);
            const settled = transfers.length === 0;
            const hasExpenses = trip.expenses.length > 0;

            return (
              <TouchableOpacity
                key={trip.id}
                style={[S.tripCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/trip-master/${trip.id}` as any);
                }}
                onLongPress={() => handleDelete(trip)}
                activeOpacity={0.72}
              >
                <View style={[S.tripIconBox, { backgroundColor: hexToRGBA(theme.tint, 0.14) }]}>
                  <Ionicons name="airplane-outline" size={22} color={theme.tint} />
                </View>

                <View style={S.tripBody}>
                  <Text style={[S.tripName, { color: theme.text }]} numberOfLines={1}>{trip.name}</Text>
                  <Text style={[S.tripMeta, { color: theme.secondaryText }]}>
                    {trip.members.length} {trip.members.length === 1 ? 'person' : 'people'}
                    {hasExpenses ? ` · ${trip.expenses.length} ${trip.expenses.length === 1 ? 'expense' : 'expenses'}` : ''}
                  </Text>
                </View>

                <View style={S.tripRight}>
                  {hasExpenses && (
                    <Text style={[S.tripTotal, { color: theme.text }]}>{formatMinor(totalSpentMinor, symbol)}</Text>
                  )}
                  {hasExpenses && (
                    <View style={[S.statusPill, { backgroundColor: settled ? hexToRGBA(theme.income, 0.15) : hexToRGBA(theme.warning, 0.15) }]}>
                      <View style={[S.statusDot, { backgroundColor: settled ? theme.income : theme.warning }]} />
                      <Text style={[S.statusText, { color: settled ? theme.income : theme.warning }]}>
                        {settled ? 'Settled' : `${transfers.length} left`}
                      </Text>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={15} color={theme.border} />
              </TouchableOpacity>
            );
          })}

          <Text style={[S.hint, { color: theme.secondaryText }]}>Long-press a trip to delete it.</Text>
          <View style={{ height: 48 }} />
        </ScrollView>
      )}

      {/* ── Create trip modal ── */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={S.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[S.modalCard, { backgroundColor: theme.card }]}>
            <View style={[S.modalIconWrap, { backgroundColor: hexToRGBA(theme.tint, 0.14) }]}>
              <Ionicons name="airplane-outline" size={28} color={theme.tint} />
            </View>
            <Text style={[S.modalTitle, { color: theme.text }]}>New Trip</Text>
            <Text style={[S.modalSub, { color: theme.secondaryText }]}>
              Give it a name — like "Goa Trip" or "Flat Groceries".
            </Text>
            <TextInput
              style={[S.input, { backgroundColor: theme.cardAlt, color: theme.text, borderColor: theme.border }]}
              placeholder="Trip name"
              placeholderTextColor={theme.secondaryText}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={50}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[S.modalBtn, { backgroundColor: theme.tint, opacity: newName.trim() && !creating ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating
                ? <ActivityIndicator size="small" color={theme.tintText} />
                : <Text style={[S.modalBtnText, { color: theme.tintText }]}>Create Trip</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={S.modalCancel} onPress={() => setShowCreate(false)} disabled={creating}>
              <Text style={[S.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ThemedView>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, gap: 8,
  },
  iconBtn:      { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addBtn:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800' },
  headerSub:    { fontSize: 12, marginTop: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  // Empty state
  emptyScroll:  { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: 60 },
  emptyIconWrap:{ width: 100, height: 100, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  emptySub:     { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 32, maxWidth: 300 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16 },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },

  // Trip card
  tripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10,
  },
  tripIconBox:  { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  tripBody:     { flex: 1, minWidth: 0 },
  tripName:     { fontSize: 15, fontWeight: '700' },
  tripMeta:     { fontSize: 12, marginTop: 3 },
  tripRight:    { alignItems: 'flex-end', gap: 5 },
  tripTotal:    { fontSize: 15, fontWeight: '800' },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  hint: { fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Modal
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { width: '100%', borderRadius: 26, padding: 24, alignItems: 'center' },
  modalIconWrap:{ width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitle:   { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  modalSub:     { fontSize: 13, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  input:        { width: '100%', height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, marginBottom: 14 },
  modalBtn:     { width: '100%', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
  modalCancel:  { paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 14 },
});
