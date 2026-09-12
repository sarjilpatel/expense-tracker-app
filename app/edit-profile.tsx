import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { getProfile, updateProfile } from '@/src/services/authApi';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Field, Touchable, Skeleton } from '@/components/ui';

export default function EditProfileScreen() {
  const { updateUser } = useAuth();
  const { theme } = useTheme();

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [photo, setPhoto]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setName(data.name);
        setEmail(data.email);
        setPhoto(data.profilePhoto || null);
      } catch {
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
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
        const fileType = match ? `image/${match[1]}` : `image`;
        formData.append('photo', { uri: photo, name: fileName, type: fileType } as any);
      }
      const updatedUser = await updateProfile(formData);
      await updateUser(updatedUser);
      Alert.alert('Success', 'Profile updated successfully', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error.toString());
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Edit profile">
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton.Group style={{ alignItems: 'center', paddingTop: space.xl }}>
          <Skeleton.Block width={120} height={120} round={radius.full} />
          <Skeleton.Block height={48} style={{ marginTop: space.xl }} />
          <Skeleton.Block height={48} />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="Edit profile" keyboard>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={S.photoSection}>
        <View style={[S.photoWrap, { borderColor: theme.border }]}>
          {photo
            ? <Image source={{ uri: photo }} style={S.photo} accessibilityLabel="Profile photo" />
            : (
              <View style={[S.photo, { backgroundColor: hexToRGBA(theme.tint, 0.12), justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={48} color={theme.tint} />
              </View>
            )}
          <Touchable onPress={pickImage} size={40} style={[S.editBadge, { backgroundColor: theme.tint, borderColor: theme.background }]} accessibilityLabel="Change photo">
            <Ionicons name="camera" size={iconSize.md} color={theme.tintText} />
          </Touchable>
        </View>
        <Text style={[type.label, { color: theme.secondaryText }]}>Tap the camera to change your photo</Text>
      </View>

      <View style={S.form}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" textContentType="name" />
        <Field label="Email" value={email} editable={false} help="Your email cannot be changed." />
        <Button label="Save changes" onPress={handleSave} loading={saving} style={{ marginTop: space.sm }} />
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  photoSection: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  photoWrap:    { width: 120, height: 120, borderRadius: radius.full, borderWidth: 2 },
  photo:        { width: 116, height: 116, borderRadius: radius.full },
  editBadge:    { position: 'absolute', right: -4, bottom: -4, width: 40, height: 40, borderRadius: radius.full, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  form:         { gap: space.md },
});
