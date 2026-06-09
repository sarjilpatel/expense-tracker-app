import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { searchAllTransactions } from '@/src/services/dataService';
import { CATEGORY_EMOJIS } from '@/constants/maps';

const RECENT_KEY   = '@recent_searches';
const MAX_RECENT   = 8;
const DEBOUNCE_MS  = 280;

type FilterType = 'all' | 'income' | 'expense';

function getEmoji(category: string) {
  return CATEGORY_EMOJIS[category] ?? '🏷️';
}

function relativeDate(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 365)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function SearchScreen() {
  const { theme }              = useTheme();
  const { formatAmount }       = usePreferences();
  const { top }                = useSafeAreaInsets();
  const inputRef               = useRef<TextInput>(null);

  const [query,          setQuery]        = useState('');
  const [results,        setResults]      = useState<any[]>([]);
  const [loading,        setLoading]      = useState(false);
  const [searched,       setSearched]     = useState(false);
  const [filter,         setFilter]       = useState<FilterType>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on mount + auto-focus input
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => raw ? setRecentSearches(JSON.parse(raw)) : null)
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const saveRecent = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(r => r !== trimmed)].slice(0, MAX_RECENT);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }, [recentSearches]);

  const removeRecent = useCallback(async (item: string) => {
    const updated = recentSearches.filter(r => r !== item);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }, [recentSearches]);

  const clearAllRecent = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchAllTransactions(trimmed) as any[];
      setResults(data);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const handleSubmit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveRecent(query);
    runSearch(query);
    Keyboard.dismiss();
  };

  const handleRecentTap = (item: string) => {
    setQuery(item);
    saveRecent(item);
    runSearch(item);
    Keyboard.dismiss();
  };

  const handleResultPress = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/edit-transaction',
      params: {
        id:        item._id,
        amount:    item.amount != null ? String(item.amount) : '0',
        type:      item.type   ?? 'expense',
        category:  item.category ?? '',
        note:      item.note   ?? '',
        date:      item.date   ?? item.createdAt ?? new Date().toISOString(),
        isPrivate: String(!!item.isPrivate),
      },
    });
  };

  // Client-side type filter
  const visible = filter === 'all'
    ? results
    : results.filter(tx => tx.type === filter);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderResult = ({ item, index }: { item: any; index: number }) => {
    const isExpense = item.type === 'expense';
    const amtColor  = isExpense ? theme.expense : theme.income;
    const sign      = isExpense ? '-' : '+';
    const dateStr   = relativeDate(item.date ?? item.createdAt);
    const hasNote   = !!item.note?.trim();

    return (
      <TouchableOpacity
        style={[
          styles.resultRow,
          { borderBottomColor: theme.separator },
          index === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
        ]}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.65}
      >
        {/* Left color bar */}
        <View style={[styles.colorBar, { backgroundColor: amtColor }]} />

        {/* Emoji */}
        <Text style={styles.emoji}>{getEmoji(item.category)}</Text>

        {/* Middle: category + note */}
        <View style={styles.resultMid}>
          <Text style={[styles.resultCat, { color: theme.text }]} numberOfLines={1}>
            {item.category}
          </Text>
          {hasNote && (
            <Text style={[styles.resultNote, { color: theme.secondaryText }]} numberOfLines={1}>
              {item.note}
            </Text>
          )}
          <Text style={[styles.resultDate, { color: theme.secondaryText }]}>{dateStr}</Text>
        </View>

        {/* Right: amount + type chip */}
        <View style={styles.resultRight}>
          <Text style={[styles.resultAmt, { color: amtColor }]}>
            {sign}{formatAmount(item.amount)}
          </Text>
          <View style={[styles.typePill, { backgroundColor: amtColor }]}>
            <Text style={[styles.typePillText, { color: isExpense ? theme.expenseText : theme.incomeText }]}>
              {isExpense ? 'Exp' : 'Inc'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (!searched) {
      // Show recent searches
      if (recentSearches.length === 0) {
        return (
          <View style={styles.hintBox}>
            <Ionicons name="search" size={40} color={theme.secondaryText} style={{ marginBottom: 12 }} />
            <Text style={[styles.hintTitle, { color: theme.text }]}>Search Transactions</Text>
            <Text style={[styles.hintSub, { color: theme.secondaryText }]}>
              Search by category, note, or amount — across all time
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.recentWrap}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: theme.secondaryText }]}>RECENT</Text>
            <TouchableOpacity onPress={clearAllRecent} hitSlop={8}>
              <Text style={[styles.clearAll, { color: theme.tint }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map(item => (
            <View key={item} style={[styles.recentRow, { borderBottomColor: theme.separator }]}>
              <TouchableOpacity
                style={styles.recentLeft}
                onPress={() => handleRecentTap(item)}
                activeOpacity={0.6}
              >
                <Ionicons name="time-outline" size={16} color={theme.secondaryText} />
                <Text style={[styles.recentText, { color: theme.text }]}>{item}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeRecent(item)} hitSlop={10}>
                <Ionicons name="close" size={16} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    // No results
    return (
      <View style={styles.hintBox}>
        <Ionicons name="search-circle-outline" size={48} color={theme.secondaryText} style={{ marginBottom: 12 }} />
        <Text style={[styles.hintTitle, { color: theme.text }]}>No results</Text>
        <Text style={[styles.hintSub, { color: theme.secondaryText }]}>
          {`Nothing matched "${query}" — try a different word`}
        </Text>
      </View>
    );
  };

  const incCount  = results.filter(t => t.type === 'income').length;
  const expCount  = results.filter(t => t.type === 'expense').length;

  return (
    <ThemedView style={[styles.container, { paddingTop: top }]}>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.text }]}
          placeholder="Search all transactions..."
          placeholderTextColor={theme.secondaryText}
          value={query}
          onChangeText={handleQueryChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }}
            hitSlop={10}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={theme.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips — shown only when there are results */}
      {searched && results.length > 0 && (
        <View style={[styles.filterRow, { borderBottomColor: theme.separator }]}>
          {([
            ['all',     `All (${results.length})`],
            ['income',  `Income (${incCount})`],
            ['expense', `Expenses (${expCount})`],
          ] as [FilterType, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                filter === key && { backgroundColor: theme.tint },
                filter !== key && { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => setFilter(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, { color: filter === key ? theme.tintText : theme.secondaryText }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Loading spinner */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Searching…</Text>
        </View>
      )}

      {/* Results list */}
      <FlatList
        data={visible}
        keyExtractor={item => item._id}
        renderItem={renderResult}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={visible.length === 0 ? styles.emptyContent : styles.listContent}
      />

      {/* Results count footer */}
      {searched && !loading && visible.length > 0 && (
        <View style={[styles.footer, { borderTopColor: theme.separator }]}>
          <Text style={[styles.footerText, { color: theme.secondaryText }]}>
            {visible.length} result{visible.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:   { padding: 2 },
  input:     { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 8 },
  clearBtn:  { padding: 2 },

  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 32 },
  loadingText: { fontSize: 14 },

  listContent:  { paddingBottom: 80 },
  emptyContent: { flexGrow: 1 },

  // Result rows
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    paddingRight: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorBar:   { width: 3, alignSelf: 'stretch', marginRight: 12 },
  emoji:      { fontSize: 22, width: 36, textAlign: 'center' },
  resultMid:  { flex: 1, gap: 2, marginLeft: 8 },
  resultCat:  { fontSize: 14, fontWeight: '600' },
  resultNote: { fontSize: 12 },
  resultDate: { fontSize: 11, marginTop: 1 },
  resultRight:{ alignItems: 'flex-end', gap: 4, minWidth: 80 },
  resultAmt:  { fontSize: 14, fontWeight: '800' },
  typePill:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typePillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  // Hint / empty
  hintBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  hintTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  hintSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Recent searches
  recentWrap:   { paddingHorizontal: 16, paddingTop: 8 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  recentTitle:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  clearAll:     { fontSize: 13, fontWeight: '700' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  recentText: { fontSize: 15 },

  // Footer
  footer:     { paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  footerText: { fontSize: 12 },
});
