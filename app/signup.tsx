import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/context/AuthContext';
import { signupUser } from '@/src/services/authApi';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const data = await signupUser({ name, email, password });
      if (data && data.token && data.user) {
        await login(data.token, data.user);
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
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Your Name"
                placeholderTextColor="#A0A0A0"
                value={name}
                onChangeText={setName}
              />
            </ThemedView>

            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Email Address</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="email@example.com"
                placeholderTextColor="#A0A0A0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </ThemedView>

            <ThemedView style={styles.inputWrapper}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="••••••••"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </ThemedView>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} 
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Get Started</ThemedText>}
            </TouchableOpacity>
          </ThemedView>

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
  subtitle: { fontSize: 16, opacity: 0.6 },
  form: { gap: 20 },
  inputWrapper: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', opacity: 0.8 },
  input: { height: 56, backgroundColor: 'rgba(150, 150, 150, 0.05)', borderRadius: 16, paddingHorizontal: 16, borderSize: 1, borderWidth: 1 },
  button: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#5856D6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  link: { fontWeight: 'bold' }
});
