import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ActivityIndicator,
  Text, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { forgotPassword } from '@/src/services/authApi';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="lock-open-outline" size={36} color={theme.tint} />
        </View>

        <ThemedText type="title" style={styles.title}>Forgot password?</ThemedText>
        <ThemedText style={[styles.sub, { color: theme.secondaryText }]}>
          Enter the email address linked to your account and we&apos;ll send you a 6-digit code.
        </ThemedText>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: error ? '#F55345' : theme.border }]}
          placeholder="email@example.com"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={t => { setEmail(t); setError(''); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.tint }, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={theme.tintText} />
            : <Text style={[styles.btnText, { color: theme.tintText }]}>Send Code</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: theme.tint }]}>Back to login</Text>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  back:      { marginBottom: 32 },
  iconWrap:  { alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  sub:       { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  input:     { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, marginBottom: 8 },
  errorText: { color: '#F55345', fontSize: 13, marginBottom: 12 },
  btn:       { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnText:   { fontSize: 16, fontWeight: '700' },
  backLink:  { alignItems: 'center', marginTop: 28 },
  backLinkText: { fontSize: 15, fontWeight: '600' },
});
