import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, type RefreshControlProps } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Touchable, Amount, EmptyState } from '@/components/ui';
import { space, type, radius } from '@/constants/tokens';

interface Props {
  transactions: any[];
  theme: any;
  t: (key: string) => string;
  onTransactionPress: (item: any) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentContainerStyle?: any;
}

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Every transaction that carries a note. This is the one home view whose row count is the
 * transaction count rather than a fixed number of weeks or days, so it is a `FlashList` in its
 * own right (W2-16) — the caller renders it in place of the ScrollView, not inside one.
 */
export function NoteView({ transactions, theme, t, onTransactionPress, refreshControl, contentContainerStyle }: Props) {
  const noteTransactions = useMemo(
    () => transactions.filter(tx => !!tx.note?.trim()).sort(
      (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    ),
    [transactions]
  );

  const stats = useMemo(() => {
    const total = noteTransactions.length;
    const income = noteTransactions.filter(tx => tx.type === 'income').length;
    return { total, income, expense: total - income };
  }, [noteTransactions]);

  const renderItem: ListRenderItem<any> = useCallback(({ item: tx }) => {
    const isExpense = tx.type === 'expense';
    return (
      <Touchable
        onPress={() => onTransactionPress(tx)}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        accessibilityLabel={`${t(tx.category)}, ${tx.note}`}
      >
        <View style={[styles.colorBar, { backgroundColor: isExpense ? theme.expense : theme.income }]} />
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={[styles.category, { color: theme.secondaryText }]} numberOfLines={1}>
              {t(tx.category)}
            </Text>
            <Amount value={tx.amount} kind={isExpense ? 'expense' : 'income'} role="label" />
          </View>
          <Text style={[type.body, { color: theme.text }]} numberOfLines={2}>{tx.note}</Text>
          <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={1}>
            {formatDate(new Date(tx.date || tx.createdAt))}
          </Text>
        </View>
      </Touchable>
    );
  }, [theme, t, onTransactionPress]);

  const header = noteTransactions.length === 0 ? null : (
    <View style={styles.statsRow}>
      <View style={[styles.statChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[type.bodyStrong, { color: theme.text }]}>{stats.total}</Text>
        <Text style={[type.label, { color: theme.secondaryText }]}>Noted</Text>
      </View>
      <View style={[styles.statChip, { backgroundColor: theme.income + '0F' }]}>
        <Text style={[type.bodyStrong, { color: theme.income }]}>{stats.income}</Text>
        <Text style={[type.label, { color: theme.secondaryText }]}>Income</Text>
      </View>
      <View style={[styles.statChip, { backgroundColor: theme.expense + '0F' }]}>
        <Text style={[type.bodyStrong, { color: theme.expense }]}>{stats.expense}</Text>
        <Text style={[type.label, { color: theme.secondaryText }]}>Expense</Text>
      </View>
    </View>
  );

  return (
    <FlashList
      data={noteTransactions}
      keyExtractor={(tx, i) => tx._id || String(i)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        <EmptyState icon="document-text-outline" title="No notes yet" body="Add a note to any transaction and it will appear here." />
      }
      refreshControl={refreshControl}
      contentContainerStyle={contentContainerStyle ?? styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const Separator = () => <View style={{ height: space.md }} />;

const styles = StyleSheet.create({
  content:  { paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: 108 },
  statsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  statChip: { flex: 1, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.md, borderWidth: StyleSheet.hairlineWidth },
  card:     { flexDirection: 'row', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  colorBar: { width: 4 },
  body:     { flex: 1, padding: space.lg, gap: space.sm },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  category: { flex: 1, ...type.overline },
});
