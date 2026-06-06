import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Account, ACCOUNT_TYPE_META } from '@/src/services/accountService';
import { Currency } from '@/constants/theme';

interface Props {
  accounts: Account[];
  selectedId: string | null;
  onChange: (accountId: string | null) => void;
  theme: any;
  allTransactions?: any[];
  txAccountMap?: Record<string, string>;
}

export function AccountPicker({ accounts, selectedId, onChange, theme, allTransactions = [], txAccountMap = {} }: Props) {
  const [open, setOpen] = useState(false);

  const selected = accounts.find(a => a.id === selectedId);

  const getBalance = (account: Account) => {
    let bal = account.openingBalance;
    for (const tx of allTransactions) {
      if (txAccountMap[tx._id] !== account.id) continue;
      if (tx.type === 'income') bal += tx.amount;
      else bal -= tx.amount;
    }
    return bal;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.fieldLeft}>
          {selected ? (
            <>
              <View style={[styles.dot, { backgroundColor: selected.color }]} />
              <Text style={[styles.fieldText, { color: theme.text }]}>{selected.name}</Text>
              <Text style={[styles.fieldSub, { color: theme.secondaryText }]}>
                {ACCOUNT_TYPE_META[selected.type]?.label}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="wallet-outline" size={20} color={theme.secondaryText} style={{ marginRight: 10 }} />
              <Text style={[styles.placeholder, { color: theme.secondaryText }]}>Select Account (optional)</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.secondaryText} />
      </TouchableOpacity>
 
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Select Account</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
 
            <FlatList
              data={[null, ...accounts]}
              keyExtractor={item => item?.id ?? '__none__'}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={
                <TouchableOpacity
                  style={[styles.addAccountRow, { borderTopColor: theme.border }]}
                  onPress={() => { setOpen(false); router.push('/add-account'); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.addIcon, { backgroundColor: theme.tint }]}>
                    <Ionicons name="add" size={18} color="#FFF" />
                  </View>
                  <Text style={[styles.addAccountText, { color: theme.tint }]}>Add New Account</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                if (!item) {
                  return (
                    <TouchableOpacity
                      style={[styles.accountRow, { borderBottomColor: theme.border }]}
                      onPress={() => { onChange(null); setOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: theme.card }]}>
                        <Ionicons name="close-circle-outline" size={20} color={theme.secondaryText} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowName, { color: theme.text }]}>No Account</Text>
                        <Text style={[styles.rowType, { color: theme.secondaryText }]}>{"Don't link to any account"}</Text>
                      </View>
                      {selectedId === null && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
                      )}
                    </TouchableOpacity>
                  );
                }
 
                const meta    = ACCOUNT_TYPE_META[item.type];
                const balance = getBalance(item);
                const isSelected = selectedId === item.id;
 
                return (
                  <TouchableOpacity
                    style={[styles.accountRow, { borderBottomColor: theme.border }]}
                    onPress={() => { onChange(item.id); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
                      <Ionicons name={meta.icon as any} size={20} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.rowType, { color: theme.secondaryText }]}>{meta.label}</Text>
                    </View>
                    <Text style={[styles.rowBalance, { color: balance >= 0 ? theme.text : '#EF4444' }]}>
                      {Currency.format(balance)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.tint} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 56, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  fieldText:   { fontSize: 16, fontWeight: '500' },
  fieldSub:    { fontSize: 12 },
  placeholder: { fontSize: 16 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },

  accountRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  iconWrap:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowName:     { fontSize: 15, fontWeight: '600' },
  rowType:     { fontSize: 12, marginTop: 2 },
  rowBalance:  { fontSize: 14, fontWeight: '700' },

  addAccountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addIcon:        { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addAccountText: { fontSize: 15, fontWeight: '600' },
});
