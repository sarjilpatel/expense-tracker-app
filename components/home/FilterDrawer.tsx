import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type, icon as iconSize } from '@/constants/tokens';
import { Sheet, Button, Field, Chip, SectionHeader, type SheetHandle } from '@/components/ui';

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

/** The home-screen filter, on the shared `Sheet` (W2-11). `visible` drives present/dismiss. */
export function FilterDrawer({ visible, onClose, onApply, availableCategories, current }: Props) {
  const { theme } = useTheme();
  const sheet = useRef<SheetHandle>(null);
  const [local, setLocal] = useState<FilterState>(current);

  useEffect(() => { setLocal(current); }, [current]);
  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
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
    sheet.current?.dismiss();
  };

  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    sheet.current?.dismiss();
  };

  const activeCount =
    (local.type !== 'all' ? 1 : 0) +
    local.categories.length +
    (local.amountMin ? 1 : 0) +
    (local.amountMax ? 1 : 0);

  return (
    <Sheet ref={sheet} title={activeCount > 0 ? `Filters · ${activeCount}` : 'Filters'} scroll snapPoints={['72%']} onDismiss={onClose}>
      <SectionHeader title="Type" style={{ marginTop: 0 }} action={activeCount > 0 ? { label: 'Reset', onPress: handleReset } : undefined} />
      <View style={S.chips}>
        <Chip label="All"     selected={local.type === 'all'}     onPress={() => setLocal(p => ({ ...p, type: 'all' }))} />
        <Chip label="Income"  selected={local.type === 'income'}  color={local.type === 'income'  ? theme.income  : undefined} onPress={() => setLocal(p => ({ ...p, type: 'income' }))} />
        <Chip label="Expense" selected={local.type === 'expense'} color={local.type === 'expense' ? theme.expense : undefined} onPress={() => setLocal(p => ({ ...p, type: 'expense' }))} />
      </View>

      {availableCategories.length > 0 && (
        <>
          <SectionHeader title="Categories" count={local.categories.length || undefined} />
          <View style={S.chips}>
            {availableCategories.map(cat => (
              <Chip key={cat} size="sm" label={cat} selected={local.categories.includes(cat)} onPress={() => toggleCategory(cat)} />
            ))}
          </View>
        </>
      )}

      <SectionHeader title="Amount range" />
      <View style={S.range}>
        <Field placeholder="Min" keyboardType="numeric" value={local.amountMin} onChangeText={v => setLocal(p => ({ ...p, amountMin: v }))} accessibilityLabel="Minimum amount" style={{ flex: 1 }} />
        <Ionicons name="remove" size={iconSize.sm} color={theme.secondaryText} />
        <Field placeholder="Max" keyboardType="numeric" value={local.amountMax} onChangeText={v => setLocal(p => ({ ...p, amountMax: v }))} accessibilityLabel="Maximum amount" style={{ flex: 1 }} />
      </View>

      <Button label="Apply filters" icon="checkmark-circle-outline" onPress={handleApply} style={{ marginTop: space.xl }} />
      {activeCount === 0 && (
        <Text style={[type.label, { color: theme.secondaryText, textAlign: 'center', marginTop: space.sm }]}>Showing everything</Text>
      )}
    </Sheet>
  );
}

const S = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  range: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
