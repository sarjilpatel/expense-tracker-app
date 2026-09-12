import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { signupUser } from '@/src/services/authApi';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type } from '@/constants/tokens';
import { Screen, Button, Field, Touchable } from '@/components/ui';
import { AuthHero } from '@/components/auth/AuthHero';

// Google sign-in is hidden (W1-31). `googleAuthLogin` in authApi and `POST /api/auth/google` remain
// — only the button is gone, so bringing it back is re-adding the button and the
// `expo-auth-session` wiring, not rebuilding the flow.

function passwordStrength(pw: string): { score: number; label: string; tone: 'expense' | 'neutral' | 'income' } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak',   tone: 'expense' };
  if (score <= 3) return { score, label: 'Fair',   tone: 'neutral' };
  return              { score, label: 'Strong', tone: 'income'  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const { enterGuestMode } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const strength = passwordStrength(password);
  const strengthColor = { expense: theme.expense, neutral: theme.secondaryText, income: theme.income }[strength.tone];

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim())               e.name     = 'Name is required';
    if (!EMAIL_RE.test(email))      e.email    = 'Enter a valid email address';
    if (password.length < 8)        e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuestMode = () => {
    enterGuestMode();
    router.replace('/(tabs)');
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // No account and no session yet (W1-32) — the server holds all of this against a mailed
      // code, and the verify screen is where it becomes real. It gets the address rather than the
      // whole form because the server already has the rest.
      await signupUser({ name, email, password, timezone });
      router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase() } });
    } catch (error: any) {
      Alert.alert('Signup Failed', typeof error === 'string' ? error : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen onBack={false} keyboard>
      <AuthHero title="Create account" subtitle="Start tracking your expenses" />

      <View style={S.form}>
        <Field
          label="Name"
          placeholder="Your name"
          value={name}
          onChangeText={t => { setName(t); if (errors.name) setErrors(e => ({ ...e, name: undefined })); }}
          autoCapitalize="words"
          textContentType="name"
          error={errors.name}
          returnKeyType="next"
        />
        <Field
          label="Email"
          placeholder="email@example.com"
          value={email}
          onChangeText={t => { setEmail(t); if (errors.email) setErrors(e => ({ ...e, email: undefined })); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          returnKeyType="next"
        />
        <Field
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={t => { setPassword(t); if (errors.password) setErrors(e => ({ ...e, password: undefined })); }}
          secureTextEntry
          textContentType="newPassword"
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={handleSignup}
        />
        {password.length > 0 && (
          <View style={S.strengthRow} accessibilityLabel={`Password strength ${strength.label}`}>
            <View style={S.strengthBar}>
              {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[S.strengthSegment, { backgroundColor: i <= strength.score ? strengthColor : theme.border }]} />
              ))}
            </View>
            <Text style={[type.label, { color: strengthColor }]}>{strength.label}</Text>
          </View>
        )}
        <Button label="Get started" onPress={handleSignup} loading={loading} style={{ marginTop: space.xs }} />
      </View>

      <View style={S.dividerRow}>
        <View style={[S.divider, { backgroundColor: theme.border }]} />
        <Text style={[type.label, { color: theme.secondaryText }]}>or</Text>
        <View style={[S.divider, { backgroundColor: theme.border }]} />
      </View>

      <Button label="Continue as guest" icon="person-outline" variant="secondary" onPress={handleGuestMode} />

      <View style={S.footer}>
        <Text style={[type.body, { color: theme.secondaryText }]}>Already have an account? </Text>
        <Touchable onPress={() => router.replace('/login')} haptic="none" accessibilityLabel="Log in">
          <Text style={[type.bodyStrong, { color: theme.tint }]}>Log in</Text>
        </Touchable>
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  form:            { gap: space.md },
  strengthRow:     { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: -space.xs },
  strengthBar:     { flex: 1, flexDirection: 'row', gap: space.xs },
  strengthSegment: { flex: 1, height: 4, borderRadius: radius.full },
  dividerRow:      { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl },
  divider:         { flex: 1, height: StyleSheet.hairlineWidth },
  footer:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xxl },
});
