import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, Field, Chip, EmptyState, Skeleton, type SheetHandle } from '@/components/ui';

interface Category {
  _id?: string;
  name: string;
  icon?: string;
  emoji?: string;
  type?: 'income' | 'expense' | 'both';
}

interface Props {
  /** Optional — a caller holding a ref calls `present()` instead and leaves this out. */
  visible?: boolean;
  onClose?: () => void;
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

/**
 * The category picker, on the shared `Sheet` (W2-11). It used to be a hand-rolled Modal with its
 * own slide animation and backdrop.
 *
 * Prefer the ref: `ref.current?.present()` on tap. Driving it through `visible` means a tap that
 * sets state already `true` — after a dismiss the caller did not hear about, or a `present()`
 * that ran before the sheet host mounted — does nothing, which is how it "sometimes did not
 * open". `visible` is still honoured for the callers that have it.
 */
export const CategoryPicker = forwardRef<SheetHandle, Props>(function CategoryPicker({
  visible, onClose, categories, value, type: kind, onTypeChange, onChange, theme,
  loading, onRetry, recentCategories,
}, ref) {
  const sheet = useRef<SheetHandle>(null);
  const [search, setSearch] = useState('');

  useImperativeHandle(ref, () => ({
    present: () => sheet.current?.present(),
    dismiss: () => sheet.current?.dismiss(),
  }), []);

  useEffect(() => {
    if (visible === undefined) return;
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  const filtered  = categories.filter(c => c.type === kind || c.type === 'both' || !c.type);
  const displayed = search.trim()
    ? filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  const recentToShow = recentCategories
    ? recentCategories.filter(name => filtered.some(c => c.name === name)).slice(0, 6)
    : [];

  const activeColor = kind === 'expense' ? theme.expense : theme.income;

  const handleSelect = (name: string) => {
    onChange(name);
    sheet.current?.dismiss();
  };

  return (
    <Sheet
      ref={sheet}
      title="Category"
      scroll
      snapPoints={['75%']}
      onDismiss={() => { setSearch(''); onClose?.(); }}
    >
      <View style={S.top}>
        <Field
          icon="search-outline"
          placeholder="Search categories…"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search categories"
          style={{ flex: 1 }}
          right={search.length > 0 ? (
            <Touchable onPress={() => setSearch('')} size={28} accessibilityLabel="Clear search" rippleBorderless>
              <Ionicons name="close-circle" size={iconSize.sm} color={theme.secondaryText} />
            </Touchable>
          ) : undefined}
        />
        <Touchable onPress={() => { sheet.current?.dismiss(); router.push('/manage-categories' as any); }} size={44} style={S.manageBtn} accessibilityLabel="Manage categories" rippleBorderless>
          <Ionicons name="pencil-outline" size={iconSize.md} color={theme.secondaryText} />
        </Touchable>
      </View>

      <View style={S.chips}>
        <Chip label="Expense" selected={kind === 'expense'} color={kind === 'expense' ? theme.expense : undefined} onPress={() => onTypeChange('expense')} />
        <Chip label="Income"  selected={kind === 'income'}  color={kind === 'income'  ? theme.income  : undefined} onPress={() => onTypeChange('income')} />
      </View>

      {recentToShow.length > 0 && !search.trim() && (
        <>
          <Text style={[type.overline, S.label, { color: theme.secondaryText }]}>Recent</Text>
          <View style={S.chips}>
            {recentToShow.map(name => (
              <Chip key={name} size="sm" label={name} selected={value === name} color={value === name ? activeColor : undefined} onPress={() => handleSelect(name)} />
            ))}
          </View>
        </>
      )}

      <Text style={[type.overline, S.label, { color: theme.secondaryText }]}>All</Text>
      {loading ? (
        <Skeleton.Group><Skeleton.Row /><Skeleton.Row /></Skeleton.Group>
      ) : displayed.length === 0 ? (
        <EmptyState
          compact
          icon="grid-outline"
          title={search.trim() ? 'No categories found' : 'No categories yet'}
          action={!search.trim() && onRetry ? { label: 'Retry', onPress: onRetry, variant: 'secondary' } : undefined}
        />
      ) : (
        <View style={S.grid}>
          {displayed.map(item => {
            const sel = value === item.name;
            return (
              <Touchable
                key={item._id ?? item.name}
                onPress={() => handleSelect(item.name)}
                haptic="selection"
                style={[S.cell, { borderColor: sel ? activeColor : theme.border, backgroundColor: sel ? hexToRGBA(activeColor, 0.1) : theme.cardAlt }]}
                accessibilityLabel={item.name}
                accessibilityState={{ selected: sel }}
              >
                {item.emoji
                  ? <Text style={S.emoji}>{item.emoji}</Text>
                  : <Ionicons name={(item.icon || 'grid-outline') as any} size={iconSize.lg} color={sel ? activeColor : theme.secondaryText} />}
                <Text numberOfLines={2} style={[type.label, S.cellLabel, { color: sel ? activeColor : theme.text }]}>{item.name}</Text>
              </Touchable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
});

const S = StyleSheet.create({
  top:       { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  manageBtn: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  label:     { marginTop: space.lg, marginBottom: space.sm },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell:      { width: '31%', flexGrow: 1, aspectRatio: 1.1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center', gap: space.xs, padding: space.sm, overflow: 'hidden' },
  emoji:     { ...type.title },
  cellLabel: { textAlign: 'center' },
});
