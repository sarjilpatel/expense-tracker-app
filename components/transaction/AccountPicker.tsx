import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
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

  const handleSelect = (accountId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(accountId);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7} style={styles.rowValue}>
        <Text style={[styles.valueText, { color: selected ? theme.text : theme.secondaryText }]}>
          {selected ? selected.name : 'Select Account'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>
            
            {/* Drag Handle */}
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

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
                      { borderColor: theme.border, backgroundColor: theme.background },
                      isSelected && { borderColor: theme.tint, backgroundColor: theme.tint + '12' },
                    ]}
                    onPress={() => handleSelect(item?.id ?? null)}
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
  rowValue:  { flex: 1, alignItems: 'flex-end' },
  valueText: { fontSize: 14, fontWeight: '600', textAlign: 'right' },

  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 24 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, opacity: 0.8 },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:    { fontSize: 16, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn:     { padding: 6 },
  grid:          { padding: 8 },
  gridCell: {
    flex: 1, margin: 4, height: 76,
    borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  gridLabel: { fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  addRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  addText:   { fontSize: 14, fontWeight: '700' },
});
