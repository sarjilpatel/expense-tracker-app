import React from 'react';
import { Text, ActivityIndicator, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize, hairline } from '@/constants/tokens';
import { Touchable, type HapticKind } from './Touchable';

/**
 * The button. Four variants, two sizes, one loading state.
 *
 * `primary` is the only variant that paints the accent as a background — W2-29 restricts the
 * accent to the primary action, the active tab and selection, so a screen wanting a second filled
 * button should be asking itself which one is primary. `secondary` is outlined, `ghost` is text,
 * `danger` is for destructive confirms only.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. Default true for `md`, false for `sm`. */
  block?: boolean;
  haptic?: HapticKind;
  /** Optional semantic background for a primary action. Its foreground is derived for contrast. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon, iconRight = false,
  loading = false, disabled = false, block, haptic, color, style, accessibilityLabel,
}: ButtonProps) {
  const { theme } = useTheme();
  const stretch = block ?? size === 'md';

  const palette = {
    primary:   { bg: color ?? theme.tint, fg: color ? getContrastText(color) : theme.tintText, border: 'transparent' },
    secondary: { bg: 'transparent', fg: theme.text,      border: theme.border },
    ghost:     { bg: 'transparent', fg: theme.tint,      border: 'transparent' },
    danger:    { bg: theme.danger, fg: theme.expenseText, border: 'transparent' },
  }[variant];

  const content = (
    <>
      {loading
        ? <ActivityIndicator color={palette.fg} size="small" />
        : (
          <>
            {icon && !iconRight && <Ionicons name={icon} size={size === 'sm' ? iconSize.sm : iconSize.md} color={palette.fg} />}
            <Text style={[size === 'sm' ? type.label : type.bodyStrong, styles.label, { color: palette.fg }]} numberOfLines={1}>
              {label}
            </Text>
            {icon && iconRight && <Ionicons name={icon} size={size === 'sm' ? iconSize.sm : iconSize.md} color={palette.fg} />}
          </>
        )}
    </>
  );

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic ?? (variant === 'danger' ? 'medium' : 'light')}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: loading }}
      rippleColor={variant === 'primary' || variant === 'danger' ? hexToRGBA(palette.fg, 0.2) : undefined}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        stretch ? styles.block : styles.inline,
        { backgroundColor: palette.bg, borderColor: palette.border, borderWidth: variant === 'secondary' ? hairline : 0 },
        style,
      ]}
    >
      <View style={styles.inner} pointerEvents="none">{content}</View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base:   { borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  md:     { minHeight: 48, paddingHorizontal: space.lg },
  sm:     { minHeight: 36, paddingHorizontal: space.md },
  block:  { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  inner:  { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label:  { textAlign: 'center' },
});
