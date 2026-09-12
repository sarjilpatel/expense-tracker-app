import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Button, type ButtonVariant } from './Button';

/**
 * Nothing here yet — and what to do about it. Replaces 29 ad-hoc empty states.
 *
 * An empty state always says three things: what would be here, why it is empty, and the one
 * action that fills it. A screen that has no action to offer (a filtered list with no matches)
 * passes no `action` and gets just the first two.
 */
export interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; variant?: ButtonVariant };
  /** Compact form for inside a card, rather than filling a screen. */
  compact?: boolean;
}

export function EmptyState({ icon, title, body, action, compact = false }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.full]}>
      <View style={[styles.iconWrap, compact && styles.iconWrapCompact, { backgroundColor: hexToRGBA(theme.tint, 0.1) }]}>
        <Ionicons name={icon} size={compact ? iconSize.lg : iconSize.xl} color={theme.tint} />
      </View>
      <Text style={[compact ? type.bodyStrong : type.heading, styles.title, { color: theme.text }]}>{title}</Text>
      {!!body && <Text style={[type.label, styles.body, { color: theme.secondaryText }]}>{body}</Text>}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'primary'}
          size={compact ? 'sm' : 'md'}
          block={false}
          style={styles.cta}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:           { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  full:           { flex: 1, paddingVertical: space.xxl * 2 },
  compact:        { paddingVertical: space.xl },
  iconWrap:       { width: 72, height: 72, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', marginBottom: space.lg },
  iconWrapCompact:{ width: 52, height: 52, marginBottom: space.md },
  title:          { textAlign: 'center' },
  body:           { textAlign: 'center', marginTop: space.xs, maxWidth: 300 },
  cta:            { marginTop: space.xl },
});
