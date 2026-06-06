import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { setBudget } from '@/src/services/dataService';
import { CATEGORY_EMOJIS } from '@/constants/maps';

const CATEGORIES = [
  { key: null,             label: 'All',         emoji: '·' },
  ...Object.entries(CATEGORY_EMOJIS).map(([key, emoji]) => ({ key, label: key, emoji })),
];

export default function AddBudgetScreen() {
  const { theme } = useTheme();

  const [category,      setCategory]      = useState<string | null | undefined>(undefined);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [amount,        setAmount]        = useState('');
  const [showPicker,    setShowPicker]    = useState(false);
  const [loading,       setLoading]       = useState(false);

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Add Budget</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Category field */}
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={[styles.field, { borderBottomColor: theme.border }]}
      >
        <Text style={[styles.fieldText, { color: categoryLabel ? theme.text : '#666' }]}>
          {categoryLabel || 'Category'}
        </Text>
      </TouchableOpacity>

      {/* Amount field */}
      <View style={[styles.field, { borderBottomColor: theme.border }]}>
        <TextInput
          style={[styles.fieldText, { color: theme.text }]}
          placeholder="Amount"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={loading}
        style={[styles.saveBtn, loading && { opacity: 0.7 }]}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.saveBtnText}>Save</Text>
        }
      </TouchableOpacity>

      {/* Category picker bottom sheet */}
      <Modal visible={showPicker} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPicker(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>

            {/* Sheet header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Category</Text>
              <View style={styles.sheetActions}>
                <Ionicons name="pencil-outline" size={20} color={theme.secondaryText} />
                <TouchableOpacity onPress={() => setShowPicker(false)} style={{ marginLeft: 18 }}>
                  <Ionicons name="close" size={22} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3-column grid */}
            <FlatList
              data={CATEGORIES}
              keyExtractor={item => item.key ?? 'all'}
              numColumns={3}
              style={styles.grid}
              renderItem={({ item }) => {
                const selected = category === item.key;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setCategory(item.key);
                      setCategoryLabel(item.label);
                      setShowPicker(false);
                    }}
                    style={[
                      styles.catCell,
                      { borderColor: theme.border },
                      selected && { backgroundColor: theme.tint },
                    ]}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.catEmoji}>{item.emoji}</Text>
                    <Text style={[styles.catName, { color: theme.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingBottom:     12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  field: {
    paddingHorizontal: 20,
    paddingVertical:   18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldText: { fontSize: 16 },

  saveBtn: {
    marginHorizontal: 20,
    marginTop:        32,
    height:           54,
    borderRadius:     14,
    backgroundColor:  '#E8635A',
    alignItems:       'center',
    justifyContent:   'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Bottom sheet
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:            '70%',
  },
  sheetHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:   { fontSize: 16, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', alignItems: 'center' },

  grid: { paddingBottom: 24 },
  catCell: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 20,
    borderWidth:     StyleSheet.hairlineWidth,
    gap:             6,
  },
  catEmoji: { fontSize: 22 },
  catName:  { fontSize: 12, fontWeight: '500' },
});
