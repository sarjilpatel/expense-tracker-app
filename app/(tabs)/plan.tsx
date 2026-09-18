/**
 * Plan — savings goals and shared trips in one place.
 *
 * These three were the app's subject matter and sat two taps behind a gear icon. This tab is a
 * hub, not a fourth copy of each screen: it previews the two forward-looking tools and hands off
 * to the screen that owns each one (`/goals`, `/trips`). Budgeting lives in Insights.
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { useTheme } from '@/src/context/ThemeContext';
import { getGoals, getTrips, type Goal, type Trip } from '@/src/services/dataService';
import { toSettlementInput } from '@/src/services/tripService';
import { computeSettlement } from '@/src/utils/settlement';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { formatAmount } from '@/src/utils/money';
import { space, radius, type } from '@/constants/tokens';
import { Screen, Card, Row, Amount, Chip, SectionHeader, Skeleton } from '@/components/ui';

import { reportError } from '@/src/utils/log';
const PREVIEW = 3;

export default function PlanScreen() {
  const { theme }   = useTheme();

  const [loading, setLoading]   = useState(true);
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [trips, setTrips]       = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [goalData, tripData] = await Promise.all([
        getGoals().catch(() => [] as Goal[]),
        getTrips().catch(() => [] as Trip[]),
      ]);

      setGoals(goalData || []);
      setTrips(tripData || []);
      loaded.current = true;
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Skeleton on the first load only; a return to the tab refreshes silently (W2-13).
  useFocusRefresh(useCallback(() => { if (!loaded.current) setLoading(true); fetchData(); }, [fetchData]));

  const moneyFor = (code: string) => {
    const meta = CURRENCY_META[code as CurrencyCode];
    return { symbol: meta?.symbol ?? '₹', locale: meta?.locale ?? 'en-IN' };
  };

  if (loading) {
    return (
      <Screen title="Plan" onBack={false}>
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={120} /><Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="Plan" onBack={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }}>
      {/* ── Goals ── */}
      <SectionHeader title="Savings goals" style={{ marginTop: 0 }} count={goals.length || undefined} action={goals.length > 0 ? { label: 'See all', onPress: () => router.push('/goals') } : undefined} />
      {goals.length === 0 ? (
        <Card padded={false}>
          <Row icon="flag-outline" title="Create a savings goal" subtitle="Give your savings a target" onPress={() => router.push('/goals')} last />
        </Card>
      ) : (
        <Card padded={false}>
          {goals.slice(0, PREVIEW).map((g, i, arr) => {
            const p = g.targetAmount > 0 ? Math.min(g.savedAmount / g.targetAmount, 1) : 0;
            return (
              <Row
                key={g._id}
                icon={g.icon as any}
                iconBg={g.color}
                title={g.name}
                subtitle={`${formatAmount(g.savedAmount)} of ${formatAmount(g.targetAmount)}`}
                right={<Chip size="sm" tone={p >= 1 ? 'income' : undefined} label={`${Math.round(p * 100)}%`} />}
                onPress={() => router.push('/goals')}
                chevron={false}
                last={i === arr.length - 1}
              />
            );
          })}
        </Card>
      )}

      {/* ── Trips ── */}
      <SectionHeader title="Trips & splits" count={trips.length || undefined} action={trips.length > 0 ? { label: 'See all', onPress: () => router.push('/trips' as any) } : undefined} />
      {trips.length === 0 ? (
        <Card padded={false}>
          <Row icon="people-outline" title="Start a trip or split" subtitle="Track shared expenses with others" onPress={() => router.push('/trips' as any)} last />
        </Card>
      ) : (
        <Card padded={false}>
          {trips.slice(0, PREVIEW).map((trip, i, arr) => {
            const { totalSpentMinor, transfers } = computeSettlement(trip.members, toSettlementInput(trip));
            const money = moneyFor(trip.currency);
            const settled = transfers.length === 0;
            return (
              <Row
                key={trip.id}
                icon="airplane-outline"
                title={trip.name}
                subtitle={`${trip.members.length} ${trip.members.length === 1 ? 'person' : 'people'}`}
                onPress={() => router.push(`/trips/${trip.id}` as any)}
                last={i === arr.length - 1}
                right={trip.expenses.length > 0 ? (
                  <View style={S.tripRight}>
                    <Amount minor={totalSpentMinor} symbol={money.symbol} locale={money.locale} />
                    <Chip size="sm" tone={settled ? 'income' : 'warning'} label={settled ? 'Settled' : `${transfers.length} left`} />
                  </View>
                ) : undefined}
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  tripRight: { alignItems: 'flex-end', gap: space.xs },
});
