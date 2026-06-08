import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
} from 'react-native';

import { useTheme } from '@/src/context/ThemeContext';
import { getCurrentGroup, addCategory, removeCategory, getBudgets, setBudget, deleteBudget } from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/src/i18n/LanguageContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryType = 'income' | 'expense' | 'both';

export default function ManageCategoriesScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedType, setSelectedType] = useState<CategoryType>(
    (typeParam === 'income' || typeParam === 'both') ? typeParam : 'expense'
  );
  const [isAdding, setIsAdding] = useState(false);

  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, any>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const now = new Date();
      const [group, budgets] = await Promise.all([
        getCurrentGroup(),
        getBudgets(now.getMonth() + 1, now.getFullYear()),
      ]);
      setCategories(group.categories || []);
      const budgetMap: Record<string, any> = {};
      (budgets || []).forEach((b: any) => {
        if (b.category) budgetMap[b.category] = b;
      });
      setCategoryBudgets(budgetMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
        Alert.alert('Error', 'Please enter a category name');
        return;
    }
    setIsAdding(true);
    try {
      const icon = selectedType === 'income' ? 'cash-outline' : (selectedType === 'both' ? 'grid-outline' : 'cart-outline');
      const updatedCategories = await addCategory(newCategoryName.trim(), icon, selectedType);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      setCategories(updatedCategories);
      setNewCategoryName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCategory = (id: string, name: string) => {
    Alert.alert(
      'Remove Category',
      `Are you sure you want to remove "${t(name)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCategories = await removeCategory(id);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setCategories(updatedCategories);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove category');
            }
          }
        }
      ]
    );
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
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget');
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleRemoveCategoryBudget = async (categoryName: string) => {
    const existing = categoryBudgets[categoryName];
    if (!existing?._id) return;
    try {
      await deleteBudget(existing._id);
      setCategoryBudgets(prev => {
        const next = { ...prev };
        delete next[categoryName];
        return next;
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove budget');
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
        case 'income':
            return { label: 'Income', color: theme.incomeText, bg: theme.income };
        case 'both':
            return { label: 'Universal', color: theme.tintText, bg: theme.tint };
        default:
            return { label: 'Expense', color: theme.expenseText, bg: theme.expense };
    }
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">{t('category_management')}</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <ThemedText style={styles.label}>{t('add_new_category')}</ThemedText>
          
          <View style={[styles.typeToggleContainer, { backgroundColor: theme.cardAlt ?? theme.border }]}>
            {(['expense', 'income', 'both'] as CategoryType[]).map((type) => (
                <TouchableOpacity
                    key={type}
                    style={[
                        styles.typeToggleBtn,
                        selectedType === type && { backgroundColor: type === 'income' ? theme.income : (type === 'expense' ? theme.expense : theme.tint) }
                    ]}
                    onPress={() => setSelectedType(type)}
                >
                    <Text style={[
                        styles.typeToggleText,
                        selectedType === type && { color: type === 'income' ? theme.incomeText : (type === 'expense' ? theme.expenseText : theme.tintText) }
                    ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
          </View>

          <View style={styles.addInputRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder="e.g. Bonus, Grocery..."
              placeholderTextColor="#A0A0A0"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <TouchableOpacity 
              style={[styles.addBtn, { backgroundColor: theme.tint }]}
              onPress={handleAddCategory}
              disabled={isAdding}
            >
              {isAdding ? <ActivityIndicator color={theme.tintText} /> : <Ionicons name="add" size={28} color={theme.tintText} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <ThemedText style={styles.label}>{selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Categories</ThemedText>
              <View style={[styles.countBadge, { backgroundColor: theme.tint }]}>
                  <Text style={{ color: theme.tintText, fontSize: 12, fontWeight: '800' }}>
                      {categories.filter(c => selectedType === 'both' ? true : (c.type === selectedType || c.type === 'both' || !c.type)).length}
                  </Text>
              </View>
          </View>

          {categories
            .filter(item => {
                if (selectedType === 'both') return true;
                return item.type === selectedType || item.type === 'both' || !item.type;
            })
            .map((item, index) => {
            const badge = getTypeBadge(item.type);
            return (
              <Animated.View
                key={item._id}
                entering={FadeInDown.delay(index * 50)}
                style={[styles.categoryItem, { backgroundColor: theme.card }]}
              >
                <View style={styles.catLeft}>
                  <View style={[styles.catIcon, { backgroundColor: badge.bg }]}>
                    <Ionicons name={item.icon as any || 'grid-outline'} size={20} color={badge.color} />
                  </View>
                  <View>
                    <ThemedText style={styles.catName}>{t(item.name)}</ThemedText>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => openBudgetModal(item.name)} hitSlop={10}>
                    <Ionicons name="wallet-outline" size={20} color={theme.tint} />
                  </TouchableOpacity>
                  <TouchableOpacity
                      onPress={() => handleRemoveCategory(item._id, item.name)}
                      hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.footerActions}>
            <TouchableOpacity 
                style={[styles.importBtn, { borderColor: theme.border }]}
                onPress={() => router.push({
                    pathname: '/import-categories',
                    params: { type: selectedType }
                })}
            >
                <Ionicons name="download-outline" size={18} color={theme.tint} />
                <ThemedText style={styles.footerBtnText}>{t('import_categories')}</ThemedText>
            </TouchableOpacity>

        </View>
      </ScrollView>

      <Modal visible={budgetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 4 }}>Set Category Budget</ThemedText>
            <ThemedText style={{ marginBottom: 20, fontSize: 13 }}>{budgetCategory}</ThemedText>
            <View style={[styles.budgetInputWrapper, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 22, marginRight: 8, fontWeight: '700' }}>₹</Text>
              <TextInput
                style={[styles.budgetInput, { color: theme.text }]}
                placeholder="Enter amount"
                placeholderTextColor="#A0A0A0"
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
                  onPress={() => {
                    handleRemoveCategoryBudget(budgetCategory!);
                    setBudgetModalVisible(false);
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setBudgetModalVisible(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                onPress={handleSaveCategoryBudget}
                disabled={budgetSaving}
              >
                {budgetSaving ? (
                  <ActivityIndicator color={theme.tintText} size="small" />
                ) : (
                  <Text style={{ color: theme.tintText, fontWeight: '700' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  typeToggleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeTypeText: {
    color: '#FFF',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  footerActions: {
    gap: 12,
    marginTop: 10,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 10,
  },
  footerBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  budgetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 20,
  },
  budgetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
