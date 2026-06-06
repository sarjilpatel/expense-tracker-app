import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import apiClient from '@/src/services/apiClient';

interface Props {
  user: any;
  tintColor: string;
}

export function ProfileSection({ user, tintColor }: Props) {
  const { theme }        = useTheme();
  const { logout }       = useAuth();

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/auth/account');
              await logout();
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      {/* Avatar + name row */}
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: tintColor }]}>
          {user?.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.avatarImg} />
          ) : (
            <ThemedText style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</ThemedText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">{user?.name || 'User'}</ThemedText>
          <Text style={[styles.email, { color: theme.secondaryText }]}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: tintColor }]}
          onPress={() => router.push('/edit-profile')}
        >
          <Ionicons name="pencil" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Delete account */}
      <TouchableOpacity
        style={[styles.deleteRow, { borderTopColor: theme.separator }]}
        onPress={handleDeleteAccount}
        activeOpacity={0.7}
      >
        <Ionicons name="person-remove-outline" size={16} color={theme.danger} />
        <Text style={[styles.deleteText, { color: theme.danger }]}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg:  { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  editBtn:    { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  email:      { fontSize: 13, marginTop: 2 },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteText: { fontSize: 14, fontWeight: '600' },
});
