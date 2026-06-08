import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, Animated, Dimensions, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

export interface FilterState {
  type: 'all' | 'income' | 'expense';
  categories: string[];
  amountMin: string;
  amountMax: string;
}

export const DEFAULT_FILTERS: FilterState = {
  type: 'all',
  categories: [],
  amountMin: '',
  amountMax: '',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  availableCategories: string[];
  current: FilterState;
}

const SCREEN_H = Dimensions.get('window').height;
const DRAWER_H = SCREEN_H * 0.72;

export function FilterDrawer({ visible, onClose, onApply, availableCategories, current }: Props) {
  const { theme } = useTheme();
  const slideY = useRef(new Animated.Value(DRAWER_H)).current;

  const [local, setLocal] = useState<FilterState>(current);

  useEffect(() => { setLocal(current); }, [current]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideY, { toValue: DRAWER_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const toggleCategory = useCallback((cat: string) => {
    setLocal(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  }, []);

  const handleApply = () => {
    Keyboard.dismiss();
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  const activeCount =
    (local.type !== 'all' ? 1 : 0) +
    local.categories.length +
    (local.amountMin ? 1 : 0) +
    (local.amountMax ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        {/* Title bar */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>
            Filter{activeCount > 0 ? ` · ${activeCount} active` : ''}
          </Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={[styles.resetBtn, { color: theme.tint }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Type */}
          <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>TYPE</Text>
          <View style={[styles.segmentRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {(['all', 'income', 'expense'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.segment,
                  local.type === t && { backgroundColor: theme.tint },
                ]}
                onPress={() => setLocal(p => ({ ...p, type: t }))}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.segmentText,
                  { color: local.type === t ? theme.tintText : theme.secondaryText },
                ]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>CATEGORY</Text>
              <View style={styles.chipWrap}>
                {availableCategories.map(cat => {
                  const active = local.categories.includes(cat);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        { borderColor: active ? theme.tint : theme.border, backgroundColor: active ? theme.tint + '22' : theme.card },
                      ]}
                      onPress={() => toggleCategory(cat)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, { color: active ? theme.tint : theme.secondaryText }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Amount range */}
          <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>AMOUNT RANGE</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.amountInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              placeholder="Min"
              placeholderTextColor={theme.secondaryText}
              keyboardType="numeric"
              value={local.amountMin}
              onChangeText={v => setLocal(p => ({ ...p, amountMin: v }))}
            />
            <Text style={[styles.amountSep, { color: theme.secondaryText }]}>—</Text>
            <TextInput
              style={[styles.amountInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              placeholder="Max"
              placeholderTextColor={theme.secondaryText}
              keyboardType="numeric"
              value={local.amountMax}
              onChangeText={v => setLocal(p => ({ ...p, amountMax: v }))}
            />
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Apply button */}
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: theme.tint }]}
          onPress={handleApply}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.tintText} />
          <Text style={[styles.applyText, { color: theme.tintText }]}>Apply Filters</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_H,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  title:    { fontSize: 17, fontWeight: '700' },
  resetBtn: { fontSize: 14, fontWeight: '600' },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.6,
    marginTop: 20, marginBottom: 10,
  },

  segmentRow: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  segment:     { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  amountRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput:{
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15,
  },
  amountSep:  { fontSize: 16, fontWeight: '600' },

  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 16, gap: 8, marginTop: 8,
  },
  applyText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
