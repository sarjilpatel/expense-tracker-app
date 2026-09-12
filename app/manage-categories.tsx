import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { EmojiPickerModal } from '@/components/EmojiPickerModal';
import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { Currency } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import {
  Screen, Card, Row, Touchable, Button, Sheet, Field, EmptyState, SectionHeader, Chip, Skeleton,
  type SheetHandle,
} from '@/components/ui';
import {
  getCurrentGroup, addCategory, removeCategory, getBudgets, setBudget, deleteBudget,
  getCategoryPresets, applyCategoryPreset,
} from '@/src/services/dataService';
import type { Category } from '@/src/services/dataService';
import type { CategoryPresetSummary } from '@/src/services/groupApi';
import { formatAmount } from '@/src/utils/money';

type CategoryType = 'income' | 'expense' | 'both';

const TYPES: { key: CategoryType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income',  label: 'Income'  },
  { key: 'both',    label: 'Both'    },
];

export default function ManageCategoriesScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
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

  const presetSheet = useRef<SheetHandle>(null);
  const [presets, setPresets]               = useState<CategoryPresetSummary[]>([]);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const budgetSheet = useRef<SheetHandle>(null);
  const [budgetCategory, setBudgetCategory]   = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount]       = useState('');
  const [budgetSaving, setBudgetSaving]       = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, any>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const now = new Date();
      // The preset list is decoration — a failure there must not cost the screen its categories.
      const [group, budgets, packs] = await Promise.all([
        getCurrentGroup(),
        getBudgets(now.getMonth() + 1, now.getFullYear()),
        getCategoryPresets().catch(() => []),
      ]);
      setCategories(group.categories || []);
      setPresets(packs);
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
      setCategories(updatedCategories);
      setNewCategoryName('');
      setNewCategoryEmoji('');
    } catch (error) {
      // groupApi rejects with the server's own message — "That category already exists" is far
      // more use than a generic failure, and it is the one a user actually hits.
      Alert.alert('Error', typeof error === 'string' ? error : 'Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleApplyPreset = async (preset: CategoryPresetSummary) => {
    setApplyingPreset(preset.key);
    try {
      const { categories: updated, added } = await applyCategoryPreset(preset.key);
      setCategories(updated);
      presetSheet.current?.dismiss();
      // Applying a pack twice is allowed and adds nothing — say so rather than looking like a no-op.
      Alert.alert(
        preset.name,
        added > 0
          ? `Added ${added} ${added === 1 ? 'category' : 'categories'}.`
          : 'You already have every category in this preset.',
      );
    } catch {
      Alert.alert('Error', 'Failed to apply preset');
    } finally {
      setApplyingPreset(null);
    }
  };

  const handleRemoveCategory = (id: string, name: string) => {
    Alert.alert('Remove Category', `Remove "${t(name)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { setCategories(await removeCategory(id)); }
          catch { Alert.alert('Error', 'Failed to remove category'); }
        },
      },
    ]);
  };

  const openBudgetSheet = (categoryName: string) => {
    setBudgetCategory(categoryName);
    const existing = categoryBudgets[categoryName];
    setBudgetAmount(existing ? existing.amount.toString() : '');
    budgetSheet.current?.present();
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
      budgetSheet.current?.dismiss();
    } catch { Alert.alert('Error', 'Failed to save budget'); }
    finally { setBudgetSaving(false); }
  };

  const handleRemoveCategoryBudget = async () => {
    const existing = budgetCategory ? categoryBudgets[budgetCategory] : null;
    if (!existing?._id || !budgetCategory) return;
    try {
      await deleteBudget(existing._id);
      setCategoryBudgets(prev => { const next = { ...prev }; delete next[budgetCategory]; return next; });
      budgetSheet.current?.dismiss();
    } catch { Alert.alert('Error', 'Failed to remove budget'); }
  };

  const typeLabel = (kind?: string) => kind === 'income' ? 'Income' : kind === 'both' ? 'Universal' : 'Expense';
  const typeTone  = (kind?: string): 'income' | 'expense' | 'neutral' =>
    kind === 'income' ? 'income' : kind === 'both' ? 'neutral' : 'expense';

  const filteredCategories = categories.filter(item =>
    selectedType === 'both' ? true : (item.type === selectedType || item.type === 'both' || !item.type)
  );

  if (loading) {
    return (
      <Screen title={t('category_management')}>
        <Skeleton.Group style={{ paddingTop: space.md }}>
          <Skeleton.Block height={36} width="70%" round={radius.full} />
          <Skeleton.Block height={48} />
          <Skeleton.Row /><Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title={t('category_management')} keyboard>
      {/* ── Add ── */}
      <SectionHeader title="Add category" />
      <View style={S.chips}>
        {TYPES.map(({ key, label }) => (
          <Chip key={key} label={label} selected={selectedType === key} onPress={() => setSelectedType(key)} />
        ))}
      </View>
      <View style={S.addRow}>
        <Touchable
          onPress={() => setShowEmojiPicker(true)}
          size={48}
          style={[S.emojiBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
          accessibilityLabel={newCategoryEmoji ? `Emoji ${newCategoryEmoji}, change` : 'Pick an emoji'}
        >
          {newCategoryEmoji
            ? <Text style={S.emoji}>{newCategoryEmoji}</Text>
            : <Ionicons name="happy-outline" size={iconSize.lg} color={theme.secondaryText} />}
        </Touchable>
        <Field
          placeholder="Category name…"
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          returnKeyType="done"
          onSubmitEditing={handleAddCategory}
          style={S.nameField}
        />
        <Button label="Add" onPress={handleAddCategory} loading={isAdding} block={false} accessibilityLabel="Add category" />
      </View>

      {presets.length > 0 && (
        <Card padded={false} style={{ marginTop: space.md }}>
          <Row
            icon="sparkles"
            title="Start from a preset"
            subtitle="Wedding, travel, household and more"
            onPress={() => presetSheet.current?.present()}
            last
          />
        </Card>
      )}

      {/* ── List ── */}
      <SectionHeader title={`${typeLabel(selectedType)} categories`} count={filteredCategories.length} />
      {filteredCategories.length === 0 ? (
        <Card><EmptyState compact icon="grid-outline" title="No categories yet" body="Add one above, or start from a preset." /></Card>
      ) : (
        <Card padded={false}>
          {filteredCategories.map((item, index) => {
            const budget = categoryBudgets[item.name];
            return (
              <Row
                key={item._id}
                title={t(item.name)}
                emoji={item.emoji}
                icon={item.emoji ? undefined : ((item.icon as any) || 'grid-outline')}
                iconBg={item.emoji ? 'transparent' : undefined}
                subtitle={budget ? `${typeLabel(item.type)} · Budget ${formatAmount(budget.amount)}` : typeLabel(item.type)}
                last={index === filteredCategories.length - 1}
                right={(
                  <View style={S.actions}>
                    <Chip size="sm" tone={typeTone(item.type)} label={typeLabel(item.type)} />
                    <Touchable onPress={() => openBudgetSheet(item.name)} size={32} style={S.actionBtn} accessibilityLabel={`Set budget for ${t(item.name)}`} rippleBorderless>
                      <Ionicons name="wallet-outline" size={iconSize.md} color={theme.tint} />
                    </Touchable>
                    <Touchable onPress={() => handleRemoveCategory(item._id, item.name)} size={32} style={S.actionBtn} accessibilityLabel={`Remove ${t(item.name)}`} rippleBorderless>
                      <Ionicons name="trash-outline" size={iconSize.md} color={theme.danger} />
                    </Touchable>
                  </View>
                )}
              />
            );
          })}
        </Card>
      )}

      {/* ── Presets ── */}
      <Sheet ref={presetSheet} title="Category presets" scroll snapPoints={['70%']} keyboard="none">
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.sm }]}>
          Anything you already have is skipped.
        </Text>
        <Card padded={false}>
          {presets.map((preset, index) => (
            <Row
              key={preset.key}
              icon={(preset.icon as any) || 'apps'}
              title={preset.name}
              subtitle={preset.description}
              right={applyingPreset === preset.key
                ? <Chip size="sm" label="Adding…" />
                : <Chip size="sm" label={String(preset.count)} />}
              onPress={() => handleApplyPreset(preset)}
              disabled={applyingPreset !== null}
              last={index === presets.length - 1}
            />
          ))}
        </Card>
      </Sheet>

      {/* ── Category budget ── */}
      <Sheet ref={budgetSheet} title="Category budget">
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.md }]}>
          {budgetCategory ? t(budgetCategory) : ''} · this month
        </Text>
        <Field
          label="Amount"
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          keyboardType="numeric"
          placeholder="0"
          autoFocus
          right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{Currency.symbol}</Text>}
        />
        <View style={S.sheetActions}>
          {!!(budgetCategory && categoryBudgets[budgetCategory]) && (
            <Button label="Remove" variant="danger" onPress={handleRemoveCategoryBudget} block={false} />
          )}
          <Button label="Save" onPress={handleSaveCategoryBudget} loading={budgetSaving} disabled={!budgetAmount} block={false} style={{ marginLeft: 'auto' }} />
        </View>
      </Sheet>

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={emoji => { setNewCategoryEmoji(emoji); }}
        theme={theme}
      />
    </Screen>
  );
}

const S = StyleSheet.create({
  chips:        { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  addRow:       { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emojiBtn:     { width: 48, height: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  emoji:        { fontSize: 22 },
  nameField:    { flex: 1 },
  actions:      { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actionBtn:    { width: 32, height: 32, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
});
