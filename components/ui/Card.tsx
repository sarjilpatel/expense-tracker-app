import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, hairline } from '@/constants/tokens';
import { Touchable, type TouchableProps } from './Touchable';

/**
 * A raised surface. Replaces the 16 bespoke `card:` styles.
 *
 * Elevation is a surface tone plus a hairline edge, not a shadow (W2-20/W2-22): shadows vanish on
 * dark backgrounds and the 36 `shadowColor`/`elevation` declarations across the app were doing
 * nothing there. `padded` is on by default; a card that holds rows (which carry their own inset)
 * passes `padded={false}` and lets the rows meet the edge.
 */
export interface CardProps {
  children?: React.ReactNode;
  padded?: boolean;
  /** Make the whole card tappable. */
  onPress?: TouchableProps['onPress'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** `alt` is the second tone, for a card sitting on another card. */
  tone?: 'default' | 'alt';
}

export function Card({ children, padded = true, onPress, accessibilityLabel, style, tone = 'default' }: CardProps) {
  const { theme } = useTheme();
  const surface = [
    styles.card,
    { backgroundColor: tone === 'alt' ? theme.cardAlt : theme.card, borderColor: theme.border },
    padded && styles.padded,
    style,
  ];

  if (onPress) {
    return (
      <Touchable onPress={onPress} accessibilityLabel={accessibilityLabel} style={surface}>
        {children}
      </Touchable>
    );
  }
  return <View style={surface}>{children}</View>;
}

const styles = StyleSheet.create({
  card:   { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  padded: { padding: space.lg },
});
