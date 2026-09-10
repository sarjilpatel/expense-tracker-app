import React, { useState } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator, Text, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { OtpInput, ResendButton } from '@/components/auth/otp-fields';
import { verifySignup, resendOtp } from '@/src/services/authApi';

/**
 * Step two of signup (W1-32). The account does not exist yet — this code is what creates it, which
 * is why this screen returns the tokens and lands the user in the app.
 *
 * The signup endpoint answers the same way for an address that is already registered, so a user
 * who forgot they had an account arrives here and waits for a mail that will never come. The
 * "already have an account?" link is the way out of that, and it is deliberately prominent.
 */
export default function VerifyEmailScreen() {
  const { theme } = useTheme();
  const { login }  = useAuth();
  const { email }  = useLocalSearchParams<{ email: string }>();

  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [sendCount, setSendCount] = useState(0);

  const handleVerify = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const data = await verifySignup(String(email), code);
      if (data?.token && data?.user) {
        await login(data.token, data.user, data.refreshToken);
        router.replace('/(tabs)');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'That code is not right.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      await resendOtp(String(email), 'signup');
      setNotice('A new code is on its way.');
      setCode('');
      setSendCount(n => n + 1);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Failed to resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={40} color={theme.tint} />
        </View>

        <ThemedText type="title" style={styles.title}>Check your email</ThemedText>
        <ThemedText style={[styles.sub, { color: theme.secondaryText }]}>
          We sent a 6-digit code to <Text style={{ fontWeight: '700', color: theme.text }}>{email}</Text>.
          It expires in 10 minutes.
        </ThemedText>

        <OtpInput value={code} onChange={c => { setCode(c); setError(''); }} onSubmitEditing={handleVerify} invalid={!!error} />
        {!!error  && <Text style={styles.errorText}>{error}</Text>}
        {!!notice && <Text style={[styles.noticeText, { color: theme.tint }]}>{notice}</Text>}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.tint }, (loading || code.length !== 6) && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading
            ? <ActivityIndicator color={theme.tintText} />
            : <Text style={[styles.btnText, { color: theme.tintText }]}>Verify & Continue</Text>}
        </TouchableOpacity>

        <ResendButton onPress={handleResend} restartKey={sendCount} disabled={resending} />

        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.secondaryText }]}>
            Already have an account? <Text style={{ color: theme.tint, fontWeight: '700' }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: 24, paddingTop: 60 },
  back:       { marginBottom: 24 },
  iconWrap:   { alignItems: 'center', marginBottom: 20 },
  title:      { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  sub:        { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  errorText:  { color: '#F55345', fontSize: 13, marginTop: 10 },
  noticeText: { fontSize: 13, marginTop: 10 },
  btn:        { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnText:    { fontSize: 16, fontWeight: '700' },
  footer:     { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  footerText: { fontSize: 15 },
});
