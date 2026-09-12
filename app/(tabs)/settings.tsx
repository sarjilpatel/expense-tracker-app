import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { getProfile, deleteAccount as deleteAccountApi } from '@/src/services/authApi';
import { getCurrentGroup } from '@/src/services/dataService';
import { getMyGroups } from '@/src/services/groupApi';
import { getLastSyncTime } from '@/src/services/syncService';
import { GroupSection } from '@/components/settings/GroupSection';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import {
  Screen, Card, Row, Touchable, Button, Sheet, Field, Chip, Skeleton, SectionHeader,
  type SheetHandle,
} from '@/components/ui';

/**
 * The six destinations, as a 2-column grid. The per-tile colour is a category colour, not the
 * accent — W2-29 keeps the accent for actions, and six accent tiles would be six primary buttons.
 */
const GRID_TILES = [
  { key: 'customize',  label: 'Customize',  sub: 'Theme, colors, language',  icon: 'color-palette-outline',      route: '/settings/customization', color: '#6366F1' },
  { key: 'money',      label: 'Money',      sub: 'Budget, goals, splits',    icon: 'wallet-outline',             route: '/settings/money',         color: '#10B981' },
  { key: 'categories', label: 'Categories', sub: 'Income & expense types',   icon: 'grid-outline',               route: '/manage-categories',      color: '#F59E0B' },
  { key: 'security',   label: 'Security',   sub: 'PIN lock, biometric',      icon: 'shield-checkmark-outline',   route: '/settings/security',      color: '#3B82F6' },
  { key: 'data',       label: 'Data',       sub: 'Backup, export, import',   icon: 'server-outline',             route: '/settings/data',          color: '#0F766E' },
  { key: 'help',       label: 'Help',       sub: 'Privacy, info, support',   icon: 'help-circle-outline',        route: '/settings/help',          color: '#71717A' },
] as const;

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { isGuest, logout } = useAuth();

  const [user,      setUser]      = useState<any>(null);
  const [group,     setGroup]     = useState<any>(null);
  const [myGroups,  setMyGroups]  = useState<any[]>([]);
  const [lastSync,  setLastSync]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(!isGuest);

  const deleteSheet = useRef<SheetHandle>(null);
  const [deletePassword,  setDeletePassword]  = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError,     setDeleteError]     = useState('');

  const fetchData = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      // The group list, not just the active group, is what decides whether the group section
      // offers create-or-join or a way into manage-group — see GroupSection. A failure on either
      // must not cost the screen the profile it is mainly here to show.
      const [profileData, groupData, groupList] = await Promise.all([
        getProfile(),
        getCurrentGroup().catch(() => null),
        getMyGroups().catch(() => []),
      ]);
      setUser(profileData ?? null);
      setGroup(groupData ?? null);
      setMyGroups(Array.isArray(groupList) ? groupList : []);
      getLastSyncTime().then(setLastSync).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(tabs)'); } },
    ]);

  const openDelete = () => {
    setDeletePassword('');
    setDeleteError('');
    deleteSheet.current?.present();
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) { setDeleteError('Enter your password to confirm.'); return; }
    setDeletingAccount(true);
    setDeleteError('');
    try {
      const result = await deleteAccountApi(deletePassword);
      deleteSheet.current?.dismiss();
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
      <Screen title="More" onBack={false}>
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={76} round={radius.lg} />
          <Skeleton.Block height={64} round={radius.lg} />
          <Skeleton.Block height={140} round={radius.lg} />
        </Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title="More" onBack={false}>
      {/* ── Account ── */}
      {isGuest ? (
        <Card padded={false} style={{ marginTop: space.sm }}>
          <Row
            icon="cloud-outline"
            title="Sign in to unlock cloud features"
            subtitle="Backup, sync & group expenses"
            onPress={() => router.push('/login')}
            last
          />
        </Card>
      ) : (
        <Card style={{ marginTop: space.sm }}>
          <View style={S.profile}>
            <View style={[S.avatar, { backgroundColor: hexToRGBA(theme.tint, 0.15) }]}>
              {user?.profilePhoto
                ? <Image source={{ uri: user.profilePhoto }} style={S.avatarImg} accessibilityLabel="Profile photo" />
                : <Text style={[type.heading, { color: theme.tint }]}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={1}>{user?.email || ''}</Text>
            </View>
            <Chip size="sm" tone={lastSync ? 'income' : 'neutral'} icon={lastSync ? 'cloud-done-outline' : 'cloud-offline-outline'} label={lastSync ? 'Synced' : 'Offline'} />
          </View>
          <Touchable onPress={openDelete} haptic="none" style={S.deleteLink} accessibilityLabel="Delete account">
            <Text style={[type.label, { color: theme.secondaryText }]}>Delete account</Text>
          </Touchable>
        </Card>
      )}

      {!isGuest && <GroupSection group={group} groups={myGroups} />}

      {/* ── Trips ── */}
      <SectionHeader title="Split bills" />
      <Card padded={false}>
        <Row
          icon="people"
          iconBg="#8B5CF6"
          title="Trips"
          subtitle="Split any bill — with your group or with anyone. Works offline."
          onPress={() => router.push('/trips' as any)}
          last
        />
      </Card>

      {/* ── Destinations ── */}
      <SectionHeader title="Settings" />
      <View style={S.grid}>
        {GRID_TILES.map((tile) => (
          <Card key={tile.key} onPress={() => router.push(tile.route as any)} accessibilityLabel={`${tile.label}: ${tile.sub}`} style={S.tile}>
            <View style={[S.tileIcon, { backgroundColor: hexToRGBA(tile.color, 0.12) }]}>
              <Ionicons name={tile.icon as any} size={iconSize.lg} color={tile.color} />
            </View>
            <Text style={[type.bodyStrong, { color: theme.text }]}>{tile.label}</Text>
            <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={2}>{tile.sub}</Text>
          </Card>
        ))}
      </View>

      {!isGuest && (
        <Button label="Log out" icon="log-out-outline" variant="secondary" onPress={handleLogout} style={{ marginTop: space.xl }} />
      )}

      {/* ── Delete account ── */}
      <Sheet ref={deleteSheet} title="Delete account">
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.md }]}>
          Your account will be scheduled for deletion in 30 days. You can cancel within that window.
          After 30 days, all your transactions, goals and trips are permanently removed.
        </Text>
        <Field
          label="Password"
          placeholder="Enter your password to confirm"
          secureTextEntry
          autoCapitalize="none"
          value={deletePassword}
          onChangeText={t => { setDeletePassword(t); setDeleteError(''); }}
          error={deleteError || undefined}
        />
        <Button label="Delete my account" variant="danger" onPress={confirmDeleteAccount} loading={deletingAccount} style={{ marginTop: space.lg }} />
      </Sheet>
    </Screen>
  );
}

const S = StyleSheet.create({
  profile:    { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar:     { width: 52, height: 52, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:  { width: 52, height: 52 },
  deleteLink: { alignSelf: 'flex-end', marginTop: space.sm, paddingVertical: space.xs, paddingHorizontal: space.xs },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile:       { width: '48%', flexGrow: 1, gap: space.xs },
  tileIcon:   { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: space.xs },
});
