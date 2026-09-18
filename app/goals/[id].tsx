import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { useTheme } from '@/src/context/ThemeContext';
import { getGoals, getGoalContributions, type Goal } from '@/src/services/dataService';
import { Currency, hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, Amount, Button, EmptyState, Skeleton } from '@/components/ui';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [goals, contributions] = await Promise.all([getGoals(), getGoalContributions(id)]);
    setGoal(goals.find(item => item._id === id) ?? null);
    setTransactions(contributions);
    setLoading(false);
  }, [id]);

  useFocusRefresh(load);

  if (loading) return <Screen title="Goal"><Skeleton.Group><Skeleton.Block height={180} round={radius.lg} /><Skeleton.Row /></Skeleton.Group></Screen>;
  if (!goal) return <Screen title="Goal"><EmptyState icon="flag-outline" title="Goal not found" action={{ label: 'Back to goals', onPress: () => router.replace('/goals') }} /></Screen>;

  const contributed = transactions.reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const saved = goal.savedAmount + contributed;
  const remaining = Math.max(0, goal.targetAmount - saved);
  const progress = Math.min(saved / goal.targetAmount, 1);
  const addContribution = () => router.push({ pathname: '/add-transaction', params: { prefillGoalId: goal._id, prefillType: 'savings' } });

  return (
    <Screen title={goal.name}>
      <Card style={{ marginTop: space.sm }}>
        <View style={S.top}>
          <View style={[S.icon, { backgroundColor: hexToRGBA(goal.color, 0.14) }]}><Ionicons name={goal.icon as any} size={iconSize.lg} color={goal.color} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: theme.secondaryText }]}>Saved toward this goal</Text>
            <Amount value={saved} role="display" />
          </View>
        </View>
        <View style={[S.track, { backgroundColor: theme.cardAlt }]}><View style={[S.fill, { width: `${progress * 100}%`, backgroundColor: goal.color }]} /></View>
        <Text style={[type.label, { color: theme.secondaryText }]}>{remaining > 0 ? `${Currency.format(remaining)} remaining` : 'Goal reached'}</Text>
      </Card>

      <View style={S.section}><Text style={[type.title, { color: theme.text }]}>Contributions</Text><Text style={[type.label, { color: theme.secondaryText }]}>{transactions.length}</Text></View>
      {transactions.length === 0 ? (
        <EmptyState compact icon="wallet-outline" title="No contributions yet" body="Add a transaction to start funding this goal." action={{ label: 'Add contribution', onPress: addContribution }} />
      ) : (
        <>
          <Card padded={false}>
            {transactions.map((tx, index) => (
              <Row
                key={tx._id}
                icon="arrow-down-circle-outline"
                iconColor={goal.color}
                title={tx.note || tx.category || 'Goal contribution'}
                subtitle={new Date(tx.date || tx.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                right={<Amount value={tx.amount} kind="income" />}
                last={index === transactions.length - 1}
              />
            ))}
          </Card>
          <Button label="Add contribution" icon="add" onPress={addContribution} style={{ marginTop: space.xl }} />
        </>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden', marginTop: space.lg, marginBottom: space.sm },
  fill: { height: '100%', borderRadius: radius.full },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.sm },
});
