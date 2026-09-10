import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Currency } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

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
          <Text style={{ color: isUp ? color : theme.secondaryText, fontSize: 10, fontWeight: '700' }}>
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
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sub: {
    fontSize: 10,
  },
});
