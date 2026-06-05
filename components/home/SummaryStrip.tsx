import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Currency } from '@/constants/theme';

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
}

export function SummaryStrip({ income, expense, balance, incomeLabel, expenseLabel, cardColor, borderColor, secondaryText, incomeColor, expenseColor, style }: Props) {
  return (
    <Animated.View style={[styles.strip, { backgroundColor: cardColor }, style]}>
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>{incomeLabel}</Text>
        <Text style={[styles.val, { color: incomeColor }]}>{Currency.format(income)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: borderColor }]} />
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>{expenseLabel}</Text>
        <Text style={[styles.val, { color: expenseColor }]}>{Currency.format(expense)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: borderColor }]} />
      <View style={styles.col}>
        <Text style={[styles.label, { color: secondaryText }]}>Total</Text>
        <Text style={[styles.val, { color: balance >= 0 ? incomeColor : expenseColor }]}>
          {Currency.format(balance)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  val: {
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: '55%',
    alignSelf: 'center',
  },
});
