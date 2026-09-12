import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from '@/components/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePreferences } from '@/src/context/PreferencesContext';
import { space, type, radius } from '@/constants/tokens';

interface Props {
  transactions: any[];
  theme: any;
  t: (key: string) => string;
  onTransactionPress: (item: any) => void;
}

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function NoteView({ transactions, theme, t, onTransactionPress }: Props) {
  const { formatAmount } = usePreferences();

  const noteTransactions = useMemo(
    () => transactions.filter(tx => !!tx.note?.trim()).sort(
      (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    ),
    [transactions]
  );

  const stats = useMemo(() => {
    const total = noteTransactions.length;
    const income = noteTransactions.filter(tx => tx.type === 'income').length;
    const expense = noteTransactions.filter(tx => tx.type === 'expense').length;
    return { total, income, expense };
  }, [noteTransactions]);

  if (noteTransactions.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
          <Ionicons name="document-text-outline" size={28} color={theme.tint} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No notes yet</Text>
        <Text style={[styles.emptySub, { color: theme.secondaryText }]}>
          Add a note to any transaction and it will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Notes</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            Transactions with notes attached
          </Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.countValue, { color: theme.text }]}>{stats.total}</Text>
          <Text style={[styles.countLabel, { color: theme.secondaryText }]}>items</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: theme.secondaryText }]}>Noted tx</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: theme.income + '0F' }]}>
          <Text style={[styles.statValue, { color: theme.income }]}>{stats.income}</Text>
          <Text style={[styles.statLabel, { color: theme.secondaryText }]}>Income</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: theme.expense + '0F' }]}>
          <Text style={[styles.statValue, { color: theme.expense }]}>{stats.expense}</Text>
          <Text style={[styles.statLabel, { color: theme.secondaryText }]}>Expense</Text>
        </View>
      </View>

      <View style={styles.list}>
        {noteTransactions.map((tx, index) => {
          const isExpense = tx.type === 'expense';
          return (
            <Touchable
              key={tx._id || index}
              onPress={() => onTransactionPress(tx)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={[styles.colorBar, { backgroundColor: isExpense ? theme.expense : theme.income }]} />
              <View style={styles.body}>
                <View style={styles.topRow}>
                  <Text style={[styles.category, { color: theme.secondaryText }]} numberOfLines={1}>
                    {t(tx.category)}
                  </Text>
                  <Text style={[styles.amount, { color: isExpense ? theme.expense : theme.income }]}>
                    {(isExpense ? '-' : '+') + formatAmount(tx.amount)}
                  </Text>
                </View>
                <Text style={[styles.note, { color: theme.text }]} numberOfLines={2}>
                  {tx.note}
                </Text>
                <Text style={[styles.date, { color: theme.secondaryText }]} numberOfLines={1}>
                  {formatDate(new Date(tx.date || tx.createdAt))}
                </Text>
              </View>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: space.md },
  title: { ...type.heading },
  subtitle: { ...type.label, marginTop: 4 },
  countPill: {
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minWidth: 64,
  },
  countValue: { ...type.bodyStrong },
  countLabel: { ...type.label, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: space.md },
  statChip: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { ...type.bodyStrong },
  statLabel: { ...type.label, marginTop: 2 },
  list: { gap: space.md },
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  body: { flex: 1, padding: space.lg, gap: space.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  category: { flex: 1, ...type.overline },
  amount: { ...type.label },
  note: { ...type.label },
  date: { ...type.label },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.lg,
  },
  emptyTitle: { ...type.heading },
  emptySub: { ...type.label, textAlign: 'center', marginTop: space.sm },
});
