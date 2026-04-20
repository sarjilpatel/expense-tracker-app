import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import apiClient from '@/src/services/apiClient';

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
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="group-setup" options={{ headerShown: false }} />
        <Stack.Screen name="manage-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
