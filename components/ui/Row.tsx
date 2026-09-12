import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Touchable } from './Touchable';

/**
 * The list row: leading glyph, title, optional subtitle, trailing slot, optional chevron.
 *
 * Replaces the row pattern repeated across settings, categories, accounts, groups and trips —
 * the same four boxes drawn a dozen slightly different ways. Rows stack inside a
 * `<Card padded={false}>`; pass `last` on the final one to drop its separator.
 *
 * The leading box takes either an Ionicons name or an emoji. Its background defaults to the
 * accent at 12% — a tint, not the accent itself, so a page of rows is not a page of accent (W2-29).
 */
export interface RowProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  emoji?: string;
  /** Background for the leading box. A solid colour gets a contrast-computed glyph. */
  iconBg?: string;
  iconColor?: string;
  /** Right-hand content: an `Amount`, a `Chip`, a switch, a count. */
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Show a trailing chevron. Defaults to `!!onPress && !right`. */
  chevron?: boolean;
  danger?: boolean;
  last?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Row({
  title, subtitle, icon, emoji, iconBg, iconColor, right, onPress, onLongPress,
  chevron, danger = false, last = false, disabled = false, accessibilityLabel, style,
}: RowProps) {
  const { theme } = useTheme();
  const showChevron = chevron ?? (!!onPress && !right);
  const bg   = iconBg ?? hexToRGBA(danger ? theme.danger : theme.tint, 0.12);
  const glyph = iconColor ?? (iconBg ? getContrastText(iconBg) : danger ? theme.danger : theme.tint);
  const titleColor = danger ? theme.danger : theme.text;

  const body = (
    <View style={[styles.row, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {(icon || emoji) && (
        <View style={[styles.lead, { backgroundColor: bg }]}>
          {emoji
            ? <Text style={styles.emoji}>{emoji}</Text>
            : <Ionicons name={icon!} size={iconSize.md} color={glyph} />}
        </View>
      )}
      <View style={styles.mid}>
        <Text style={[type.body, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right !== undefined && <View style={styles.right}>{right}</View>}
      {showChevron && <Ionicons name="chevron-forward" size={iconSize.sm} color={theme.secondaryText} />}
    </View>
  );

  if (!onPress && !onLongPress) return <View style={style}>{body}</View>;
  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={style}
    >
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, paddingVertical: space.sm },
  lead:  { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 20 },
  mid:   { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
});
