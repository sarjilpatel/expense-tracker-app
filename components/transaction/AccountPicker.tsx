import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Account, ACCOUNT_TYPE_META } from '@/src/services/accountService';

interface Props {
  accounts: Account[];
  selectedId: string | null;
  onChange: (accountId: string | null) => void;
  theme: any;
}

// Displayed as a 3-column grid matching the Money Manager style
export function AccountPicker({ accounts, selectedId, onChange, theme }: Props) {
  const [open, setOpen] = useState(false);

  const selected = accounts.find(a => a.id === selectedId);

  // Grid items: "No Account" + actual accounts
  const gridItems: (Account | null)[] = [null, ...accounts];

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7} style={styles.rowValue}>
        <Text style={[styles.valueText, !selected && { color: theme.secondaryText }]}>
          {selected ? selected.name : 'Accounts'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={e => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Accounts</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerBtn}>
                  <Ionicons name="grid-outline" size={18} color={theme.secondaryText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => { setOpen(false); router.push('/add-account'); }}
                >
                  <Ionicons name="pencil-outline" size={18} color={theme.secondaryText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerBtn} onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={20} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Grid */}
            <FlatList
              data={gridItems}
              keyExtractor={item => item?.id ?? '__none__'}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.grid}
              ListFooterComponent={
                <TouchableOpacity
                  style={[styles.addRow, { borderTopColor: theme.border }]}
                  onPress={() => { setOpen(false); router.push('/add-account'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={theme.tint} />
                  <Text style={[styles.addText, { color: theme.tint }]}>Add Account</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                const isSelected = item ? selectedId === item.id : selectedId === null;
                const meta = item ? ACCOUNT_TYPE_META[item.type] : null;
                const label = item ? item.name : 'None';
                const iconName = meta?.icon ?? 'close-circle-outline';

                return (
                  <TouchableOpacity
                    style={[
                      styles.gridCell,
                      { borderColor: theme.border },
                      isSelected && { borderColor: theme.tint, backgroundColor: theme.tint + '18' },
                    ]}
                    onPress={() => { onChange(item?.id ?? null); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={iconName as any}
                      size={24}
                      color={isSelected ? theme.tint : theme.secondaryText}
                    />
                    <Text
                      numberOfLines={2}
                      style={[styles.gridLabel, { color: isSelected ? theme.tint : theme.text }]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  rowValue:  { flex: 1 },
  valueText: { fontSize: 14 },

  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:     { borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: '72%' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:    { fontSize: 15, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn:     { padding: 6 },
  grid:          { padding: 6 },
  gridCell: {
    flex: 1, margin: 3, height: 72,
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  gridLabel: { fontSize: 11, fontWeight: '500', marginTop: 5, textAlign: 'center' },
  addRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addText:   { fontSize: 13, fontWeight: '600' },
});
