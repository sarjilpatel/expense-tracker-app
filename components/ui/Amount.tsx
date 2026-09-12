import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { type, tabular, type TypeRole } from '@/constants/tokens';
import { formatAmount, formatMinorAmount, type AmountKind, type FormatAmountOptions } from '@/src/utils/money';

/**
 * A money value. Sign, tabular figures and the semantic colour, in one place.
 *
 * Every money value in the app goes through this so that W2-24 (the sign, not just the colour)
 * and W2-21 (tabular figures, so columns of amounts line up) cannot be forgotten at a call site.
 * `kind` decides both the sign and the colour; the colour is reinforcement, never the only cue.
 */
export interface AmountProps extends FormatAmountOptions {
  /** Major units (rupees). Use `minor` instead for the trip model's integer paise. */
  value?: number;
  minor?: number;
  kind?: AmountKind;
  /** Type role. `bodyStrong` is the row default; `display` is the balance hero. */
  role?: TypeRole;
  /** Override the semantic colour (e.g. `theme.text` for a total in a neutral card). */
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function Amount({
  value, minor, kind = 'neutral', role = 'bodyStrong', color, numberOfLines = 1, style, accessibilityLabel,
  ...format
}: AmountProps) {
  const { theme } = useTheme();
  const text = minor !== undefined
    ? formatMinorAmount(minor, kind, format)
    : formatAmount(value ?? 0, kind, format);

  const semantic = kind === 'income' ? theme.income : kind === 'expense' ? theme.expense : theme.text;

  return (
    <Text
      style={[type[role], tabular, { color: color ?? semantic }, style]}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={role === 'display'}
      accessibilityLabel={accessibilityLabel ?? spoken(text, kind)}
    >
      {text}
    </Text>
  );
}

/** "−₹1,234.50" is read as "minus rupee" by most screen readers; say what it means instead. */
function spoken(text: string, kind: AmountKind): string {
  const bare = text.replace(/^[+−-]/, '');
  return kind === 'expense' ? `${bare} spent` : kind === 'income' ? `${bare} received` : bare;
}
