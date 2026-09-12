import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize, hairline } from '@/constants/tokens';
import { Touchable } from './Touchable';

/**
 * A pill. Three jobs, one shape: a filter that can be `selected`, a static badge (no `onPress`),
 * and a semantic tag (`tone`).
 *
 * Selection is where the accent goes (W2-29) — a selected chip is accent-filled, an unselected
 * one is outlined. Semantic tones use the amount colours at 12% so they read as tags, not buttons.
 */
export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  emoji?: string;
  tone?: 'neutral' | 'income' | 'expense' | 'warning';
  /** Solid background override (category colour). Text is contrast-computed. */
  color?: string;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({ label, selected = false, onPress, icon, emoji, tone = 'neutral', color, size = 'md', style, accessibilityLabel }: ChipProps) {
  const { theme } = useTheme();

  const toneColor = { neutral: theme.text, income: theme.income, expense: theme.expense, warning: theme.warning }[tone];
  const bg = color ? color
    : selected ? theme.tint
    : tone === 'neutral' ? 'transparent'
    : hexToRGBA(toneColor, 0.12);
  const fg = color ? getContrastText(color)
    : selected ? theme.tintText
    : tone === 'neutral' ? theme.text
    : toneColor;
  const border = !color && !selected && tone === 'neutral' ? theme.border : 'transparent';

  const body = (
    <View style={[styles.chip, size === 'sm' && styles.sm, { backgroundColor: bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : hairline }]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : icon ? <Ionicons name={icon} size={iconSize.sm} color={fg} /> : null}
      <Text style={[type.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );

  if (!onPress) return <View style={style} accessibilityLabel={accessibilityLabel ?? label}>{body}</View>;
  return (
    <Touchable
      onPress={onPress}
      haptic="selection"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[styles.touch, style]}
    >
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  touch: { borderRadius: radius.full, overflow: 'hidden' },
  chip:  { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.full, paddingHorizontal: space.md, minHeight: 36 },
  sm:    { paddingHorizontal: space.sm, minHeight: 28 },
  emoji: { ...type.label },
});
