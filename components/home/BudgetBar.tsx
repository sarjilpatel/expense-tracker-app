import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/themed-text';
import { Currency } from '@/constants/theme';
import { radius, space, type } from '@/constants/tokens';

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

  const barColor = progress >= 100 ? expenseColor : secondaryText;

  return (
    <>
      <View style={[styles.bar, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: 1 }]}>
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
          style={[
            styles.alert,
            {
              backgroundColor: progress >= 100 ? `${expenseColor}15` : `${secondaryText}15`,
              borderColor: progress >= 100 ? expenseColor : secondaryText,
              borderWidth: 1,
            }
          ]}
        >
          <Ionicons
            name={progress >= 100 ? 'warning' : 'alert-circle-outline'}
            size={14}
            color={progress >= 100 ? expenseColor : secondaryText}
          />
          <ThemedText style={[styles.alertText, { color: progress >= 100 ? expenseColor : secondaryText }]}>
            {progress >= 100 ? exceededText : warningText}
          </ThemedText>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 12,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: 12,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  label: { ...type.label },
  track: {
    height: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
  alert: {
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  alertText: {
    ...type.label,
    flex: 1,
  },
});
