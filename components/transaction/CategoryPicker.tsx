import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  ScrollView, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

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
  const [mounted, setMounted] = useState(false);
  const [search, setSearch]   = useState('');
  const slide = useSharedValue(600);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
    opacity: 1 - slide.value / 600,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - slide.value / 600,
  }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.value = 600;
      slide.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    } else {
      slide.value = withTiming(600, { duration: 100, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setMounted)(false);
          runOnJS(setSearch)('');
        }
      });
    }
  }, [visible]);

  const filtered  = categories.filter(c => c.type === type || c.type === 'both' || !c.type);
  const displayed = search.trim()
    ? filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  const recentToShow = recentCategories
    ? recentCategories.filter(name => filtered.some(c => c.name === name)).slice(0, 6)
    : [];

  const activeColor = type === 'expense' ? theme.expense : theme.income;

  const handleSelect = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(name);
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View style={sheetStyle}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>

              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

              <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Category</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.headerBtn} onPress={() => { onClose(); router.push('/manage-categories' as any); }}>
                    <Ionicons name="pencil-outline" size={18} color={theme.secondaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
                    <Ionicons name="close" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>

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

              <View style={[styles.typeTabs, { borderBottomColor: theme.border }]}>
                {(['income', 'expense'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeTab, type === t && { borderBottomColor: t === 'expense' ? theme.expense : theme.income, borderBottomWidth: 2 }]}
                    onPress={() => onTypeChange(t)}
                  >
                    <Text style={[styles.typeTabText, { color: type === t ? (t === 'expense' ? theme.expense : theme.income) : theme.secondaryText }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {recentToShow.length > 0 && !search.trim() && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
                  style={[styles.recentRow, { borderBottomColor: theme.border }]}
                  contentContainerStyle={styles.recentContent}
                >
                  {recentToShow.map(name => {
                    const sel = value === name;
                    return (
                      <TouchableOpacity key={name}
                        style={[styles.chip, { borderColor: sel ? activeColor : theme.border, backgroundColor: sel ? activeColor + '18' : 'transparent' }]}
                        onPress={() => handleSelect(name)} activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: sel ? activeColor : theme.text }]}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {loading ? (
                <View style={styles.centerState}><ActivityIndicator color={theme.tint} /></View>
              ) : displayed.length === 0 ? (
                <View style={styles.centerState}>
                  <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                    {search.trim() ? 'No categories found' : 'No categories yet'}
                  </Text>
                  {!search.trim() && onRetry && (
                    <TouchableOpacity style={[styles.retryBtn, { borderColor: theme.tint }]} onPress={onRetry} activeOpacity={0.7}>
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
                    const sel = value === item.name;
                    return (
                      <TouchableOpacity
                        style={[styles.gridCell, { borderColor: theme.border, backgroundColor: theme.background }, sel && { backgroundColor: activeColor + '12', borderColor: activeColor }]}
                        onPress={() => handleSelect(item.name)} activeOpacity={0.7}
                      >
                        <Ionicons name={(item.icon || 'grid-outline') as any} size={22} color={sel ? activeColor : theme.secondaryText} />
                        <Text numberOfLines={2} style={[styles.gridLabel, { color: sel ? activeColor : theme.text }]}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav:       { flex: 1 },
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, opacity: 0.5 },

  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle:    { fontSize: 16, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn:     { padding: 6 },

  searchRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },

  typeTabs:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  typeTab:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  typeTabText: { fontSize: 14, fontWeight: '700' },

  recentRow:     { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 48 },
  recentContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  chipText:      { fontSize: 12, fontWeight: '600' },

  centerState: { height: 160, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:   { fontSize: 14 },
  retryBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:   { fontSize: 13, fontWeight: '600' },

  grid:      { padding: 8 },
  gridCell:  { flex: 1, margin: 4, minHeight: 76, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  gridLabel: { fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});
