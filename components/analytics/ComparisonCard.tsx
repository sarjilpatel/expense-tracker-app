import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { Currency } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { type, radius, space } from '@/constants/tokens';

interface Props {
  label: string;
  current: number;
  previous: number;
  color: string;
  icon: string;
}

export function ComparisonCard({ label, current, previous, color, icon }: Props) {
  const { theme } = useTheme();
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const isUp = change !== null && change > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.tint }]}>
        <Ionicons name={icon as any} size={18} color={theme.tintText} />
      </View>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Text style={[styles.value, { color }]}>{Currency.format(current)}</Text>
      {change !== null && (
        <View style={[styles.badge, { backgroundColor: theme.card }]}>
          <Ionicons name={isUp ? 'arrow-up' : 'arrow-down'} size={10} color={isUp ? color : theme.secondaryText} />
          <Text style={{ color: isUp ? color : theme.secondaryText, ...type.label }}>
            {Math.abs(change).toFixed(1)}%
          </Text>
        </View>
      )}
      <ThemedText style={styles.sub}>vs last month</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: 16,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
  },
  label: {
    ...type.overline,
    marginBottom: 4,
  },
  value: {
    ...type.bodyStrong,
    marginBottom: space.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sub: { ...type.label },
});
