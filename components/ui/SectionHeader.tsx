import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type } from '@/constants/tokens';
import { Touchable } from './Touchable';

/**
 * The ALL-CAPS section label, with an optional action on the right ("See all", "Edit").
 *
 * The app wrote this label in at least eight places with eight slightly different sizes, weights
 * and letter-spacings. It is the `overline` role, and only the `overline` role.
 */
export interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  /** Trailing count badge, e.g. the number of rows below. */
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, action, count, style }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[type.overline, { color: theme.secondaryText }]} accessibilityRole="header">
        {title}{count !== undefined ? `  ·  ${count}` : ''}
      </Text>
      {action && (
        <Touchable onPress={action.onPress} haptic="selection" size={32} style={styles.action} rippleBorderless>
          <Text style={[type.label, { color: theme.tint }]}>{action.label}</Text>
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs },
  action: { paddingHorizontal: space.xs, paddingVertical: 2 },
});
