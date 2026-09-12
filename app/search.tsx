import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, FlatList, Keyboard, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { searchAllTransactions } from '@/src/services/dataService';
import { CATEGORY_EMOJIS } from '@/constants/maps';
import { space, radius, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, Touchable, Field, Amount, EmptyState, SectionHeader, Chip, Skeleton } from '@/components/ui';

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
  const { theme } = useTheme();
  const inputRef  = useRef<TextInput>(null);

  const [query,          setQuery]          = useState('');
  const [results,        setResults]        = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [searched,       setSearched]       = useState(false);
  const [filter,         setFilter]         = useState<FilterType>('all');
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
        isRecurring: String(!!item.isRecurring),
        recurrenceFrequency: item.recurrenceFrequency ?? '',
      },
    });
  };

  const clear = () => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); };

  // Client-side type filter
  const visible  = filter === 'all' ? results : results.filter(tx => tx.type === filter);
  const incCount = results.filter(t => t.type === 'income').length;
  const expCount = results.filter(t => t.type === 'expense').length;

  const renderResult = ({ item, index }: { item: any; index: number }) => (
    <Row
      emoji={getEmoji(item.category)}
      iconBg="transparent"
      title={item.category}
      subtitle={[item.note?.trim(), relativeDate(item.date ?? item.createdAt)].filter(Boolean).join(' · ')}
      right={<Amount value={item.amount} kind={item.type === 'expense' ? 'expense' : 'income'} />}
      onPress={() => handleResultPress(item)}
      last={index === visible.length - 1}
    />
  );

  const renderEmpty = () => {
    if (loading) {
      return <Skeleton.Group style={{ paddingTop: space.md }}><Skeleton.Row /><Skeleton.Row /><Skeleton.Row /></Skeleton.Group>;
    }
    if (!searched) {
      if (recentSearches.length === 0) {
        return <EmptyState icon="search" title="Search transactions" body="Search by category, note, or amount — across all time." />;
      }
      return (
        <>
          <SectionHeader title="Recent" action={{ label: 'Clear all', onPress: clearAllRecent }} />
          <Card padded={false}>
            {recentSearches.map((item, i) => (
              <Row
                key={item}
                icon="time-outline"
                iconBg="transparent"
                iconColor={theme.secondaryText}
                title={item}
                onPress={() => handleRecentTap(item)}
                chevron={false}
                last={i === recentSearches.length - 1}
                right={(
                  <Touchable onPress={() => removeRecent(item)} size={28} style={S.removeBtn} accessibilityLabel={`Remove ${item}`} rippleBorderless>
                    <Ionicons name="close" size={iconSize.sm} color={theme.secondaryText} />
                  </Touchable>
                )}
              />
            ))}
          </Card>
        </>
      );
    }
    return (
      <EmptyState
        icon="search-circle-outline"
        title="No results"
        body={`Nothing matched "${query}" — try a whole word from a note, or a category.`}
      />
    );
  };

  return (
    <Screen
      title="Search"
      scroll={false}
      gutter={0}
      subheader={(
        <View style={S.bar}>
          <Field
            ref={inputRef}
            icon="search"
            placeholder="Search all transactions…"
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search transactions"
            right={query.length > 0 ? (
              <Touchable onPress={clear} size={28} style={S.removeBtn} accessibilityLabel="Clear search" rippleBorderless>
                <Ionicons name="close-circle" size={iconSize.md} color={theme.secondaryText} />
              </Touchable>
            ) : undefined}
          />
          {searched && results.length > 0 && (
            <View style={S.chips}>
              <Chip label={`All · ${results.length}`}    selected={filter === 'all'}     onPress={() => setFilter('all')} size="sm" />
              <Chip label={`Income · ${incCount}`}      selected={filter === 'income'}  onPress={() => setFilter('income')} size="sm" />
              <Chip label={`Expenses · ${expCount}`}    selected={filter === 'expense'} onPress={() => setFilter('expense')} size="sm" />
            </View>
          )}
        </View>
      )}
    >
      <FlatList
        data={visible}
        keyExtractor={item => item._id}
        renderItem={renderResult}
        ListEmptyComponent={renderEmpty}
        // The content view is one View, so a card frame on it encloses every rendered row — the
        // list stays virtualized and still reads as a Card.
        contentContainerStyle={[S.list, visible.length > 0 && [S.frame, { backgroundColor: theme.card, borderColor: theme.border }]]}
        style={S.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </Screen>
  );
}

const S = StyleSheet.create({
  bar:        { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  chips:      { flexDirection: 'row', gap: space.sm },
  removeBtn:  { width: 28, height: 28, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  scroll:     { paddingHorizontal: space.lg },
  list:       { paddingBottom: space.xxl, flexGrow: 1 },
  frame:      { flexGrow: 0, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
