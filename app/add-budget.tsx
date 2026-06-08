import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { ThemedText } from '@/components/themed-text';
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Category field */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Category</ThemedText>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={[styles.inputField, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.inputText, { color: categoryLabel ? theme.text : theme.secondaryText }]}>
              {categoryLabel || 'Select Category'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount field */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Budget Limit</ThemedText>
          <View style={[styles.inputField, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ fontSize: 16, color: theme.secondaryText, marginRight: 8 }}>₹</Text>
            <TextInput
              style={[styles.inputText, { color: theme.text, flex: 1, paddingVertical: 8 }]}
              placeholder="0.00"
              placeholderTextColor={theme.secondaryText}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[styles.saveBtn, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={theme.tintText} />
            : <Text style={[styles.saveBtnText, { color: theme.tintText }]}>Save Budget</Text>
          }
        </TouchableOpacity>

      </ScrollView>

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
                    <Text style={[styles.catName, { color: selected ? theme.tintText : theme.text }]}>{item.label}</Text>
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
    paddingHorizontal: 12,
    paddingBottom:     12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  scroll: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 40 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputField: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputText: { fontSize: 16 },

  saveBtn: {
    marginTop:        12,
    height:           56,
    borderRadius:     18,
    alignItems:       'center',
    justifyContent:   'center',
  },
  saveBtnText: { fontSize: 17, fontWeight: '800' },

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
    paddingHorizontal: 12,
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
