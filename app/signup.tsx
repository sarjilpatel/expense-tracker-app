import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/context/AuthContext';
import { signupUser } from '@/src/services/authApi';
import { useTheme } from '@/src/context/ThemeContext';

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: '#EF4444' };
  if (score <= 3) return { score, label: 'Fair',   color: '#F59E0B' };
  return              { score, label: 'Strong', color: '#22C55E' };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const { login, enterGuestMode } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const strength = passwordStrength(password);

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
      const data = await signupUser({ name, email, password, timezone });
      if (data && data.token && data.user) {
        await login(data.token, data.user, data.refreshToken);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Signup Failed', typeof error === 'string' ? error : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <View style={[styles.logo, { backgroundColor: theme.tint }]}>
                <ThemedText style={styles.logoText}>₹</ThemedText>
            </View>
            <ThemedText type="title" style={styles.title}>Join Us</ThemedText>
            <ThemedText style={styles.subtitle}>Take control of your finances</ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Full Name</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: errors.name ? '#EF4444' : theme.border }]}
                placeholder="Your Name"
                placeholderTextColor="#A0A0A0"
                value={name}
                onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
              />
              {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
            </ThemedView>

            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Email Address</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: errors.email ? '#EF4444' : theme.border }]}
                placeholder="email@example.com"
                placeholderTextColor="#A0A0A0"
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: undefined })); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
            </ThemedView>

            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: errors.password ? '#EF4444' : theme.border }]}
                placeholder="Min. 8 characters"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: undefined })); }}
                secureTextEntry
              />
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBar}>
                    {[1,2,3,4,5].map(i => (
                      <View
                        key={i}
                        style={[styles.strengthSegment, { backgroundColor: i <= strength.score ? strength.color : theme.border }]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </ThemedView>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} 
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Get Started</ThemedText>}
            </TouchableOpacity>
          </ThemedView>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.secondaryText }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.guestBtn, { borderColor: theme.border }]}
            onPress={handleGuestMode}
          >
            <Ionicons name="person-outline" size={18} color={theme.secondaryText} />
            <Text style={[styles.guestText, { color: theme.secondaryText }]}>Continue as Guest</Text>
          </TouchableOpacity>

          <ThemedView style={styles.footer}>
            <ThemedText>Already have an account? </ThemedText>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <ThemedText style={[styles.link, { color: theme.tint }]}>Log In</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  logo: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoText: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  form: { gap: 20 },
  inputWrapper: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { height: 56, backgroundColor: 'transparent', borderRadius: 16, paddingHorizontal: 16, borderSize: 1, borderWidth: 1 },
  button: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, gap: 12 },
  divider:     { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  guestBtn: {
    height: 52, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  guestText: { fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  link: { fontWeight: 'bold' },
  fieldError:      { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2 },
  strengthRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBar:     { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:   { fontSize: 12, fontWeight: '700', width: 46, textAlign: 'right' },
});
