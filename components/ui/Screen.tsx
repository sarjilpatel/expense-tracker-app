import React from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, RefreshControl,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type, icon as iconSize, radius } from '@/constants/tokens';
import { Touchable } from './Touchable';

/**
 * The screen shell: safe area, one header, optional scrolling and keyboard avoidance.
 *
 * Replaces the 39 hand-rolled headers (W2-30). Every stack screen had its own back button, its own
 * title style and its own idea of top padding; this is the one copy. The header is intentionally
 * plain — a title, a back chevron, and a slot on the right — because that is all any of the 39
 * actually did.
 *
 * `scroll` defaults to true. Pass `scroll={false}` for screens that own a list (FlashList etc.),
 * which must not sit inside a ScrollView.
 */
export interface ScreenProps {
  title?: string;
  /** Override the back action; `false` hides the chevron (tab roots, auth flows). */
  onBack?: (() => void) | false;
  /** Right-hand header slot — an icon `Touchable`, a `Button size="sm"`, a count. */
  right?: React.ReactNode;
  /** Something between the header and the content — a segmented control, a summary strip. */
  subheader?: React.ReactNode;
  scroll?: boolean;
  /** Wrap in KeyboardAvoidingView. Forms want this; lists do not. */
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Horizontal gutter for the content. Default `space.lg`. Lists that draw their own rows pass 0. */
  gutter?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Anything pinned below the content — a primary action bar. Sits above the home indicator. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  testID?: string;
}

export function Screen({
  title, onBack, right, subheader, scroll = true, keyboard = false, refreshing = false, onRefresh,
  gutter = space.lg, contentStyle, footer, children, testID,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const showBack = onBack !== false;
  const back = typeof onBack === 'function' ? onBack : () => router.back();

  const header = (title !== undefined || right || showBack) && (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.headerSide}>
        {showBack && (
          <Touchable onPress={back} size={36} style={styles.headerBtn} accessibilityLabel="Back" rippleBorderless>
            <Ionicons name="chevron-back" size={iconSize.lg} color={theme.text} />
          </Touchable>
        )}
      </View>
      <Text style={[type.heading, styles.headerTitle, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );

  const body = scroll
    ? (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[{ paddingHorizontal: gutter, paddingBottom: space.xxl }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} /> : undefined}
      >
        {children}
      </ScrollView>
    )
    : <View style={[styles.flex, { paddingHorizontal: gutter }, contentStyle]}>{children}</View>;

  const inner = (
    <>
      {header}
      {subheader}
      {body}
      {footer && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: theme.separator }]}>
          {footer}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]} testID={testID}>
      {keyboard
        ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{inner}</KeyboardAvoidingView>
        : inner}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.sm, paddingBottom: space.sm, minHeight: 52,
  },
  headerSide:  { width: 44, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  headerBtn:   { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  footer:      { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
