import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/context/AuthContext';
import { createGroup, joinGroup } from '@/src/services/groupApi';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GroupSetupScreen() {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  
  const { updateUser } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const handleCreate = async () => {
    if (!groupName.trim()) return Alert.alert('Error', 'Please enter a group name');
    setLoading(true);
    try {
      const group = await createGroup(groupName);
      if (group && group._id) {
        await updateUser({ groupId: group._id });
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Error', error.toString() || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return Alert.alert('Error', 'Please enter an invite code');
    setLoading(true);
    try {
      const group = await joinGroup(inviteCode.trim().toUpperCase());
      if (group && group._id) {
        await updateUser({ groupId: group._id });
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Error', error.toString() || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
            <View style={[styles.logo, { backgroundColor: theme.tint }]}>
                <ThemedText style={styles.logoText}>₹</ThemedText>
            </View>
          <ThemedText type="title" style={styles.title}>Group Access</ThemedText>
          <ThemedText style={styles.subtitle}>Collaborate with your family or team</ThemedText>
        </ThemedView>

        <View style={[styles.tabContainer, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
          <TouchableOpacity 
            style={[styles.tab, mode === 'create' && { backgroundColor: theme.tint }]} 
            onPress={() => setMode('create')}
          >
            <ThemedText style={[styles.tabText, mode === 'create' && styles.activeTabText]}>Create</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, mode === 'join' && { backgroundColor: theme.tint }]} 
            onPress={() => setMode('join')}
          >
            <ThemedText style={[styles.tabText, mode === 'join' && styles.activeTabText]}>Join</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedView style={[styles.card, { borderColor: theme.border }]}>
          {mode === 'create' ? (
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>New Group Name</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. My Family"
                  placeholderTextColor="#A0A0A0"
                  value={groupName}
                  onChangeText={setGroupName}
                />
              </View>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Setup Group</ThemedText>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>Invite Code</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Enter code"
                  placeholderTextColor="#A0A0A0"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} onPress={handleJoin} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Join Group</ThemedText>}
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  logo: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  header: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 16, opacity: 0.6, textAlign: 'center' },
  tabContainer: { flexDirection: 'row', marginBottom: 24, borderRadius: 14, padding: 6 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabText: { fontWeight: '700', fontSize: 14 },
  activeTabText: { color: '#FFF' },
  card: { padding: 20, backgroundColor: 'rgba(150, 150, 150, 0.03)', borderRadius: 24, borderWidth: 1 },
  form: { gap: 20 },
  inputWrapper: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  input: { height: 56, backgroundColor: 'rgba(150, 150, 150, 0.05)', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, borderWidth: 1 },
  button: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#5856D6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
