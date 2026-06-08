import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

interface Props {
  income: number;
  expense: number;
  balance: number;
  incomeLabel: string;
  expenseLabel: string;
  cardColor: string;
  borderColor: string;
  secondaryText: string;
  incomeColor: string;
  expenseColor: string;
  style?: any;
  totalColor?: string;
  periodLabel?: string;
  formatAmount?: (n: number) => string;
}

export function SummaryStrip({
  income,
  expense,
  balance,
  incomeLabel,
  expenseLabel,
  cardColor,
  borderColor,
  secondaryText,
  incomeColor,
  expenseColor,
  totalColor = '#FFF',
  style,
  periodLabel,
  formatAmount,
}: Props) {
  const formatVal = formatAmount ?? ((val: number) =>
    (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );

  return (
    <Animated.View style={[styles.strip, { backgroundColor: cardColor, borderColor: borderColor }, style]}>
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>{incomeLabel}</Text>
        <Text style={[styles.val, { color: incomeColor }]}>{formatVal(income)}</Text>
      </View>
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>{expenseLabel}</Text>
        <Text style={[styles.val, { color: expenseColor }]}>{formatVal(expense)}</Text>
      </View>
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>Total</Text>
        <Text style={[styles.val, { color: totalColor }]}>{formatVal(balance)}</Text>
      </View>
      {!!periodLabel && (
        <View style={styles.periodRow}>
          <Text style={[styles.periodLabel, { color: secondaryText }]}>{periodLabel}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    marginHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 15,
    fontWeight: '800',
  },
  periodRow: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
