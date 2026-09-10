import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ActivityIndicator,
  Text, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { resetPassword } from '@/src/services/authApi';

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

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  const strength = scorePassword(password);

  const handleSubmit = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!token) { setError('Invalid reset link.'); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(token as string, password);
      setDone(true);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Reset link may have expired. Request a new one.');
    } finally {
      setLoading(false);
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
          Your password has been updated. You can now log in with your new password.
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
      <ThemedView style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={40} color={theme.tint} />
        </View>
        <ThemedText type="title" style={styles.title}>Set new password</ThemedText>
        <ThemedText style={[styles.sub, { color: theme.secondaryText }]}>
          Choose a strong password you haven't used before.
        </ThemedText>

        {/* New password */}
        <View style={[styles.inputWrap, { borderColor: theme.border }]}>
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

        {!!error && <Text style={styles.errorText}>{error}</Text>}

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
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24, paddingTop: 60 },
  iconWrap:     { alignItems: 'center', marginBottom: 20 },
  title:        { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  sub:          { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, gap: 8 },
  inputField:   { flex: 1, fontSize: 16 },
  strengthRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthSeg:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 12, fontWeight: '600', marginLeft: 4 },
  errorText:    { color: '#F55345', fontSize: 13, marginTop: 8 },
  btn:          { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnText:      { fontSize: 16, fontWeight: '700' },
});
