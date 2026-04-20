import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, Share, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentGroup } from '@/src/services/groupApi';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];
  
  const [group, setGroup] = useState<any>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  useEffect(() => {
    fetchGroupDetails();
  }, []);

  const fetchGroupDetails = async () => {
    try {
      const data = await getCurrentGroup();
      setGroup(data);
    } catch (error) {
      console.error('Error fetching group:', error);
    } finally {
      setLoadingGroup(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout.');
            }
          }
        },
      ]
    );
  };

  const handleShareInvite = async () => {
    if (!group?.inviteCode) return;
    try {
      await Share.share({
        message: `Join my expense tracker group! Use this code to join: ${group.inviteCode}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share the code');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>Settings</ThemedText>
        </ThemedView>

        {/* 1. User Details */}
        <ThemedView style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
            <ThemedText style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
            </ThemedText>
            </View>
            <View style={styles.profileInfo}>
            <ThemedText type="defaultSemiBold" style={styles.userName}>{user?.name || 'User'}</ThemedText>
            <ThemedText style={styles.userEmail}>{user?.email || 'email@example.com'}</ThemedText>
            </View>
        </ThemedView>

        <ThemedText style={styles.sectionLabel}>Group Management</ThemedText>

        {/* 2. Switch Group */}
        <TouchableOpacity 
            style={[styles.menuItem, { marginBottom: 16 }]} 
            onPress={() => router.push('/manage-group')}
        >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
            <Ionicons name="repeat-outline" size={22} color="#5856D6" />
            </View>
            <ThemedText style={styles.menuText}>Switch or Create Group</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        {/* 3. Share Active Group Card */}
        <ThemedView style={[styles.groupCard, { borderColor: theme.border }]}>
            <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: `${theme.tint}15` }]}>
                    <Ionicons name="people" size={24} color={theme.tint} />
                </View>
                <View>
                    <ThemedText type="defaultSemiBold" style={styles.groupName}>
                        {group?.name || 'Loading...'}
                    </ThemedText>
                    <ThemedText style={styles.groupMeta}>{group?.members?.length || 0} members</ThemedText>
                </View>
            </View>

            {group?.inviteCode && (
                <View style={[styles.codeSection, { backgroundColor: 'rgba(150, 150, 150, 0.05)' }]}>
                    <View>
                        <Text style={[styles.codeLabel, { color: theme.secondaryText }]}>INVITE CODE</Text>
                        <Text style={[styles.codeText, { color: theme.text }]}>{group.inviteCode}</Text>
                    </View>
                    <TouchableOpacity style={[styles.shareButton, { backgroundColor: theme.tint }]} onPress={handleShareInvite}>
                        <Ionicons name="share-social-outline" size={20} color="#FFF" />
                        <Text style={styles.shareButtonText}>Share</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ThemedView>

        {/* 4. Sign Out */}
        <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Account</ThemedText>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                    <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                </View>
                <ThemedText style={[styles.menuText, { color: '#FF3B30' }]}>Sign Out</ThemedText>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
        </ThemedView>

        <View style={styles.footer}>
            <ThemedText style={styles.versionText}>Expense Tracker v1.1.0</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 24,
    marginBottom: 32,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.6,
  },
  section: {
    gap: 12,
    marginTop: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 12,
  },
  groupCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.03)',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 17,
  },
  groupMeta: {
    fontSize: 12,
    opacity: 0.5,
  },
  codeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderRadius: 18,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    opacity: 0.3,
  },
});
