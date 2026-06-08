import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { useTheme } from '@/src/context/ThemeContext';

const CURRENCIES = Object.entries(CURRENCY_META) as [CurrencyCode, { symbol: string; name: string; locale: string }][];

interface Props {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
}

export function CurrencyPicker({ value, onChange }: Props) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const meta = CURRENCY_META[value];

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.symbol, { color: theme.tint }]}>{meta.symbol}</Text>
        <Text style={[styles.code, { color: theme.text }]}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.secondaryText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Select Currency</Text>
          <FlatList
            data={CURRENCIES}
            keyExtractor={([code]) => code}
            renderItem={({ item: [code, info] }) => (
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: theme.border }]}
                onPress={() => { onChange(code); setOpen(false); }}
                activeOpacity={0.65}
              >
                <Text style={[styles.itemSymbol, { color: theme.tint }]}>{info.symbol}</Text>
                <View style={styles.itemMid}>
                  <Text style={[styles.itemCode, { color: theme.text }]}>{code}</Text>
                  <Text style={[styles.itemName, { color: theme.secondaryText }]}>{info.name}</Text>
                </View>
                {code === value && <Ionicons name="checkmark" size={18} color={theme.tint} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start',
  },
  symbol:  { fontSize: 18, fontWeight: '700' },
  code:    { fontSize: 14, fontWeight: '600' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    maxHeight: '60%',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16, paddingBottom: 32,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemSymbol: { fontSize: 20, width: 32, textAlign: 'center', fontWeight: '700' },
  itemMid:   { flex: 1 },
  itemCode:  { fontSize: 15, fontWeight: '600' },
  itemName:  { fontSize: 12, marginTop: 1 },
});
