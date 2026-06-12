import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { getProfile, deleteAccount as deleteAccountApi, cancelAccountDeletion } from '@/src/services/authApi';
import { getLastSyncTime } from '@/src/services/syncService';
import { TYPE_SCALE } from '@/constants/theme';

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (hrs < 48)  return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const GRID_TILES = [
  { key: 'customize',  label: 'Customize',  sub: 'Theme, colors, language',  icon: 'color-palette-outline',      route: '/settings/customization', color: '#6366F1' },
  { key: 'money',      label: 'Money',      sub: 'Budget, goals, splits',    icon: 'wallet-outline',             route: '/settings/money',         color: '#10B981' },
  { key: 'categories', label: 'Categories', sub: 'Income & expense types',   icon: 'grid-outline',               route: '/manage-categories',      color: '#F59E0B' },
  { key: 'security',   label: 'Security',   sub: 'PIN lock, biometric',      icon: 'shield-checkmark-outline',   route: '/settings/security',      color: '#3B82F6' },
  { key: 'data',       label: 'Data',       sub: 'Backup, export, import',   icon: 'server-outline',             route: '/settings/data',          color: '#0F766E' },
  { key: 'help',       label: 'Help',       sub: 'Privacy, info, support',   icon: 'help-circle-outline',        route: '/settings/help',          color: '#71717A' },
] as const;

export default function SettingsScreen() {
  const { theme, overrides }           = useTheme();
  const { user: authUser, isGuest, logout } = useAuth();
  const { top }                        = useSafeAreaInsets();

  const [user,              setUser]              = useState<any>(null);
  const [lastSync,          setLastSync]          = useState<string | null>(null);
  const [loading,           setLoading]           = useState(!isGuest);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [deletePassword,    setDeletePassword]    = useState('');
  const [deletingAccount,   setDeletingAccount]   = useState(false);
  const [deleteError,       setDeleteError]       = useState('');

  const accentColor = overrides.tint ?? theme.tint;

  const fetchData = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      const profileData = await getProfile();
      setUser(profileData ?? null);
      getLastSyncTime().then(setLastSync).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => {
    fetchData();
  }, [fetchData]));

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(tabs)'); } },
    ]);

  const handleDeleteAccount = () => {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) { setDeleteError('Enter your password to confirm.'); return; }
    setDeletingAccount(true);
    setDeleteError('');
    try {
      const result = await deleteAccountApi(deletePassword);
      setShowDeleteModal(false);
      const scheduledDate = new Date(result.deletionScheduledAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      Alert.alert(
        'Deletion Scheduled',
        `Your account will be permanently deleted on ${scheduledDate}.\n\nYou can cancel this by tapping "Cancel Deletion" in Settings before that date.`,
        [{ text: 'OK', onPress: async () => { await logout(); router.replace('/(tabs)'); } }]
      );
    } catch (err: any) {
      setDeleteError(typeof err === 'string' ? err : 'Failed to schedule account deletion.');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>

      {/* Delete Account confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={S.deleteOverlay}>
          <View style={[S.deleteCard, { backgroundColor: theme.card }]}>
            <View style={[S.deleteIconWrap, { backgroundColor: (theme.danger ?? '#F55345') + '22' }]}>
              <Ionicons name="trash-outline" size={26} color={theme.danger ?? '#F55345'} />
            </View>
            <Text style={[S.deleteTitle, { color: theme.text }]}>Delete Account</Text>
            <Text style={[S.deleteSub, { color: theme.secondaryText }]}>
              Your account will be scheduled for deletion in 30 days. You can cancel within that window. After 30 days, all your transactions, goals, and splits are permanently removed.
            </Text>
            <TextInput
              style={[S.deleteInput, { backgroundColor: theme.cardAlt ?? theme.border, color: theme.text, borderColor: deleteError ? (theme.danger ?? '#F55345') : theme.border }]}
              placeholder="Enter your password to confirm"
              placeholderTextColor={theme.secondaryText}
              secureTextEntry
              value={deletePassword}
              onChangeText={t => { setDeletePassword(t); setDeleteError(''); }}
              autoCapitalize="none"
            />
            {!!deleteError && <Text style={[S.deleteErrorText, { color: theme.danger ?? '#F55345' }]}>{deleteError}</Text>}
            <TouchableOpacity
              style={[S.deleteConfirmBtn, { backgroundColor: theme.danger ?? '#F55345', opacity: deletingAccount ? 0.7 : 1 }]}
              onPress={confirmDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={S.deleteConfirmText}>Delete My Account</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={S.deleteCancelBtn} onPress={() => setShowDeleteModal(false)} disabled={deletingAccount}>
              <Text style={[S.deleteCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={S.header}>
        <Text style={[S.headerTitle, { color: theme.text }]}>More</Text>
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Account / Guest card ── */}
        {isGuest ? (
          <TouchableOpacity
            style={[S.guestBanner, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <View style={[S.guestIcon, { backgroundColor: accentColor }]}>
              <Ionicons name="cloud-outline" size={20} color={theme.tintText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.guestTitle, { color: theme.text }]}>Sign in to unlock cloud features</Text>
              <Text style={[S.guestSub, { color: theme.secondaryText }]}>Backup, sync & group expenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </TouchableOpacity>
        ) : (
          <>
            <View style={[S.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={S.profileRow}>
                <View style={[S.avatar, { backgroundColor: accentColor }]}>
                  {user?.profilePhoto
                    ? <Image source={{ uri: user.profilePhoto }} style={S.avatarImg} />
                    : <Text style={[S.avatarLetter, { color: theme.tintText }]}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.profileName, { color: theme.text }]}>{user?.name || 'User'}</Text>
                  <Text style={[S.profileEmail, { color: theme.secondaryText }]}>{user?.email || ''}</Text>
                </View>
                <View style={[S.syncBadge, { backgroundColor: lastSync ? '#10B98120' : theme.border }]}>
                  <View style={[S.syncDot, { backgroundColor: lastSync ? '#10B981' : theme.secondaryText }]} />
                  <Text style={[S.syncBadgeText, { color: lastSync ? '#10B981' : theme.secondaryText }]}>
                    {lastSync ? 'Synced' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7} style={S.deleteLink}>
              <Text style={[S.deleteLinkText, { color: theme.secondaryText }]}>Delete account</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── TripMaster featured card ── */}
        <TouchableOpacity
          style={[S.tripCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push('/trip-master' as any)}
          activeOpacity={0.8}
        >
          <View style={[S.tripIcon, { backgroundColor: '#8B5CF6' }]}>
            <Ionicons name="people" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={S.tripTitleRow}>
              <Text style={[S.tripTitle, { color: theme.text }]}>TripMaster</Text>
              <View style={[S.tripBadge, { backgroundColor: '#8B5CF618' }]}>
                <Text style={[S.tripBadgeText, { color: '#8B5CF6' }]}>Split bills</Text>
              </View>
            </View>
            <Text style={[S.tripSub, { color: theme.secondaryText }]}>
              Track who paid what & see who owes whom — works offline
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
        </TouchableOpacity>

        {/* ── 2-col tile grid ── */}
        <View style={S.grid}>
          {GRID_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[S.tile, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(tile.route as any)}
              activeOpacity={0.75}
            >
              <View style={[S.tileIcon, { backgroundColor: tile.color + '18' }]}>
                <Ionicons name={tile.icon as any} size={22} color={tile.color} />
              </View>
              <Text style={[S.tileLabel, { color: theme.text }]}>{tile.label}</Text>
              <Text style={[S.tileSub, { color: theme.secondaryText }]} numberOfLines={2}>{tile.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout (logged-in only) ── */}
        {!isGuest && (
          <TouchableOpacity
            style={[S.logoutBtn, { borderColor: theme.border }]}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.danger ?? '#F55345'} />
            <Text style={[S.logoutText, { color: theme.danger ?? '#F55345' }]}>Log Out</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: TYPE_SCALE.screenTitle,
  scroll:      { paddingHorizontal: 12, paddingBottom: 40 },

  // Guest banner
  guestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, marginBottom: 4,
  },
  guestIcon:  { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  guestTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  guestSub:   { fontSize: 12 },

  // Profile card
  profileCard: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4,
  },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:       { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:    { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 18, fontWeight: '800' },
  profileName:  { fontSize: 15, fontWeight: '700' },
  profileEmail: { fontSize: 12, marginTop: 2 },
  syncBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  syncDot:      { width: 6, height: 6, borderRadius: 3 },
  syncBadgeText:{ fontSize: 11, fontWeight: '700' },

  // Delete link
  deleteLink:     { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 4, marginBottom: 12, marginTop: 2 },
  deleteLinkText: { fontSize: 12, textDecorationLine: 'underline' },

  // TripMaster featured card
  tripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, marginTop: 12,
  },
  tripIcon:      { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tripTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripTitle:     { fontSize: 15, fontWeight: '700' },
  tripBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  tripBadgeText: { fontSize: 10, fontWeight: '800' },
  tripSub:       { fontSize: 12, marginTop: 3 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 16,justifyContent:"center",marginTop:15 },
  tile: {
    width: '40%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, gap: 5,
    flexDirection:"column",
    justifyContent:"center",
    alignItems:"center"
  },
  tileIcon:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  tileLabel: { fontSize: 15, fontWeight: '700' },
  tileSub:   { fontSize: 12, lineHeight: 16 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingVertical: 14, marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },

  // Delete Account modal
  deleteOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  deleteCard:        { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
  deleteIconWrap:    { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  deleteTitle:       { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  deleteSub:         { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  deleteInput:       { width: '100%', height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, marginBottom: 8 },
  deleteErrorText:   { fontSize: 12, marginBottom: 10, alignSelf: 'flex-start' },
  deleteConfirmBtn:  { width: '100%', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  deleteConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteCancelBtn:   { paddingVertical: 10 },
  deleteCancelText:  { fontSize: 14 },
});
