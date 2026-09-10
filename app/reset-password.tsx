import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  Text, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { OtpInput, ResendButton } from '@/components/auth/otp-fields';
import { resetPassword, resendOtp } from '@/src/services/authApi';

function scorePassword(pw: string) {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const colors = ['#F55345', '#71717A', '#A1A1AA', '#1999FC', '#1999FC'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: s, color: colors[s] ?? '#F55345', label: labels[s] ?? 'Very weak' };
}

/**
 * Reset by code (W1-32), replacing the `reset-password/[token]` deep-link screen. The code and the
 * new password go up together — there is no half-authenticated state in between, and nothing to
 * resume if the user closes the app.
 */
export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [sendCount, setSendCount] = useState(0);

  const strength = scorePassword(password);

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
      <ThemedView style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={56} color="#1999FC" />
        </View>
        <ThemedText type="title" style={styles.title}>Password reset!</ThemedText>
        <ThemedText style={[styles.sub, { color: theme.secondaryText }]}>
          Your password has been updated, and every device that was signed in has been signed out.
          You can now log in with your new password.
        </ThemedText>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.tint }]}
          onPress={() => router.replace('/login')}
        >
          <Text style={[styles.btnText, { color: theme.tintText }]}>Go to Login</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.container}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="key-outline" size={40} color={theme.tint} />
          </View>
          <ThemedText type="title" style={styles.title}>Set new password</ThemedText>
          <ThemedText style={[styles.sub, { color: theme.secondaryText }]}>
            Enter the 6-digit code sent to <Text style={{ fontWeight: '700', color: theme.text }}>{email}</Text>,
            then choose a password you haven&apos;t used before.
          </ThemedText>

          <OtpInput value={code} onChange={c => { setCode(c); setError(''); }} invalid={!!error} />

          {/* New password */}
          <View style={[styles.inputWrap, { borderColor: theme.border, marginTop: 20 }]}>
            <TextInput
              style={[styles.inputField, { color: theme.text }]}
              placeholder="New password"
              placeholderTextColor="#A0A0A0"
              value={password}
              onChangeText={t => { setPassword(t); setError(''); }}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Strength bar */}
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {[0,1,2,3,4].map(i => (
                <View
                  key={i}
                  style={[styles.strengthSeg, { backgroundColor: i < strength.score ? strength.color : theme.border }]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          {/* Confirm */}
          <View style={[styles.inputWrap, { borderColor: theme.border, marginTop: 16 }]}>
            <TextInput
              style={[styles.inputField, { color: theme.text }]}
              placeholder="Confirm new password"
              placeholderTextColor="#A0A0A0"
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(''); }}
              secureTextEntry={!showPw}
            />
          </View>

          {!!error  && <Text style={styles.errorText}>{error}</Text>}
          {!!notice && <Text style={[styles.noticeText, { color: theme.tint }]}>{notice}</Text>}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.tint, marginTop: 20 }, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.tintText} />
              : <Text style={[styles.btnText, { color: theme.tintText }]}>Reset Password</Text>
            }
          </TouchableOpacity>

          <ResendButton onPress={handleResend} restartKey={sendCount} />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24, paddingTop: 60 },
  back:         { marginBottom: 24 },
  iconWrap:     { alignItems: 'center', marginBottom: 20 },
  title:        { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  sub:          { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, gap: 8 },
  inputField:   { flex: 1, fontSize: 16 },
  strengthRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthSeg:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 12, fontWeight: '600', marginLeft: 4 },
  errorText:    { color: '#F55345', fontSize: 13, marginTop: 8 },
  noticeText:   { fontSize: 13, marginTop: 8 },
  btn:          { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnText:      { fontSize: 16, fontWeight: '700' },
});
