import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View, Text, StyleSheet, AppState, Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SystemUI from 'expo-system-ui';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { PreferencesProvider } from '@/src/context/PreferencesContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, getContrastText } from '@/constants/theme';
import apiClient from '@/src/services/apiClient';
import { LanguageProvider } from '@/src/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { runSync } from '@/src/sync/engine';
import { getSyncMeta } from '@/src/sync/meta';
import { startForegroundScheduler } from '@/src/sync/scheduler';
import LockScreen from '@/app/lock';
import { shouldLock, recordBackground, clearBackgroundTime } from '@/src/services/lockService';
import { hasSeenWelcome } from '@/src/services/onboardingService';
import { radius, space, type } from '@/constants/tokens';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

SplashScreen.preventAutoHideAsync();
// Screens off the top of a stack, and blurred tabs, are wrapped in React.Suspense-style freeze so
// they neither render nor run effects until they are visible again (W2-14).
enableFreeze(true);

// Set Android Activity window background immediately on module load.
// This is what shows through during native slide animations — not fixable from JS-layer styles alone.
SystemUI.setBackgroundColorAsync(
  Appearance.getColorScheme() === 'dark' ? Colors.dark.background : Colors.light.background
);

export const unstable_settings = {
  anchor: '(tabs)',
};

// W2-05: four kinds of screen, four option sets. Add a route to the list its kind belongs to.
const ROOT: NativeStackNavigationOptions = { headerShown: false, animation: 'fade' };
// `fullScreenGestureEnabled` gives iOS a swipe-back from anywhere on the screen, not just the edge;
// Android gets predictive back from `app.json` (W2-08) — nothing in the app intercepts hardware
// back itself, so there was no handler to migrate.
const PUSH: NativeStackNavigationOptions = { headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true };
const EDIT: NativeStackNavigationOptions = { headerShown: false, presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true };
const FLOW: NativeStackNavigationOptions = { headerShown: false, animation: 'slide_from_right', gestureEnabled: false };

const PUSH_SCREENS = [
  'accounts', 'account-detail', 'budget', 'goals', 'search', 'manage-group', 'manage-categories',
  'import-categories', 'trips/index', 'trips/[id]',
  'settings/customization', 'settings/security', 'settings/data', 'settings/help',
];
const EDIT_SCREENS = ['add-transaction', 'edit-transaction', 'add-budget', 'add-account', 'add-transfer', 'edit-profile'];
const FLOW_SCREENS = ['welcome', 'login', 'signup', 'forgot-password', 'verify-email', 'reset-password', 'group-setup'];


function RootLayoutNav() {
  const { theme, isDark } = useTheme();
  const { user, loading, isGuest, logout } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  // A signed-in device with no cursor has never pulled: restore before the first screen (W3-19).
  const [restoring, setRestoring] = useState<boolean | null>(null);
  const [locked, setLocked]     = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  // Inject logout into apiClient for 401 handling
  useEffect(() => {
    apiClient.injectLogout(logout);
  }, [logout]);

  // Cold-start lock check, and whether this device has been through the first run (W2-32) —
  // both read in parallel so neither adds a hop to startup (W2-18).
  useEffect(() => {
    shouldLock().then(lock => {
      if (lock) setLocked(true);
      setLockChecked(true);
    });
    hasSeenWelcome().then(setWelcomeSeen);
  }, []);

  // AppState-based lock
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state === 'background' || state === 'inactive') {
        await recordBackground();
      } else if (state === 'active') {
        const lock = await shouldLock();
        if (lock) { setLocked(true); await clearBackgroundTime(); }
      }
    });
    return () => sub.remove();
  }, []);

  // First run for an account on this device: a full pull, with a screen saying so, before Home
  // renders empty. A failed attempt (offline) does not trap the user — the app opens and the
  // status line on the Data screen says the backup is behind.
  useEffect(() => {
    if (loading) return;
    if (isGuest || !user) { setRestoring(false); return; }
    let cancelled = false;
    getSyncMeta().then(async meta => {
      if (cancelled) return;
      if (meta.cursor !== null) { setRestoring(false); return; }
      setRestoring(true);
      try { await runSync('restore'); } finally { if (!cancelled) setRestoring(false); }
    });
    return () => { cancelled = true; };
  }, [isGuest, loading, user?._id]);

  // The schedule's foreground half: a run on every return to the app, if one is due (W3-17).
  useEffect(() => {
    if (loading || isGuest) return;
    return startForegroundScheduler();
  }, [loading, isGuest]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (user && inAuthGroup) {
      // Logged-in user landed on auth screen → push to tabs
      router.replace('/(tabs)');
    } else if (!user && welcomeSeen === false && segments[0] !== 'welcome') {
      // First run on this device: the welcome flow, which ends in guest mode or an account.
      router.replace('/welcome');
    }
    // Otherwise no forced redirects — guests go directly to tabs

    SplashScreen.hideAsync();
  }, [user, loading, segments, router, welcomeSeen]);

  if (loading || !lockChecked || welcomeSeen === null) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: theme.background }]}>
        <View style={loadingStyles.iconWrap}>
          <Ionicons name="wallet" size={38} color={getContrastText(Colors.light.primary)} />
        </View>
        <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 28 }} />
      </View>
    );
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  if (restoring !== false) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={[type.body, { color: theme.secondaryText, marginTop: space.lg }]}>Restoring your data…</Text>
      </View>
    );
  }

  const bgColor = theme.background;
  const navTheme = isDark
    ? { ...DarkTheme,    colors: { ...DarkTheme.colors,    background: bgColor, card: bgColor } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: bgColor, card: bgColor } };

  return (
    <ThemeProvider value={navTheme}>
      <OfflineBanner />
      {/*
        The screen taxonomy (W2-05). Every route is one of four kinds and gets that kind's
        transition — there is no per-screen choice to make:
          Root         the tab bar                          fade
          Push         drill-down from where you were       slide from right, swipe back
          Create/Edit  a task you finish and dismiss        native modal, drag down to dismiss
          Flow         a linear sequence (auth, group)      slide from right, no swipe back mid-flow
        Pickers and keypads are Sheets, not routes.
      */}
      <Stack screenOptions={{ ...PUSH, contentStyle: { backgroundColor: bgColor } }}>
        <Stack.Screen name="(tabs)"              options={ROOT} />

        {PUSH_SCREENS.map(name => <Stack.Screen key={name} name={name} options={PUSH} />)}
        {EDIT_SCREENS.map(name => <Stack.Screen key={name} name={name} options={EDIT} />)}
        {FLOW_SCREENS.map(name => <Stack.Screen key={name} name={name} options={FLOW} />)}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Before the saved theme override resolves this follows the phone; ThemeProvider then tells
  // `Appearance` about any forced mode, so this re-renders to match (W2-15).
  const colorScheme = useColorScheme();
  const bgColor = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bgColor }}>
      <ErrorBoundary>
        <AppThemeProvider>
          <PreferencesProvider>
            <LanguageProvider>
              <AuthProvider>
                {/* Hosts every <Sheet> (components/ui) — one provider, mounted once, above the navigator. */}
                <BottomSheetModalProvider>
                  <RootLayoutNav />
                </BottomSheetModalProvider>
              </AuthProvider>
            </LanguageProvider>
          </PreferencesProvider>
        </AppThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconWrap: {
    width: 76, height: 76, borderRadius: radius.lg,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
  },
});
