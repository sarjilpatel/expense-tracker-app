import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';

interface Props {
  user: any;
  tintColor: string;
}

export function ProfileSection({ user, tintColor }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.avatar, { backgroundColor: tintColor }]}>
        {user?.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.avatarImg} />
        ) : (
          <ThemedText style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</ThemedText>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="subtitle">{user?.name || 'User'}</ThemedText>
        <ThemedText style={styles.email}>{user?.email || ''}</ThemedText>
      </View>
      <TouchableOpacity
        style={[styles.editBtn, { backgroundColor: `${tintColor}10` }]}
        onPress={() => router.push('/edit-profile')}
      >
        <Ionicons name="pencil" size={18} color={tintColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
    backgroundColor: 'rgba(150,150,150,0.05)',
    padding: 24,
    borderRadius: 24,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 13,
    opacity: 0.5,
  },
});
