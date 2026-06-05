import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Currency } from '@/constants/theme';

interface Props {
  budget: any;
  spent: number;
  progress: number;
  cardColor: string;
  borderColor: string;
  secondaryText: string;
  expenseColor: string;
  warningText: string;
  exceededText: string;
}

export function BudgetBar({ budget, spent, progress, cardColor, borderColor, secondaryText, expenseColor, warningText, exceededText }: Props) {
  if (!budget) return null;

  const barColor = progress >= 100 ? expenseColor : progress >= 80 ? '#F59E0B' : '#34D399';

  return (
    <>
      <View style={[styles.bar, { backgroundColor: cardColor }]}>
        <View style={styles.meta}>
          <Text style={[styles.label, { color: secondaryText }]}>Budget · {Math.round(progress)}%</Text>
          <Text style={[styles.label, { color: progress >= 100 ? expenseColor : secondaryText }]}>
            {Currency.format(Math.max(budget.amount - spent, 0))} left
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: borderColor }]}>
          <View style={[styles.fill, { width: `${progress}%` as any, backgroundColor: barColor }]} />
        </View>
      </View>

      {progress >= 80 && (
        <Animated.View
          entering={FadeInDown}
          style={[styles.alert, { backgroundColor: progress >= 100 ? `${expenseColor}12` : '#FEF3C712' }]}
        >
          <Ionicons
            name={progress >= 100 ? 'warning' : 'alert-circle-outline'}
            size={14}
            color={progress >= 100 ? expenseColor : '#D97706'}
          />
          <ThemedText style={[styles.alertText, { color: progress >= 100 ? expenseColor : '#D97706' }]}>
            {progress >= 100 ? exceededText : warningText}
          </ThemedText>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 20,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  alert: {
    marginHorizontal: 20,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
  },
  alertText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
});
