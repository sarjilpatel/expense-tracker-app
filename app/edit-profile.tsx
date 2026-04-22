import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getProfile, updateProfile } from '@/src/services/authApi';
import { router, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';

export default function EditProfileScreen() {
  const { t } = useLanguage();
  const { updateUser } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setName(data.name);
      setEmail(data.email);
      setPhoto(data.profilePhoto || null);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      
      if (photo && !photo.startsWith('http')) {
        const fileName = photo.split('/').pop();
        const match = /\.(\w+)$/.exec(fileName || '');
        const type = match ? `image/${match[1]}` : `image`;
        
        formData.append('photo', {
          uri: photo,
          name: fileName,
          type,
        } as any);
      }

      const updatedUser = await updateProfile(formData);
      await updateUser(updatedUser);
      Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.toString());
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={theme.tint} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Profile', headerShadowVisible: false }} />
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.photoSection}>
            <View style={[styles.photoWrapper, { borderColor: theme.border }]}>
               {photo ? (
                 <Image source={{ uri: photo }} style={styles.photo} />
               ) : (
                 <View style={[styles.placeholder, { backgroundColor: `${theme.tint}10` }]}>
                    <Ionicons name="person" size={50} color={theme.tint} />
                 </View>
               )}
               <TouchableOpacity style={[styles.editBadge, { backgroundColor: theme.tint }]} onPress={pickImage}>
                  <Ionicons name="camera" size={20} color="#FFF" />
               </TouchableOpacity>
            </View>
            <ThemedText style={styles.photoHint}>Tap the camera to change photo</ThemedText>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>{t('name')}</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'rgba(150,150,150,0.05)' }]}
                value={name}
                onChangeText={setName}
                placeholder="Your Name"
                placeholderTextColor="#A0A0A0"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Email (Read-only)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'rgba(150,150,150,0.02)', opacity: 0.5 }]}
                value={email}
                editable={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.tint }, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, alignItems: 'center' },
  photoSection: { alignItems: 'center', marginBottom: 40 },
  photoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    padding: 4,
    position: 'relative',
  },
  photo: { width: '100%', height: '100%', borderRadius: 66 },
  placeholder: { width: '100%', height: '100%', borderRadius: 66, justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'absolute',
    bottom: -5,
    right: -5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  photoHint: { marginTop: 16, fontSize: 13, opacity: 0.5 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 },
  input: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' },
  saveBtn: { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
