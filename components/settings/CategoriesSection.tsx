import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';
import { getCurrentGroup } from '@/src/services/dataService';

export function CategoriesSection() {
  const { theme } = useTheme();
  const [incomeCount,  setIncomeCount]  = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);

  useEffect(() => {
    getCurrentGroup()
      .then(({ categories }) => {
        setIncomeCount(categories.filter(c => c.type === 'income').length);
        setExpenseCount(categories.filter(c => c.type === 'expense' || !c.type).length);
      })
      .catch(() => {});
  }, []);

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionLabel}>Categories</ThemedText>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'income' } })}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.income }]}>
              <Ionicons name="arrow-down-outline" size={20} color="#FFF" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Income Categories</Text>
          </View>
          <View style={styles.rowRight}>
            {incomeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.income }]}>
                <Text style={[styles.badgeText, { color: '#FFF' }]}>{incomeCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          </View>
        </TouchableOpacity>

        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'expense' } })}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.expense }]}>
              <Ionicons name="arrow-up-outline" size={20} color="#FFF" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Expense Categories</Text>
          </View>
          <View style={styles.rowRight}>
            {expenseCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.expense }]}>
                <Text style={[styles.badgeText, { color: '#FFF' }]}>{expenseCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },
  card:      { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBox:   { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowTitle:  { fontSize: 15, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  badge:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
