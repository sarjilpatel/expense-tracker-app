import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  ScrollView, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Category {
  _id?: string;
  name: string;
  icon?: string;
  type?: 'income' | 'expense' | 'both';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  value: string | null;
  type: 'income' | 'expense';
  onTypeChange: (t: 'income' | 'expense') => void;
  onChange: (name: string) => void;
  theme: any;
  loading?: boolean;
  onRetry?: () => void;
  recentCategories?: string[];
}

export function CategoryPicker({
  visible, onClose, categories, value, type, onTypeChange, onChange, theme,
  loading, onRetry, recentCategories,
}: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = categories.filter(c => c.type === type || c.type === 'both' || !c.type);
  const displayed = search.trim()
    ? filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  const recentToShow = recentCategories
    ? recentCategories.filter(name => filtered.some(c => c.name === name)).slice(0, 6)
    : [];

  const activeColor = type === 'expense' ? theme.expense : theme.income;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={e => e.stopPropagation()}>

          {/* Sheet header */}
          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Category</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => { onClose(); router.push('/manage-categories' as any); }}
              >
                <Ionicons name="pencil-outline" size={18} color={theme.secondaryText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
            <Ionicons name="search-outline" size={16} color={theme.secondaryText} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search categories..."
              placeholderTextColor={theme.secondaryText}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Type tabs */}
          <View style={[styles.typeTabs, { borderBottomColor: theme.border }]}>
            {(['income', 'expense'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeTab, type === t && { borderBottomColor: t === 'expense' ? theme.expense : theme.income, borderBottomWidth: 2 }]}
                onPress={() => onTypeChange(t)}
              >
                <Text style={[
                  styles.typeTabText,
                  { color: type === t ? (t === 'expense' ? theme.expense : theme.income) : theme.secondaryText },
                ]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent chips */}
          {recentToShow.length > 0 && !search.trim() && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={[styles.recentRow, { borderBottomColor: theme.border }]}
              contentContainerStyle={styles.recentContent}
            >
              {recentToShow.map(name => {
                const isSelected = value === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.chip,
                      { borderColor: isSelected ? activeColor : theme.border, backgroundColor: isSelected ? activeColor + '18' : 'transparent' },
                    ]}
                    onPress={() => { onChange(name); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: isSelected ? activeColor : theme.text }]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Grid / loading / empty state */}
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.tint} />
            </View>
          ) : displayed.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                {search.trim() ? 'No categories found' : 'No categories yet'}
              </Text>
              {!search.trim() && onRetry && (
                <TouchableOpacity
                  style={[styles.retryBtn, { borderColor: theme.tint }]}
                  onPress={onRetry}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.retryText, { color: theme.tint }]}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={displayed}
              keyExtractor={item => item._id ?? item.name}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => {
                const isSelected = value === item.name;
                return (
                  <TouchableOpacity
                    style={[
                      styles.gridCell,
                      { borderColor: theme.border },
                      isSelected && { backgroundColor: activeColor + '22', borderColor: activeColor },
                    ]}
                    onPress={() => { onChange(item.name); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={(item.icon || 'grid-outline') as any}
                      size={22}
                      color={isSelected ? activeColor : theme.secondaryText}
                    />
                    <Text
                      numberOfLines={2}
                      style={[styles.gridLabel, { color: isSelected ? activeColor : theme.text }]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav:       { flex: 1 },
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:     { borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: '92%' },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:    { fontSize: 15, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn:     { padding: 6 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  typeTabs:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  typeTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  typeTabText: { fontSize: 13, fontWeight: '600' },

  recentRow:    { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 48 },
  recentContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  chipText:  { fontSize: 12, fontWeight: '500' },

  centerState: { height: 120, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:   { fontSize: 14 },
  retryBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:   { fontSize: 13, fontWeight: '600' },

  grid:      { padding: 6 },
  gridCell:  {
    flex: 1, margin: 3, minHeight: 66,
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  gridLabel: { fontSize: 11, fontWeight: '500', marginTop: 5, textAlign: 'center' },
});
