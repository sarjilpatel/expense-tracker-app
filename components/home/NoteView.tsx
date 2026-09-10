import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '@/src/context/PreferencesContext';

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
            <TouchableOpacity
              key={tx._id || index}
              activeOpacity={0.75}
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
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4 },
  countPill: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minWidth: 64,
  },
  countValue: { fontSize: 16, fontWeight: '800' },
  countLabel: { fontSize: 10, marginTop: 2, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  category: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: { fontSize: 13, fontWeight: '800' },
  note: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  date: { fontSize: 11 },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
