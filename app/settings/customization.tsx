import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/src/context/ThemeContext';
import { Currency, THEME_PRESETS, ThemePreset, getContrastText } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const ACCENT_COLORS = [
  { label: 'Graphite', value: '#18181B' }, // default — zinc-950
  { label: 'Slate',    value: '#475569' }, // slate-600 — neutral with blue character
  { label: 'Indigo',   value: '#4F46E5' }, // indigo-600 — classic indigo
  { label: 'Ocean',    value: '#1D4ED8' }, // blue-700 — rich blue
  { label: 'Teal',     value: '#0F766E' }, // teal-700 — deep teal
  { label: 'Forest',   value: '#15803D' }, // green-700 — forest green
  { label: 'Dusk',     value: '#6D28D9' }, // violet-700 — deep violet
  { label: 'Rose',     value: '#BE185D' }, // pink-700 — deep rose
  { label: 'Ember',    value: '#C2410C' }, // orange-700 — burnt orange
  { label: 'Cloud',    value: '#E5E7EB' }, // light — reversed feel
];

const INCOME_COLORS = [
  { label: 'Blue', value: '#1999FC' },
];

const EXPENSE_COLORS = [
  { label: 'Red', value: '#F55345' },
];

export default function CustomizationScreen() {
  const { theme, overrides, setOverride, resetTheme } = useTheme();
  const colorScheme = useColorScheme();
  const { top } = useSafeAreaInsets();

  const currentAccent  = overrides.tint    ?? theme.tint;
  const currentIncome  = overrides.income  ?? theme.income;
  const currentExpense = overrides.expense ?? theme.expense;

  const handleSelect = (key: 'tint' | 'income' | 'expense', val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverride(key, val);
  };

  const applyPreset = (preset: ThemePreset) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverride('presetName', preset.name);
    setOverride('tint', '');
    setOverride('income', '');
    setOverride('expense', '');
  };

  return (
    <>
    <Stack.Screen options={{ contentStyle: { backgroundColor: theme.background } }} />
    <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>
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
        <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Card title */}
          <View style={styles.previewHeader}>
            <View style={[styles.previewBadge, { backgroundColor: currentAccent }]}>
              <Text style={{ color: theme.tintText, fontSize: 10, fontWeight: '700' }}>BALANCE CARD</Text>
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
              <Ionicons name="add" size={14} color={theme.tintText} />
              <Text style={{ color: theme.tintText, fontSize: 12, fontWeight: '600' }}>Add Entry</Text>
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

        {/* Theme Mode */}
        <ThemedText style={styles.sectionTitle}>THEME MODE</ThemedText>
        <View style={styles.modeContainer}>
          {[
            { label: 'Light', value: 'light', icon: 'sunny-outline' },
            { label: 'Dark', value: 'dark', icon: 'moon-outline' },
            { label: 'System', value: 'system', icon: 'settings-outline' },
          ].map((mode) => {
            const isSelected = (overrides.themeMode ?? 'system') === mode.value;
            return (
              <TouchableOpacity
                key={mode.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setOverride('themeMode', mode.value);
                }}
                style={[
                  styles.modeCard,
                  { backgroundColor: theme.card, borderColor: isSelected ? currentAccent : theme.border }
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name={mode.icon as any} size={18} color={isSelected ? currentAccent : theme.secondaryText} />
                <Text style={[styles.modeLabel, { color: theme.text }]}>{mode.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Presets */}
        <ThemedText style={styles.sectionTitle}>THEME PRESETS</ThemedText>
        <View style={styles.presetsContainer}>
          {THEME_PRESETS.map((preset) => {
            const presetColors = preset[colorScheme ?? 'light'];
            const isSelected = overrides.presetName === preset.name && !overrides.tint && !overrides.income && !overrides.expense;
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
                  <View style={[styles.presetDot, { backgroundColor: presetColors.accent }]} />
                  <View style={[styles.presetDot, { backgroundColor: presetColors.income }]} />
                  <View style={[styles.presetDot, { backgroundColor: presetColors.expense }]} />
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
              {currentAccent === c.value && <Ionicons name="checkmark" size={16} color={getContrastText(c.value)} />}
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
        {(overrides.tint || overrides.income || overrides.expense || overrides.presetName || overrides.themeMode) ? (
          <TouchableOpacity style={styles.resetBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); resetTheme(); }}>
            <Ionicons name="refresh" size={16} color={theme.secondaryText} />
            <Text style={[styles.resetText, { color: theme.secondaryText }]}>Reset to System Defaults</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 36,
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
    paddingHorizontal: 16,
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
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modeCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
