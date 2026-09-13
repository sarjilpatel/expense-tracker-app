/**
 * Trips — the list.
 *
 * This is what the old `splits.tsx` and the local-only TripMaster became (W2-28). There is one
 * feature now, reached the same way signed in or out: `dataService` picks the device or the server
 * and both answer with the same `Trip`, so nothing below this line knows or cares which it got.
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { getTrips, createTrip, deleteTrip, Trip } from '@/src/services/dataService';
import { toSettlementInput } from '@/src/services/tripService';
import { computeSettlement } from '@/src/utils/settlement';
import { space, type, icon as iconSize, radius } from '@/constants/tokens';
import {
  Screen, Card, Row, Touchable, Button, Sheet, Field, Amount, EmptyState, Chip, Skeleton,
  type SheetHandle,
} from '@/components/ui';

export default function TripsListScreen() {
  const { theme }   = useTheme();
  const { prefs }   = usePreferences();
  const { isGuest } = useAuth();

  const [trips, setTrips]       = useState<Trip[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState('');
  const createSheet = useRef<SheetHandle>(null);

  const load = useCallback(async () => {
    try {
      setTrips(await getTrips());
      setError('');
    } catch (e: any) {
      // A guest read cannot fail, so this is always the network — say so rather than showing an
      // empty list, which reads as "you have no trips".
      setError(typeof e === 'string' ? e : e?.message || 'Could not load your trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const trip = await createTrip({ name: newName.trim(), currency: prefs.currency });
      createSheet.current?.dismiss();
      setNewName('');
      router.push(`/trips/${trip.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', typeof e === 'string' ? e : e?.message || 'Could not create the trip.');
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
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try { await deleteTrip(trip.id); load(); }
            catch (e: any) { Alert.alert('Error', typeof e === 'string' ? e : e?.message || 'Could not delete.'); }
          },
        },
      ],
    );
  };

  const openCreate = () => {
    setNewName('');
    createSheet.current?.present();
  };

  const moneyFor = (code: string) => {
    const meta = CURRENCY_META[code as CurrencyCode];
    return { symbol: meta?.symbol ?? '₹', locale: meta?.locale ?? 'en-IN' };
  };

  const addButton = (
    <Touchable onPress={openCreate} size={36} style={S.headerAdd} accessibilityLabel="New trip" rippleBorderless>
      <Ionicons name="add" size={iconSize.lg} color={theme.tint} />
    </Touchable>
  );

  const body = loading ? (
    <Skeleton.Group style={{ paddingTop: space.sm }}>
      <Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
    </Skeleton.Group>
  ) : error ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn't load your trips"
      body={error}
      action={{ label: 'Try again', onPress: () => { setLoading(true); load(); }, variant: 'secondary' }}
    />
  ) : trips.length === 0 ? (
    <>
      <EmptyState
        icon="people"
        title="Split bills, settle up fast"
        body="Add who paid for what on a trip or group outing, and we work out exactly who owes whom — with the fewest payments."
        action={{ label: 'Create your first trip', onPress: openCreate }}
      />
      {isGuest && (
        <Text style={[type.label, S.guestNote, { color: theme.secondaryText }]}>
          Trips work offline. Sign in later and yours come with you.
        </Text>
      )}
    </>
  ) : (
    <>
      <Card padded={false} style={{ marginTop: space.sm }}>
        {trips.map((trip, i) => {
          const { totalSpentMinor, transfers } = computeSettlement(trip.members, toSettlementInput(trip));
          const money = moneyFor(trip.currency);
          const settled = transfers.length === 0;
          const hasExpenses = trip.expenses.length > 0;
          const people = `${trip.members.length} ${trip.members.length === 1 ? 'person' : 'people'}`;
          const expenses = hasExpenses ? ` · ${trip.expenses.length} ${trip.expenses.length === 1 ? 'expense' : 'expenses'}` : '';
          return (
            <Row
              key={trip.id}
              icon="airplane-outline"
              title={trip.name}
              subtitle={people + expenses}
              onPress={() => router.push(`/trips/${trip.id}` as any)}
              onLongPress={() => handleDelete(trip)}
              chevron
              last={i === trips.length - 1}
              right={hasExpenses ? (
                <View style={S.tripRight}>
                  <Amount minor={totalSpentMinor} symbol={money.symbol} locale={money.locale} />
                  <Chip size="sm" tone={settled ? 'income' : 'warning'} label={settled ? 'Settled' : `${transfers.length} left`} />
                </View>
              ) : undefined}
            />
          );
        })}
      </Card>
      <Text style={[type.label, S.hint, { color: theme.secondaryText }]}>Hold a trip to delete it.</Text>
    </>
  );

  return (
    <Screen title="Trips" right={addButton} scroll={!loading && !error && trips.length > 0}>
      {body}

      <Sheet ref={createSheet} title="New trip">
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.md }]}>
          Give it a name — like “Goa Trip” or “Flat Groceries”.
        </Text>
        <Field
          placeholder="Trip name"
          value={newName}
          onChangeText={setNewName}
          autoFocus
          maxLength={50}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <Button label="Create trip" onPress={handleCreate} loading={creating} disabled={!newName.trim()} style={{ marginTop: space.md }} />
      </Sheet>
    </Screen>
  );
}

const S = StyleSheet.create({
  headerAdd: { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  tripRight: { alignItems: 'flex-end', gap: space.xs },
  hint:      { textAlign: 'center', marginTop: space.md },
  guestNote: { textAlign: 'center', marginTop: -space.xl, paddingHorizontal: space.xl },
});
