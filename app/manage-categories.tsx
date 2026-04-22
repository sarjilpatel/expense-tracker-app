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
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentGroup, addCategory, removeCategory, setupWeddingPreset, Category } from '@/src/services/groupApi';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '@/src/i18n/LanguageContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryType = 'income' | 'expense' | 'both';

export default function ManageCategoriesScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedType, setSelectedType] = useState<CategoryType>('expense');
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const group = await getCurrentGroup();
      setCategories(group.categories || []);
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

  const getTypeBadge = (type?: string) => {
    switch (type) {
        case 'income':
            return { label: 'Income', color: theme.income, bg: `${theme.income}15` };
        case 'both':
            return { label: 'Universal', color: theme.tint, bg: `${theme.tint}15` };
        default:
            return { label: 'Expense', color: theme.expense, bg: `${theme.expense}15` };
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
          
          <View style={[styles.typeToggleContainer, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
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
                        selectedType === type && styles.activeTypeText
                    ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
          </View>

          <View style={styles.addInputRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'rgba(150,150,150,0.05)' }]}
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
              {isAdding ? <ActivityIndicator color="#FFF" /> : <Ionicons name="add" size={28} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <ThemedText style={styles.label}>{selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Categories</ThemedText>
              <View style={[styles.countBadge, { backgroundColor: theme.tint + '20' }]}>
                  <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '800' }}>
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
                    <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                    onPress={() => handleRemoveCategory(item._id, item.name)}
                    hitSlop={10}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.danger} style={{ opacity: 0.4 }} />
                </TouchableOpacity>
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

            {!categories.some(c => c.name === 'Catering (Jamvanu)') && (
                <TouchableOpacity 
                    style={[styles.weddingBtn, { backgroundColor: '#FFD60A' }]}
                    onPress={() => Alert.alert(
                        'Unlock Wedding Mode', 
                        'This will add specialized Gujarati Wedding categories (like Catering, Decoration, jewellery) to your current list. Existing categories will be kept. Continue?', 
                        [{text: 'Cancel'}, {text: 'Yes, Add them', onPress: handleApplyWeddingPreset}]
                    )}
                >
                    <Ionicons name="rose-outline" size={18} color="#000" />
                    <Text style={[styles.footerBtnText, { color: '#000' }]}>{t('wedding_mode')}</Text>
                </TouchableOpacity>
            )}
        </View>
      </ScrollView>
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
  weddingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    gap: 10,
  },
  footerBtnText: {
    fontWeight: '800',
    fontSize: 14,
  }
});
