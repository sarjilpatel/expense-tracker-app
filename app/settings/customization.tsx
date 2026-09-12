import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { THEME_PRESETS, ThemePreset, getContrastText } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, Touchable, Button, Amount, SectionHeader, Chip } from '@/components/ui';

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

const INCOME_COLORS  = [{ label: 'Blue', value: '#1999FC' }];
const EXPENSE_COLORS = [{ label: 'Red',  value: '#F55345' }];

const MODES = [
  { label: 'Light',  value: 'light',  icon: 'sunny-outline'    },
  { label: 'Dark',   value: 'dark',   icon: 'moon-outline'     },
  { label: 'System', value: 'system', icon: 'settings-outline' },
] as const;

/** A colour well. Selected shows a contrast-computed check; the well itself is the only place a
 *  raw colour is painted on this screen, because the colour *is* the content. */
function Swatch({ value, selected, onPress, label }: { value: string; selected: boolean; onPress: () => void; label: string }) {
  return (
    <Touchable
      onPress={onPress}
      haptic="selection"
      size={40}
      style={[S.swatch, { backgroundColor: value }]}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      rippleBorderless
    >
      {selected && <Ionicons name="checkmark" size={iconSize.sm} color={getContrastText(value)} />}
    </Touchable>
  );
}

export default function CustomizationScreen() {
  const { theme, overrides, setOverride, resetTheme } = useTheme();
  const colorScheme = useColorScheme();

  const currentAccent  = overrides.tint    ?? theme.tint;
  const currentIncome  = overrides.income  ?? theme.income;
  const currentExpense = overrides.expense ?? theme.expense;

  const handleSelect = (key: 'tint' | 'income' | 'expense', val: string) => setOverride(key, val);

  const applyPreset = (preset: ThemePreset) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverride('presetName', preset.name);
    setOverride('tint', '');
    setOverride('income', '');
    setOverride('expense', '');
  };

  const dirty = !!(overrides.tint || overrides.income || overrides.expense || overrides.presetName || overrides.themeMode);

  return (
    <Screen title="Customize">
      <Stack.Screen options={{ contentStyle: { backgroundColor: theme.background } }} />

      {/* ── Live preview: built from the same primitives the app uses, so it is a true preview ── */}
      <Card style={{ marginTop: space.sm }}>
        <Text style={[type.overline, { color: theme.secondaryText }]}>Available balance</Text>
        <Amount value={8300.5} role="display" style={{ marginTop: space.xs }} />
        <View style={S.previewBtns}>
          <Button size="sm" icon="add" label="Add entry" onPress={() => {}} />
          <Button size="sm" variant="secondary" icon="stats-chart" label="Analytics" onPress={() => {}} />
        </View>
        <View style={[S.previewRows, { borderTopColor: theme.separator }]}>
          <Row icon="arrow-down" iconColor={currentIncome} title="Salary deposit" right={<Amount value={25000} kind="income" />} />
          <Row icon="arrow-up"   iconColor={currentExpense} title="Coffee shop"   right={<Amount value={180} kind="expense" />} last />
        </View>
      </Card>

      {/* ── Theme mode ── */}
      <SectionHeader title="Theme mode" />
      <View style={S.chips}>
        {MODES.map(mode => (
          <Chip
            key={mode.value}
            icon={mode.icon}
            label={mode.label}
            selected={(overrides.themeMode ?? 'system') === mode.value}
            onPress={() => setOverride('themeMode', mode.value)}
          />
        ))}
      </View>

      {/* ── Presets ── */}
      <SectionHeader title="Theme presets" />
      <View style={S.presets}>
        {THEME_PRESETS.map(preset => {
          const colors = preset[colorScheme ?? 'light'];
          const selected = overrides.presetName === preset.name && !overrides.tint && !overrides.income && !overrides.expense;
          return (
            <Card
              key={preset.name}
              onPress={() => applyPreset(preset)}
              accessibilityLabel={`${preset.name} preset${selected ? ', selected' : ''}`}
              style={[S.preset, selected && { borderColor: currentAccent, borderWidth: 1.5 }]}
            >
              <Text style={[type.bodyStrong, { color: theme.text }]}>{preset.name}</Text>
              <View style={S.dots}>
                {[colors.accent, colors.income, colors.expense].map((c, i) => (
                  <View key={i} style={[S.dot, { backgroundColor: c }]} />
                ))}
              </View>
            </Card>
          );
        })}
      </View>

      {/* ── Colours ── */}
      <SectionHeader title="Accent colour" />
      <Card><View style={S.swatches}>
        {ACCENT_COLORS.map(c => (
          <Swatch key={c.value} value={c.value} label={c.label} selected={currentAccent === c.value} onPress={() => handleSelect('tint', c.value)} />
        ))}
      </View></Card>

      <SectionHeader title="Income colour" />
      <Card><View style={S.swatches}>
        {INCOME_COLORS.map(c => (
          <Swatch key={c.value} value={c.value} label={c.label} selected={currentIncome === c.value} onPress={() => handleSelect('income', c.value)} />
        ))}
      </View></Card>

      <SectionHeader title="Expense colour" />
      <Card><View style={S.swatches}>
        {EXPENSE_COLORS.map(c => (
          <Swatch key={c.value} value={c.value} label={c.label} selected={currentExpense === c.value} onPress={() => handleSelect('expense', c.value)} />
        ))}
      </View></Card>

      {dirty && (
        <Button
          variant="ghost"
          icon="refresh"
          label="Reset to system defaults"
          onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); resetTheme(); }}
          style={{ marginTop: space.xl }}
        />
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  previewBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  previewRows: { marginTop: space.lg, marginHorizontal: -space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  chips:       { flexDirection: 'row', gap: space.sm },
  presets:     { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  preset:      { width: '47%', flexGrow: 1, gap: space.sm },
  dots:        { flexDirection: 'row', gap: space.xs },
  dot:         { width: 14, height: 14, borderRadius: radius.full },
  swatches:    { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch:      { width: 40, height: 40, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
});
