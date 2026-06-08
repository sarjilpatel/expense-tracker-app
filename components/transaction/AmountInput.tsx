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
    return (
      <View style={styles.wrap}>
        <Text style={[styles.symbol, { color: textColor }]}>{Currency.symbol}</Text>
        <TextInput
          ref={ref}
          style={[styles.input, { color: textColor }]}
          keyboardType="decimal-pad"
          placeholder="0"
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
    justifyContent: 'center',
    height: 90,
    backgroundColor: 'transparent',
  },
  symbol: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 4,
  },
  input: {
    fontSize: 48,
    fontWeight: '800',
    minWidth: 120,
  },
});
