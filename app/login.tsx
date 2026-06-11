import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/context/AuthContext';
import { loginUser, googleAuthLogin } from '@/src/services/authApi';
import { useTheme } from '@/src/context/ThemeContext';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ENABLED = !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID);

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, enterGuestMode } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:        GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    scopes:          ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) handleGoogleAuth(idToken);
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In', response.error?.message || 'Sign-in was cancelled.');
    }
  }, [response]);

  const handleGoogleAuth = async (idToken: string) => {
    setLoading(true);
    try {
      const data = await googleAuthLogin(idToken);
      if (data?.token && data?.user) {
        await login(data.token, data.user, data.refreshToken);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Google Sign-In Failed', typeof error === 'string' ? error : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    enterGuestMode();
    router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(email, password);
      if (data && data.token && data.user) {
        await login(data.token, data.user, data.refreshToken);
        router.replace('/(tabs)');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', typeof error === 'string' ? error : 'Check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <View style={[styles.logo, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.logoText}>₹</ThemedText>
            </View>
            <ThemedText type="title" style={styles.title}>Expense Tracker</ThemedText>
            <ThemedText style={styles.subtitle}>Sign in to your account</ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="email@example.com"
                placeholderTextColor="#A0A0A0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </ThemedView>

            <ThemedView style={styles.inputWrapper}>
              <View style={styles.pwLabelRow}>
                <ThemedText style={styles.label}>Password</ThemedText>
                <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                  <Text style={[styles.forgotLink, { color: theme.tint }]}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="••••••••"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </ThemedView>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.buttonText}>Log In</ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.secondaryText }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          </View>

          {GOOGLE_ENABLED && (
            <TouchableOpacity
              style={[styles.socialBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => promptAsync()}
              disabled={!request || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={[styles.socialBtnText, { color: theme.text }]}>Continue with Google</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.guestBtn, { borderColor: theme.border }, GOOGLE_ENABLED && { marginTop: 10 }]}
            onPress={handleGuestMode}
          >
            <Ionicons name="person-outline" size={18} color={theme.secondaryText} />
            <Text style={[styles.guestText, { color: theme.secondaryText }]}>Continue as Guest</Text>
          </TouchableOpacity>

          <ThemedView style={styles.footer}>
            <ThemedText>Don&apos;t have an account? </ThemedText>
            <TouchableOpacity onPress={() => router.replace('/signup')}>
              <ThemedText style={[styles.link, { color: theme.tint }]}>Sign Up</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  pwLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotLink:  { fontSize: 13, fontWeight: '600' },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, gap: 12 },
  divider:     { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  socialBtn: {
    height: 52, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  googleG:      { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  socialBtnText:{ fontSize: 15, fontWeight: '600' },
  guestBtn: {
    height: 52, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 0,
  },
  guestText: { fontSize: 15, fontWeight: '600' },
  footer:    { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  link:      { fontWeight: 'bold' },
});
