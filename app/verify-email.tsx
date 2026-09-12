import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { OtpInput, ResendButton } from '@/components/auth/otp-fields';
import { AuthHero } from '@/components/auth/AuthHero';
import { verifySignup, resendOtp } from '@/src/services/authApi';
import { space, type, weight } from '@/constants/tokens';
import { Screen, Button, Touchable } from '@/components/ui';

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

  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');
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
    <Screen keyboard>
      <AuthHero icon="mail-unread-outline" title="Check your email" />
      <Text style={[type.body, S.sub, { color: theme.secondaryText }]}>
        We sent a 6-digit code to <Text style={{ color: theme.text, fontWeight: weight.semibold }}>{email}</Text>. It expires in 10 minutes.
      </Text>

      <OtpInput value={code} onChange={c => { setCode(c); setError(''); }} onSubmitEditing={handleVerify} invalid={!!error} />
      {!!error  && <Text style={[type.label, S.msg, { color: theme.danger }]}>{error}</Text>}
      {!!notice && <Text style={[type.label, S.msg, { color: theme.tint }]}>{notice}</Text>}

      <Button label="Verify & continue" onPress={handleVerify} loading={loading} disabled={code.length !== 6} style={{ marginTop: space.xl }} />
      <ResendButton onPress={handleResend} restartKey={sendCount} disabled={resending} />

      <Touchable onPress={() => router.replace('/login')} haptic="none" style={S.footer} accessibilityLabel="Already have an account? Log in">
        <Text style={[type.body, { color: theme.secondaryText }]}>
          Already have an account? <Text style={{ color: theme.tint, fontWeight: weight.semibold }}>Log in</Text>
        </Text>
      </Touchable>
    </Screen>
  );
}

const S = StyleSheet.create({
  sub:    { textAlign: 'center', marginTop: -space.md, marginBottom: space.xl, paddingHorizontal: space.lg },
  msg:    { marginTop: space.sm, textAlign: 'center' },
  footer: { alignSelf: 'center', marginTop: space.xxl, paddingVertical: space.sm },
});
