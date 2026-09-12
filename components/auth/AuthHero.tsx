import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';

/**
 * The top of every auth screen: a glyph, a title, a line of copy. Five screens drew this five
 * ways (a ₹ in an accent square, a mail icon in a circle, ...). One copy, and the glyph sits on a
 * tint of the accent rather than the accent itself (W2-29).
 */
export function AuthHero({ icon = 'wallet-outline', title, subtitle }: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={S.hero}>
      <View style={[S.logo, { backgroundColor: hexToRGBA(theme.tint, 0.12) }]}>
        <Ionicons name={icon} size={iconSize.xl} color={theme.tint} />
      </View>
      <Text style={[type.title, S.center, { color: theme.text }]} accessibilityRole="header">{title}</Text>
      {!!subtitle && <Text style={[type.label, S.center, { color: theme.secondaryText }]}>{subtitle}</Text>}
    </View>
  );
}

const S = StyleSheet.create({
  hero:   { alignItems: 'center', gap: space.sm, paddingTop: space.xxl, paddingBottom: space.xl },
  logo:   { width: 72, height: 72, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', marginBottom: space.sm },
  center: { textAlign: 'center', paddingHorizontal: space.lg },
});
