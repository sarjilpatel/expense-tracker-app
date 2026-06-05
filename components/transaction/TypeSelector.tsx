import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  type: 'income' | 'expense';
  onChange: (t: 'income' | 'expense') => void;
  incomeLabel?: string;
  expenseLabel?: string;
  incomeColor: string;
  expenseColor: string;
}

export function TypeSelector({ type, onChange, incomeLabel = 'Income', expenseLabel = 'Expense', incomeColor, expenseColor }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: 'rgba(150,150,150,0.1)' }]}>
      <TouchableOpacity
        style={[styles.btn, type === 'expense' && { backgroundColor: expenseColor }]}
        onPress={() => onChange('expense')}
      >
        <Ionicons name="arrow-up-circle" size={20} color={type === 'expense' ? '#FFF' : expenseColor} />
        <Text style={[styles.label, type === 'expense' && styles.activeLabel]}>{expenseLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, type === 'income' && { backgroundColor: incomeColor }]}
        onPress={() => onChange('income')}
      >
        <Ionicons name="arrow-down-circle" size={20} color={type === 'income' ? '#FFF' : incomeColor} />
        <Text style={[styles.label, type === 'income' && styles.activeLabel]}>{incomeLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
  },
  btn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  activeLabel: {
    color: '#FFF',
  },
});
