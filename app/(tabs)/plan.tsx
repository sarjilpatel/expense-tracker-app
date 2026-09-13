/**
 * Plan — budgets, goals and trips in one place (W2-27).
 *
 * These three were the app's subject matter and sat two taps behind a gear icon. This tab is a
 * hub, not a fourth copy of each screen: it shows the state of each and hands off to the screen
 * that already owns it (`/budget`, `/goals`, `/trips`).
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getBudgets, getAllTransactions, getGoals, getTrips, type Goal, type Trip } from '@/src/services/dataService';
import { toSettlementInput } from '@/src/services/tripService';
import { computeSettlement } from '@/src/utils/settlement';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { getPeriodRange, getCalendarMonthsForPeriod, filterByPeriod } from '@/src/utils/dateUtils';
import { formatAmount } from '@/src/utils/money';
import { space, radius, type } from '@/constants/tokens';
import { Screen, Card, Row, Amount, Chip, EmptyState, SectionHeader, Skeleton } from '@/components/ui';

import { reportError } from '@/src/utils/log';
const PREVIEW = 3;

export default function PlanScreen() {
  const { theme }   = useTheme();
  const { prefs }   = usePreferences();

  const [loading, setLoading]   = useState(true);
  const [budget, setBudget]     = useState<any | null>(null);
  const [spent, setSpent]       = useState(0);
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [trips, setTrips]       = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const fetchData = useCallback(async () => {
    try {
      // Same period arithmetic as `/budget`, so the number here never disagrees with that screen.
      const monthlyStart = prefs.monthlyStart;
      const txPromise = monthlyStart > 1
        ? Promise.all(getCalendarMonthsForPeriod(month, year, monthlyStart).map(m => getAllTransactions(m.month, m.year)))
            .then(results => {
              const { start, end } = getPeriodRange(month, year, monthlyStart);
              return filterByPeriod((results as any[][]).flat(), start, end);
            })
        : getAllTransactions(month, year);

      const [txData, budgetData, goalData, tripData] = await Promise.all([
        txPromise,
        getBudgets(month, year).catch(() => []),
        getGoals().catch(() => [] as Goal[]),
        getTrips().catch(() => [] as Trip[]),
      ]);

      const overall = (budgetData || []).find((b: any) => !b.category) ?? null;
      setBudget(overall);
      setSpent((txData || []).filter((tx: any) => tx.type === 'expense').reduce((s: number, tx: any) => s + tx.amount, 0));
      setGoals(goalData || []);
      setTrips(tripData || []);
      loaded.current = true;
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, prefs.monthlyStart]);

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

  const pct  = budget ? Math.min(spent / budget.amount, 1) : 0;
  const over = budget ? spent > budget.amount : false;
  const left = budget ? budget.amount - spent : 0;

  return (
    <Screen title="Plan" onBack={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }}>
      {/* ── Budget ── */}
      <SectionHeader title="Budget" style={{ marginTop: 0 }} action={{ label: budget ? 'Manage' : 'Set up', onPress: () => router.push(budget ? '/budget' : '/add-budget') }} />
      {budget ? (
        <Card onPress={() => router.push('/budget')} accessibilityLabel={`Monthly budget, ${formatAmount(spent)} of ${formatAmount(budget.amount)} spent`}>
          <View style={S.between}>
            <Text style={[type.label, { color: theme.secondaryText }]}>Spent this month</Text>
            <Text style={[type.label, { color: theme.secondaryText }]}>of {formatAmount(budget.amount)}</Text>
          </View>
          <Amount value={spent} role="display" kind={over ? 'expense' : 'neutral'} style={{ marginTop: space.xs }} />
          <View style={[S.track, { backgroundColor: theme.cardAlt }]}>
            <View style={[S.fill, { width: `${pct * 100}%`, backgroundColor: over ? theme.expense : theme.tint }]} />
          </View>
          <Text style={[type.label, { color: over ? theme.expense : theme.secondaryText }]}>
            {over ? `${formatAmount(spent - budget.amount)} over budget` : `${formatAmount(left)} left`}
          </Text>
        </Card>
      ) : (
        <EmptyState compact icon="wallet-outline" title="No budget yet" body="Set a monthly limit and watch it as you spend." action={{ label: 'Set a budget', onPress: () => router.push('/add-budget'), variant: 'secondary' }} />
      )}

      {/* ── Goals ── */}
      <SectionHeader title="Savings goals" count={goals.length || undefined} action={goals.length > 0 ? { label: 'See all', onPress: () => router.push('/goals') } : undefined} />
      {goals.length === 0 ? (
        <EmptyState compact icon="flag-outline" title="No goals yet" body="Put a number on what you are saving for." action={{ label: 'Add a goal', onPress: () => router.push('/goals'), variant: 'secondary' }} />
      ) : (
        <Card padded={false}>
          {goals.slice(0, PREVIEW).map((g, i, arr) => {
            const p = g.targetAmount > 0 ? Math.min(g.savedAmount / g.targetAmount, 1) : 0;
            return (
              <Row
                key={g._id}
                emoji={g.icon}
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
        <EmptyState compact icon="people-outline" title="No trips yet" body="Split any bill and see exactly who owes whom." action={{ label: 'Create a trip', onPress: () => router.push('/trips' as any), variant: 'secondary' }} />
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
  between:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track:     { height: 8, borderRadius: radius.full, overflow: 'hidden', marginTop: space.md, marginBottom: space.sm },
  fill:      { height: '100%', borderRadius: radius.full },
  tripRight: { alignItems: 'flex-end', gap: space.xs },
});
