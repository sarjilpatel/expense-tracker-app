import React, { useState, useRef } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { setBudget } from '@/src/services/dataService';
import { CATEGORY_EMOJIS } from '@/constants/maps';
import { Currency } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Field, Sheet, Touchable, Chip, type SheetHandle } from '@/components/ui';

const CATEGORIES = [
  { key: null, label: 'Monthly total', emoji: '📊' },
  ...Object.entries(CATEGORY_EMOJIS).map(([key, emoji]) => ({ key, label: key, emoji })),
];

export default function AddBudgetScreen() {
  const { theme } = useTheme();
  const picker = useRef<SheetHandle>(null);

  const [category, setCategory] = useState<string | null | undefined>(undefined);
  const [amount,   setAmount]   = useState('');
  const [loading,  setLoading]  = useState(false);

  const chosen = CATEGORIES.find(c => c.key === category);

  const handleSave = async () => {
    if (category === undefined) { Alert.alert('Missing', 'Please select a category.'); return; }
    if (!amount)                { Alert.alert('Missing', 'Please enter an amount.');   return; }
    setLoading(true);
    try {
      const now = new Date();
      await setBudget({
        amount:   parseFloat(amount),
        month:    now.getMonth() + 1,
        year:     now.getFullYear(),
        category: category,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.msg || 'Failed to save budget.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Add budget" keyboard>
      <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Category</Text>
      <Touchable onPress={() => picker.current?.present()} style={[S.pickerField, { backgroundColor: theme.inputBg, borderColor: theme.border }]} accessibilityLabel={chosen ? `Category: ${chosen.label}` : 'Select category'}>
        {chosen && <Text style={S.emoji}>{chosen.emoji}</Text>}
        <Text style={[type.body, { color: chosen ? theme.text : theme.secondaryText, flex: 1 }]}>
          {chosen?.label ?? 'Select category'}
        </Text>
        <Ionicons name="chevron-down" size={iconSize.sm} color={theme.secondaryText} />
      </Touchable>

      <Field
        label="Budget limit"
        placeholder="0.00"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{Currency.symbol}</Text>}
        style={{ marginTop: space.lg }}
      />

      <Button label="Save budget" onPress={handleSave} loading={loading} style={{ marginTop: space.xl }} />

      <Sheet ref={picker} title="Category" scroll snapPoints={['60%']} keyboard="none">
        <View style={S.chips}>
          {CATEGORIES.map(item => (
            <Chip
              key={item.key ?? '__total'}
              emoji={item.emoji}
              label={item.label}
              selected={category === item.key}
              onPress={() => { setCategory(item.key); picker.current?.dismiss(); }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const S = StyleSheet.create({
  label:       { marginTop: space.md, marginBottom: space.xs, marginLeft: space.xs },
  pickerField: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md },
  emoji:       { ...type.heading },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
