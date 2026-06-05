import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import apiClient from '@/src/services/apiClient';
import { LanguageProvider } from '@/src/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Inject logout into apiClient for 401 handling
  useEffect(() => {
    apiClient.injectLogout(logout);
  }, [logout]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inGroupSetup = segments[0] === 'group-setup';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated and not already on an auth screen
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to main app if authenticated and trying to access auth screens
      router.replace('/(tabs)');
    } else if (user && !user.groupId && !inGroupSetup) {
      // Redirect to group setup if authenticated but not in a group
      router.replace('/group-setup');
    } else if (user && user.groupId && inGroupSetup) {
      // Redirect to main app if already in a group
      router.replace('/(tabs)');
    }

    // Hide the splash screen once auth is determined and redirection is handled
    SplashScreen.hideAsync();
  }, [user, loading, segments, router]);

  if (loading) {
    const bg = colorScheme === 'dark' ? '#0F172A' : '#F8FAFC';
    return (
      <View style={[loadingStyles.container, { backgroundColor: bg }]}>
        <View style={loadingStyles.iconWrap}>
          <Ionicons name="wallet" size={38} color="#FFF" />
        </View>
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ animation: 'ios' }}>
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="group-setup" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="manage-group" options={{ presentation: 'modal', title: 'Group Settings' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="edit-transaction" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="manage-categories" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="import-categories" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
});
