import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Currency } from '@/constants/theme';
import { space, type, tabular } from '@/constants/tokens';
import { Card } from '@/components/ui';

interface Props {
  value: string;
  onChange: (v: string) => void;
  accent: string;
  autoFocus?: boolean;
}

/** Digits, one decimal point, at most two decimals — whatever the keyboard or a paste sends. */
export function sanitizeAmount(raw: string): string {
  let s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  if (s.length > 1 && s[0] === '0' && s[1] !== '.') s = s.replace(/^0+/, '') || '0';
  return s;
}

/**
 * The amount, typed on the OS number pad. The custom keypad sheet it replaces owned both entry
 * and arithmetic and was the thing that "sometimes did not open"; entry is a plain `TextInput`
 * now and arithmetic lives in `CalculatorSheet`, opened from the header.
 */
export const AmountField = forwardRef<TextInput, Props>(function AmountField({ value, onChange, accent, autoFocus }, ref) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Card style={[S.hero, focused && { borderColor: accent }]}>
      <Text style={[type.overline, { color: theme.secondaryText }]}>Amount</Text>
      <View style={S.row}>
        <Text style={[type.heading, { color: accent }]}>{Currency.symbol}</Text>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={v => onChange(sanitizeAmount(v))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={theme.secondaryText}
          autoFocus={autoFocus}
          selectTextOnFocus
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[type.display, tabular, S.input, { color: theme.text }]}
          accessibilityLabel="Amount"
          maxLength={12}
        />
      </View>
    </Card>
  );
});

const S = StyleSheet.create({
  hero:  { marginTop: space.md },
  row:   { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  input: { flex: 1, paddingVertical: 0 },
});
