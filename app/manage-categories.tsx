import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Alert, TextInput, ActivityIndicator, LayoutAnimation,
  Platform, UIManager, Modal,
} from 'react-native';
import { EmojiPickerModal } from '@/components/EmojiPickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/src/context/ThemeContext';
import { getCurrentGroup, addCategory, removeCategory, getBudgets, setBudget, deleteBudget } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/src/i18n/LanguageContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryType = 'income' | 'expense' | 'both';


export default function ManageCategoriesScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();

  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [selectedType, setSelectedType] = useState<CategoryType>(
    (typeParam === 'income' || typeParam === 'both') ? typeParam : 'expense'
  );
  const [isAdding, setIsAdding]         = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetCategory, setBudgetCategory]   = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount]         = useState('');
  const [budgetSaving, setBudgetSaving]         = useState(false);
  const [categoryBudgets, setCategoryBudgets]   = useState<Record<string, any>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const now = new Date();
      const [group, budgets] = await Promise.all([
        getCurrentGroup(),
        getBudgets(now.getMonth() + 1, now.getFullYear()),
      ]);
      setCategories(group.categories || []);
      const budgetMap: Record<string, any> = {};
      (budgets || []).forEach((b: any) => { if (b.category) budgetMap[b.category] = b; });
      setCategoryBudgets(budgetMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCategories(); }, [fetchCategories]));

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) { Alert.alert('Error', 'Please enter a category name'); return; }
    setIsAdding(true);
    try {
      const icon = selectedType === 'income' ? 'cash-outline' : (selectedType === 'both' ? 'grid-outline' : 'cart-outline');
      const updatedCategories = await addCategory(newCategoryName.trim(), icon, selectedType, newCategoryEmoji || undefined);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      setCategories(updatedCategories);
      setNewCategoryName('');
      setNewCategoryEmoji('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCategory = (id: string, name: string) => {
    Alert.alert('Remove Category', `Remove "${t(name)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            const updatedCategories = await removeCategory(id);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCategories(updatedCategories);
          } catch { Alert.alert('Error', 'Failed to remove category'); }
        },
      },
    ]);
  };

  const openBudgetModal = (categoryName: string) => {
    setBudgetCategory(categoryName);
    const existing = categoryBudgets[categoryName];
    setBudgetAmount(existing ? existing.amount.toString() : '');
    setBudgetModalVisible(true);
  };

  const handleSaveCategoryBudget = async () => {
    if (!budgetCategory || !budgetAmount) return;
    setBudgetSaving(true);
    try {
      const now = new Date();
      const budget = await setBudget({
        amount: parseFloat(budgetAmount),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        category: budgetCategory,
      });
      setCategoryBudgets(prev => ({ ...prev, [budgetCategory]: budget }));
      setBudgetModalVisible(false);
    } catch { Alert.alert('Error', 'Failed to save budget'); }
    finally { setBudgetSaving(false); }
  };

  const handleRemoveCategoryBudget = async (categoryName: string) => {
    const existing = categoryBudgets[categoryName];
    if (!existing?._id) return;
    try {
      await deleteBudget(existing._id);
      setCategoryBudgets(prev => { const next = { ...prev }; delete next[categoryName]; return next; });
    } catch { Alert.alert('Error', 'Failed to remove budget'); }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'income': return { label: 'Income',    color: theme.incomeText,  bg: theme.income  };
      case 'both':   return { label: 'Universal', color: theme.tintText,    bg: theme.tint    };
      default:       return { label: 'Expense',   color: theme.expenseText, bg: theme.expense };
    }
  };

  const filteredCategories = categories.filter(item =>
    selectedType === 'both' ? true : (item.type === selectedType || item.type === 'both' || !item.type)
  );

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>{t('category_management')}</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Add Category Section */}
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>ADD CATEGORY</Text>

        {/* Type Toggle */}
        <View style={[styles.typeToggleContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(['expense', 'income', 'both'] as CategoryType[]).map((type) => {
            const active = selectedType === type;
            const bg = type === 'income' ? theme.income : (type === 'expense' ? theme.expense : theme.tint);
            const color = type === 'income' ? theme.incomeText : (type === 'expense' ? theme.expenseText : theme.tintText);
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeToggleBtn, active && { backgroundColor: bg }]}
                onPress={() => setSelectedType(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeToggleText, { color: active ? color : theme.secondaryText }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Name + Emoji row */}
        <View style={styles.addInputRow}>
          {/* Emoji picker button */}
          <TouchableOpacity
            style={[styles.emojiInput, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setShowEmojiPicker(true)}
            activeOpacity={0.8}
          >
            {newCategoryEmoji
              ? <Text style={styles.emojiBtnText}>{newCategoryEmoji}</Text>
              : <Ionicons name="happy-outline" size={22} color={theme.secondaryText} />
            }
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            placeholder="Category name..."
            placeholderTextColor={theme.secondaryText}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            returnKeyType="done"
            onSubmitEditing={handleAddCategory}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.tint }]}
            onPress={handleAddCategory}
            disabled={isAdding}
            activeOpacity={0.8}
          >
            {isAdding
              ? <ActivityIndicator color={theme.tintText} size="small" />
              : <Ionicons name="add" size={24} color={theme.tintText} />
            }
          </TouchableOpacity>
        </View>

        {/* Category List */}
        <View style={styles.listHeader}>
          <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>
            {selectedType.toUpperCase()} CATEGORIES
          </Text>
          <View style={[styles.countBadge, { backgroundColor: theme.tint }]}>
            <Text style={{ color: theme.tintText, fontSize: 11, fontWeight: '800' }}>{filteredCategories.length}</Text>
          </View>
        </View>

        <View style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {filteredCategories.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No categories yet</Text>
            </View>
          ) : (
            filteredCategories.map((item, index) => {
              const badge = getTypeBadge(item.type);
              const isLast = index === filteredCategories.length - 1;
              return (
                <Animated.View
                  key={item._id}
                  entering={FadeInDown.delay(index * 40).duration(220)}
                  style={[styles.categoryRow, { borderBottomColor: theme.border, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth }]}
                >
                  <View style={styles.catLeft}>
                    <View style={[styles.catIcon, !item.emoji && { backgroundColor: badge.bg }]}>
                      {item.emoji
                        ? <Text style={styles.catEmoji}>{item.emoji}</Text>
                        : <Ionicons name={(item.icon as any) || 'grid-outline'} size={20} color={badge.color} />
                      }
                    </View>
                    <View>
                      <Text style={[styles.catName, { color: theme.text }]}>{t(item.name)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                        {categoryBudgets[item.name] && (
                          <View style={[styles.typeBadge, { backgroundColor: theme.tint }]}>
                            <Text style={[styles.typeBadgeText, { color: theme.tintText }]}>
                              ₹{categoryBudgets[item.name].amount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.catActions}>
                    <TouchableOpacity onPress={() => openBudgetModal(item.name)} hitSlop={10}>
                      <Ionicons name="wallet-outline" size={19} color={theme.tint} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveCategory(item._id, item.name)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={19} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>

        <TouchableOpacity
          style={[styles.importBtn, { borderColor: theme.border }]}
          onPress={() => router.push({ pathname: '/import-categories', params: { type: selectedType } })}
        >
          <Ionicons name="download-outline" size={18} color={theme.tint} />
          <Text style={[styles.importBtnText, { color: theme.tint }]}>{t('import_categories')}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Emoji Picker ── */}
      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={emoji => { setNewCategoryEmoji(emoji); }}
        theme={theme}
      />

      {/* ── Budget Modal ── */}
      <Modal visible={budgetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.budgetSheet, { backgroundColor: theme.card }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 4 }}>Set Category Budget</ThemedText>
            <ThemedText style={{ marginBottom: 20, fontSize: 13, color: theme.secondaryText }}>{budgetCategory}</ThemedText>
            <View style={[styles.budgetInputWrapper, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 22, marginRight: 8, fontWeight: '700' }}>₹</Text>
              <TextInput
                style={[styles.budgetInput, { color: theme.text }]}
                placeholder="Enter amount"
                placeholderTextColor={theme.secondaryText}
                keyboardType="numeric"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              {categoryBudgets[budgetCategory ?? ''] && (
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: theme.danger }]}
                  onPress={() => { handleRemoveCategoryBudget(budgetCategory!); setBudgetModalVisible(false); }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
                onPress={() => setBudgetModalVisible(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                onPress={handleSaveCategoryBudget}
                disabled={budgetSaving}
              >
                {budgetSaving
                  ? <ActivityIndicator color={theme.tintText} size="small" />
                  : <Text style={{ color: theme.tintText, fontWeight: '700' }}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 36, marginBottom: 8,
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  content: { paddingHorizontal: 8, paddingBottom: 60 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 20,
  },

  typeToggleContainer: {
    flexDirection: 'row', borderRadius: 14, padding: 4,
    marginBottom: 12, gap: 4, borderWidth: StyleSheet.hairlineWidth,
  },
  typeToggleBtn:  { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  typeToggleText: { fontSize: 13, fontWeight: '700' },

  addInputRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  emojiInput: {
    width: 52, height: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center', alignItems: 'center',
  },
  emojiBtnText: { fontSize: 26 },
  input: {
    flex: 1, height: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingHorizontal: 14, fontSize: 15, fontWeight: '500',
  },
  addBtn: {
    width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },

  listHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  countBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },

  categoryCard: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  catEmoji:{ fontSize: 22 },
  catName: { fontSize: 15, fontWeight: '600' },
  catActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText:  { fontSize: 14 },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', gap: 8,
  },
  importBtnText: { fontWeight: '700', fontSize: 14 },

  // Budget modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  budgetSheet: { padding: 28, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  budgetInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 20,
  },
  budgetInput: { flex: 1, fontSize: 22, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
