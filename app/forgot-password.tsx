import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { forgotPassword } from '@/src/services/authApi';
import { space } from '@/constants/tokens';
import { Screen, Button, Field } from '@/components/ui';
import { AuthHero } from '@/components/auth/AuthHero';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      const address = email.trim().toLowerCase();
      await forgotPassword(address);
      // The reply is the same whether or not the address is registered, so this always advances —
      // an unknown address simply never receives a code.
      router.push({ pathname: '/reset-password', params: { email: address } });
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <AuthHero
        icon="lock-open-outline"
        title="Forgot password?"
        subtitle="Enter the email address linked to your account and we'll send you a 6-digit code."
      />
      <View style={S.form}>
        <Field
          label="Email"
          placeholder="email@example.com"
          value={email}
          onChangeText={t => { setEmail(t); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoFocus
          error={error || undefined}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
        <Button label="Send code" onPress={handleSubmit} loading={loading} />
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  form: { gap: space.md },
});
