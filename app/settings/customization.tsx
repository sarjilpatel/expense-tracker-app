import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/src/context/ThemeContext';
import { Currency } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const ACCENT_COLORS = [
  { label: 'Indigo',  value: '#6366F1' },
  { label: 'Blue',    value: '#3B82F6' },
  { label: 'Purple',  value: '#8B5CF6' },
  { label: 'Teal',    value: '#14B8A6' },
  { label: 'Cyan',    value: '#06B6D4' },
  { label: 'Pink',    value: '#EC4899' },
  { label: 'Orange',  value: '#F97316' },
  { label: 'Red',     value: '#EF4444' },
];

const INCOME_COLORS = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Blue',    value: '#3B82F6' },
  { label: 'Teal',    value: '#14B8A6' },
  { label: 'Lime',    value: '#84CC16' },
];

const EXPENSE_COLORS = [
  { label: 'Rose',    value: '#F43F5E' },
  { label: 'Orange',  value: '#F97316' },
  { label: 'Red',     value: '#EF4444' },
  { label: 'Amber',   value: '#F59E0B' },
];

const THEME_PRESETS = [
  {
    name: 'Modern Slate',
    accent: '#6366F1',
    income: '#10B981',
    expense: '#F43F5E',
  },
  {
    name: 'Ocean Teal',
    accent: '#06B6D4',
    income: '#14B8A6',
    expense: '#F97316',
  },
  {
    name: 'Mint Lime',
    accent: '#14B8A6',
    income: '#84CC16',
    expense: '#F43F5E',
  },
  {
    name: 'Neon Orchid',
    accent: '#EC4899',
    income: '#3B82F6',
    expense: '#EF4444',
  },
];

export default function CustomizationScreen() {
  const { theme, overrides, setOverride, resetTheme } = useTheme();

  const currentAccent  = overrides.tint    ?? theme.tint;
  const currentIncome  = overrides.income  ?? theme.income;
  const currentExpense = overrides.expense ?? theme.expense;

  const handleSelect = (key: 'tint' | 'income' | 'expense', val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverride(key, val);
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverride('tint', preset.accent);
    setOverride('income', preset.income);
    setOverride('expense', preset.expense);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>UI Customization</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Real-time Preview */}
        <ThemedText style={styles.sectionTitle}>LIVE PREVIEW</ThemedText>
        <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Card title */}
          <View style={styles.previewHeader}>
            <View style={[styles.previewBadge, { backgroundColor: currentAccent }]}>
              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>BALANCE CARD</Text>
            </View>
            <Ionicons name="sparkles" size={16} color={currentAccent} />
          </View>

          {/* Amount */}
          <Text style={[styles.previewBalance, { color: theme.text }]}>
            {Currency.format(8300.50)}
          </Text>
          <Text style={[styles.previewSubtext, { color: theme.secondaryText }]}>Available balance</Text>

          {/* Buttons */}
          <View style={styles.previewButtonRow}>
            <View style={[styles.previewButton, { backgroundColor: currentAccent }]}>
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Add Entry</Text>
            </View>
            <View style={[styles.previewButton, { backgroundColor: theme.cardAlt }]}>
              <Ionicons name="stats-chart" size={14} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>Analytics</Text>
            </View>
          </View>

          {/* Transactions preview */}
          <View style={[styles.previewRow, { borderBottomColor: theme.border }]}>
            <View style={styles.previewRowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: currentIncome }]}>
                <Ionicons name="arrow-down" size={14} color="#FFF" />
              </View>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>Salary Deposit</Text>
            </View>
            <Text style={{ color: currentIncome, fontSize: 13, fontWeight: '700' }}>+₹25,000</Text>
          </View>

          <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
            <View style={styles.previewRowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: currentExpense }]}>
                <Ionicons name="arrow-up" size={14} color="#FFF" />
              </View>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>Coffee Shop</Text>
            </View>
            <Text style={{ color: currentExpense, fontSize: 13, fontWeight: '700' }}>-₹180</Text>
          </View>
        </View>

        {/* Presets */}
        <ThemedText style={styles.sectionTitle}>THEME PRESETS</ThemedText>
        <View style={styles.presetsContainer}>
          {THEME_PRESETS.map((preset) => {
            const isSelected = currentAccent === preset.accent && currentIncome === preset.income && currentExpense === preset.expense;
            return (
              <TouchableOpacity
                key={preset.name}
                onPress={() => applyPreset(preset)}
                style={[
                  styles.presetCard,
                  { backgroundColor: theme.card, borderColor: isSelected ? currentAccent : theme.border }
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetName, { color: theme.text }]}>{preset.name}</Text>
                <View style={styles.presetDots}>
                  <View style={[styles.presetDot, { backgroundColor: preset.accent }]} />
                  <View style={[styles.presetDot, { backgroundColor: preset.income }]} />
                  <View style={[styles.presetDot, { backgroundColor: preset.expense }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Accent Colors */}
        <ThemedText style={styles.sectionTitle}>ACCENT COLOR</ThemedText>
        <View style={[styles.colorGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {ACCENT_COLORS.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => handleSelect('tint', c.value)}
              style={[styles.colorSwatch, { backgroundColor: c.value }]}
              activeOpacity={0.8}
            >
              {currentAccent === c.value && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Income Colors */}
        <ThemedText style={styles.sectionTitle}>INCOME COLOR</ThemedText>
        <View style={[styles.colorGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {INCOME_COLORS.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => handleSelect('income', c.value)}
              style={[styles.colorSwatch, { backgroundColor: c.value }]}
              activeOpacity={0.8}
            >
              {currentIncome === c.value && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Expense Colors */}
        <ThemedText style={styles.sectionTitle}>EXPENSE COLOR</ThemedText>
        <View style={[styles.colorGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {EXPENSE_COLORS.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => handleSelect('expense', c.value)}
              style={[styles.colorSwatch, { backgroundColor: c.value }]}
              activeOpacity={0.8}
            >
              {currentExpense === c.value && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Reset */}
        {(overrides.tint || overrides.income || overrides.expense) ? (
          <TouchableOpacity style={styles.resetBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); resetTheme(); }}>
            <Ionicons name="refresh" size={16} color={theme.secondaryText} />
            <Text style={[styles.resetText, { color: theme.secondaryText }]}>Reset to System Defaults</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewBalance: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  previewSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 16,
  },
  previewButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  presetCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetDots: {
    flexDirection: 'row',
    gap: 4,
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 24,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
