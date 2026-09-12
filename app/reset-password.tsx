import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { OtpInput, ResendButton } from '@/components/auth/otp-fields';
import { AuthHero } from '@/components/auth/AuthHero';
import { resetPassword, resendOtp } from '@/src/services/authApi';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Field, Touchable, EmptyState } from '@/components/ui';

function scorePassword(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: s, label: labels[s] ?? 'Very weak' };
}

/**
 * Reset by code (W1-32), replacing the `reset-password/[token]` deep-link screen. The code and the
 * new password go up together — there is no half-authenticated state in between, and nothing to
 * resume if the user closes the app.
 */
export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode]           = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');
  const [sendCount, setSendCount] = useState(0);

  const strength = scorePassword(password);
  const strengthColor = strength.score <= 1 ? theme.expense : strength.score <= 2 ? theme.secondaryText : theme.income;

  const handleSubmit = async () => {
    if (code.length !== 6)     { setError('Enter the 6-digit code.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await resetPassword(String(email), code, password);
      setDone(true);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'That code is not right.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await resendOtp(String(email), 'reset');
      setNotice('A new code is on its way.');
      setCode('');
      setSendCount(n => n + 1);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Failed to resend the code.');
    }
  };

  if (done) {
    return (
      <Screen onBack={false}>
        <EmptyState
          icon="checkmark-circle"
          title="Password reset"
          body="Your password has been updated, and every device that was signed in has been signed out. You can now log in with your new password."
          action={{ label: 'Log in', onPress: () => router.replace('/login') }}
        />
      </Screen>
    );
  }

  const eye = (
    <Touchable onPress={() => setShowPw(v => !v)} haptic="selection" size={32} accessibilityLabel={showPw ? 'Hide password' : 'Show password'} rippleBorderless>
      <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={iconSize.md} color={theme.secondaryText} />
    </Touchable>
  );

  return (
    <Screen keyboard>
      <AuthHero icon="key-outline" title="Reset password" />
      <Text style={[type.body, S.sub, { color: theme.secondaryText }]}>
        Enter the 6-digit code we sent to <Text style={{ color: theme.text, fontWeight: '600' }}>{email}</Text> and choose a new password.
      </Text>

      <OtpInput value={code} onChange={c => { setCode(c); setError(''); }} invalid={!!error} />

      <View style={S.form}>
        <Field
          label="New password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={t => { setPassword(t); setError(''); }}
          secureTextEntry={!showPw}
          textContentType="newPassword"
          right={eye}
        />
        {password.length > 0 && (
          <View style={S.strengthRow} accessibilityLabel={`Password strength ${strength.label}`}>
            <View style={S.strengthBar}>
              {[0, 1, 2, 3, 4].map(i => (
                <View key={i} style={[S.strengthSeg, { backgroundColor: i < strength.score ? strengthColor : theme.border }]} />
              ))}
            </View>
            <Text style={[type.label, { color: strengthColor }]}>{strength.label}</Text>
          </View>
        )}
        <Field
          label="Confirm password"
          placeholder="Type it again"
          value={confirm}
          onChangeText={t => { setConfirm(t); setError(''); }}
          secureTextEntry={!showPw}
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {!!error  && <Text style={[type.label, { color: theme.danger }]}>{error}</Text>}
        {!!notice && <Text style={[type.label, { color: theme.tint }]}>{notice}</Text>}
        <Button label="Reset password" onPress={handleSubmit} loading={loading} style={{ marginTop: space.xs }} />
      </View>

      <ResendButton onPress={handleResend} restartKey={sendCount} />
    </Screen>
  );
}

const S = StyleSheet.create({
  sub:         { textAlign: 'center', marginTop: -space.md, marginBottom: space.xl, paddingHorizontal: space.lg },
  form:        { gap: space.md, marginTop: space.xl },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: -space.xs },
  strengthBar: { flex: 1, flexDirection: 'row', gap: space.xs },
  strengthSeg: { flex: 1, height: 4, borderRadius: radius.full },
});
