import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  type: 'income' | 'expense';
  onChange: (t: 'income' | 'expense') => void;
  incomeLabel?: string;
  expenseLabel?: string;
  incomeColor: string;
  expenseColor: string;
}

export function TypeSelector({ type, onChange, incomeLabel = 'Income', expenseLabel = 'Expense', incomeColor, expenseColor }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.card }]}>
      <TouchableOpacity
        style={[styles.btn, type === 'expense' && { backgroundColor: expenseColor }]}
        onPress={() => onChange('expense')}
      >
        <Ionicons name="arrow-up-circle" size={20} color={type === 'expense' ? theme.expenseText : expenseColor} />
        <Text style={[styles.label, type === 'expense' && { color: theme.expenseText }]}>{expenseLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, type === 'income' && { backgroundColor: incomeColor }]}
        onPress={() => onChange('income')}
      >
        <Ionicons name="arrow-down-circle" size={20} color={type === 'income' ? theme.incomeText : incomeColor} />
        <Text style={[styles.label, type === 'income' && { color: theme.incomeText }]}>{incomeLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
    height: 52,
  },
  btn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
});
