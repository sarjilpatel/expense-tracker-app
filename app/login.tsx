import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { loginUser } from '@/src/services/authApi';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type } from '@/constants/tokens';
import { Screen, Button, Field, Touchable } from '@/components/ui';
import { AuthHero } from '@/components/auth/AuthHero';

import { reportError } from '@/src/utils/log';
// Google sign-in is hidden (W1-31). `googleAuthLogin` in authApi and `POST /api/auth/google` remain
// — only the button is gone, so bringing it back is re-adding the button and the
// `expo-auth-session` wiring, not rebuilding the flow.

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, enterGuestMode } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

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
      reportError('Login error:', error);
      Alert.alert('Login Failed', typeof error === 'string' ? error : 'Check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen onBack={false} keyboard>
      <AuthHero title="WatchMyWallet" subtitle="Sign in to your account" />

      <View style={S.form}>
        <Field
          label="Email"
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <Field
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
        <Touchable onPress={() => router.push('/forgot-password')} haptic="none" style={S.forgot} accessibilityLabel="Forgot password">
          <Text style={[type.label, { color: theme.tint }]}>Forgot password?</Text>
        </Touchable>
        <Button label="Log in" onPress={handleLogin} loading={loading} />
      </View>

      <View style={S.dividerRow}>
        <View style={[S.divider, { backgroundColor: theme.border }]} />
        <Text style={[type.label, { color: theme.secondaryText }]}>or</Text>
        <View style={[S.divider, { backgroundColor: theme.border }]} />
      </View>

      <Button label="Continue as guest" icon="person-outline" variant="secondary" onPress={handleGuestMode} />

      <View style={S.footer}>
        <Text style={[type.body, { color: theme.secondaryText }]}>Don&apos;t have an account? </Text>
        <Touchable onPress={() => router.replace('/signup')} haptic="none" accessibilityLabel="Sign up">
          <Text style={[type.bodyStrong, { color: theme.tint }]}>Sign up</Text>
        </Touchable>
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  form:       { gap: space.md },
  forgot:     { alignSelf: 'flex-end', paddingVertical: space.xs, marginTop: -space.xs },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl },
  divider:    { flex: 1, height: StyleSheet.hairlineWidth },
  footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xxl },
});
