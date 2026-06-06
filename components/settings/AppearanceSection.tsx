import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  theme: any;
}

export function AppearanceSection({ theme }: Props) {
  const { overrides } = useTheme();

  const currentAccent  = overrides.tint    ?? theme.tint;
  const currentIncome  = overrides.income  ?? theme.income;
  const currentExpense = overrides.expense ?? theme.expense;

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionLabel}>Appearance</ThemedText>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.push('/settings/customization')}
          style={styles.row}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: currentAccent }]}>
              <Ionicons name="color-palette-outline" size={20} color="#FFF" />
            </View>
            <View>
              <ThemedText style={styles.rowTitle}>Theme & Colors</ThemedText>
              <Text style={[styles.rowSub, { color: theme.secondaryText }]}>Customize accent, income & expense colors</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.secondaryText} />
        </TouchableOpacity>

        {/* Small Preview strip */}
        <View style={[styles.preview, { backgroundColor: theme.cardAlt }]}>
          <View style={[styles.previewDot, { backgroundColor: currentAccent }]} />
          <Text style={[styles.previewText, { color: currentIncome }]}>₹ +12,500</Text>
          <Text style={[styles.previewSep, { color: theme.secondaryText }]}>·</Text>
          <Text style={[styles.previewText, { color: currentExpense }]}>₹ -4,200</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.previewLabel, { color: theme.secondaryText }]}>Active Palette</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12, paddingLeft: 4,
  },
  card: {
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
  },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  previewDot:   { width: 8, height: 8, borderRadius: 4 },
  previewText:  { fontSize: 13, fontWeight: '700' },
  previewSep:   { fontSize: 13 },
  previewLabel: { fontSize: 11, fontWeight: '600' },
});
