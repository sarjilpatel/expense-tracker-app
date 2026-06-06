import React, { forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Currency } from '@/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  textColor: string;
  borderColor: string;
}

export const AmountInput = forwardRef((
  { value, onChangeText, textColor, borderColor }: Props,
  ref: React.Ref<TextInput>
) => {
    const { theme } = useTheme();
    return (
      <View style={[styles.wrap, { borderColor, backgroundColor: theme.card }]}>
      <Text style={[styles.symbol, { color: textColor }]}>{Currency.symbol}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, { color: textColor }]}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#A0A0A0"
        value={value}
        onChangeText={onChangeText}
        returnKeyType="done"
      />
      </View>
    );
  }
);

AmountInput.displayName = 'AmountInput';

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderRadius: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  symbol: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
  },
});
