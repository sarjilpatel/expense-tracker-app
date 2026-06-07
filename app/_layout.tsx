import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View, StyleSheet, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { PreferencesProvider } from '@/src/context/PreferencesContext';
import { ThemeProvider as AppThemeProvider } from '@/src/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import apiClient from '@/src/services/apiClient';
import { LanguageProvider } from '@/src/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SyncModal } from '@/components/SyncModal';
import { hasPendingLocalData } from '@/src/services/syncService';
import LockScreen from '@/app/lock';
import { shouldLock, recordBackground, clearBackgroundTime } from '@/src/services/lockService';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, isGuest, logout } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  const [showSync, setShowSync] = useState(false);
  const [locked, setLocked]     = useState(false);
  const prevIsGuest = useRef<boolean | null>(null);

  // Inject logout into apiClient for 401 handling
  useEffect(() => {
    apiClient.injectLogout(logout);
  }, [logout]);

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

  // Show sync modal when transitioning from guest → logged-in with pending local data
  useEffect(() => {
    if (loading) return;
    if (prevIsGuest.current === true && !isGuest && user) {
      hasPendingLocalData().then(has => {
        if (has) setShowSync(true);
      });
    }
    prevIsGuest.current = isGuest;
  }, [isGuest, loading, user]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (user && inAuthGroup) {
      // Logged-in user landed on auth screen → push to tabs
      router.replace('/(tabs)');
    }
    // No forced redirects for guests — they go directly to tabs

    SplashScreen.hideAsync();
  }, [user, loading, segments, router]);

  if (loading) {
    const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;
    return (
      <View style={[loadingStyles.container, { backgroundColor: bg }]}>
        <View style={loadingStyles.iconWrap}>
          <Ionicons name="wallet" size={38} color="#FFF" />
        </View>
        <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 28 }} />
      </View>
    );
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ animation: 'ios' }}>
        <Stack.Screen name="login"              options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="signup"             options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="group-setup"        options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="manage-group"       options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="(tabs)"             options={{ headerShown: false, animation: 'fade'              }} />
        <Stack.Screen name="settings/customization" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="edit-transaction"   options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="budget"             options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="add-budget"         options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="add-account"        options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="add-transfer"       options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="search"             options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="account-detail"     options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="manage-categories"  options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="import-categories"  options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="edit-profile"       options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="modal"              options={{ presentation: 'modal', title: 'Modal'              }} />
      </Stack>
      <StatusBar style="auto" />
      <SyncModal visible={showSync} onDone={() => setShowSync(false)} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AppThemeProvider>
          <PreferencesProvider>
            <LanguageProvider>
              <AuthProvider>
                <RootLayoutNav />
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
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
  },
});
