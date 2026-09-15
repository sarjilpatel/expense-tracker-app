import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useFocusRefresh } from '@/src/hooks/useFocusRefresh';
import { Image } from 'expo-image';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { getProfile, deleteAccount as deleteAccountApi } from '@/src/services/authApi';
import { getMyGroups, getCurrentGroup } from '@/src/services/groupApi';
import { runSync, getSyncStatus, subscribeSync, type SyncStatus } from '@/src/sync/engine';
import { GroupSection } from '@/components/settings/GroupSection';
import { TILE_COLORS } from '@/constants/palettes';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { reportError } from '@/src/utils/log';
import {
  Screen, Card, Row, Touchable, Button, Sheet, Field, Chip, Skeleton, SectionHeader,
  type SheetHandle,
} from '@/components/ui';

/**
 * The six destinations, as a 2-column grid. The per-tile colour is a category colour, not the
 * accent — W2-29 keeps the accent for actions, and six accent tiles would be six primary buttons.
 */
const GRID_TILES = [
  { key: 'customize',  label: 'Customize',  sub: 'Theme, colors, language',  icon: 'color-palette-outline',      route: '/settings/customization', color: TILE_COLORS.customize },
  { key: 'accounts',   label: 'Accounts',   sub: 'Cash, bank, cards',        icon: 'wallet-outline',             route: '/accounts',               color: TILE_COLORS.accounts },
  { key: 'categories', label: 'Categories', sub: 'Income & expense types',   icon: 'grid-outline',               route: '/manage-categories',      color: TILE_COLORS.categories },
  { key: 'security',   label: 'Security',   sub: 'PIN lock, biometric',      icon: 'shield-checkmark-outline',   route: '/settings/security',      color: TILE_COLORS.security },
  { key: 'data',       label: 'Data',       sub: 'Backup, export, import',   icon: 'server-outline',             route: '/settings/data',          color: TILE_COLORS.data },
  { key: 'help',       label: 'Help',       sub: 'Privacy, info, support',   icon: 'help-circle-outline',        route: '/settings/help',          color: TILE_COLORS.help },
] as const;

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { isGuest, logout, user: authUser } = useAuth();

  // The session already knows who is signed in, so the profile card renders on the first frame
  // from that and the server's copy (the photo, mostly) replaces it when it lands. Only the group
  // section has nothing local to draw from; it alone waits, and only until the first answer.
  const [user,      setUser]      = useState<any>(null);
  const [group,     setGroup]     = useState<any>(null);
  const [myGroups,  setMyGroups]  = useState<any[] | null>(null);
  const [sync,      setSync]      = useState<SyncStatus>({ running: false, lastSyncAt: null, lastError: null, pending: 0 });
  const profile = user ?? authUser;

  const deleteSheet = useRef<SheetHandle>(null);
  const [deletePassword,  setDeletePassword]  = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError,     setDeleteError]     = useState('');

  const fetchData = useCallback(async () => {
    if (isGuest) return;
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
    } catch (e) {
      reportError(e);
      setMyGroups(g => g ?? []);
    }
  }, [isGuest]);

  useFocusRefresh(useCallback(() => { fetchData(); }, [fetchData]));
  useEffect(() => { if (isGuest) return; getSyncStatus().then(setSync); return subscribeSync(setSync); }, [isGuest]);

  // Logging out empties the device. Anything still in the outbox is pushed first; if that fails
  // the user is told exactly how much would be lost and decides.
  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        const outcome = await runSync('manual');
        const { pending } = await getSyncStatus();
        if (pending > 0) {
          Alert.alert(
            'Changes not backed up',
            `${pending} change${pending === 1 ? '' : 's'} on this phone ${outcome.error ? `could not be sent (${outcome.error})` : 'were not accepted by the server'}. Logging out now will lose them.`,
            [
              { text: 'Keep me signed in', style: 'cancel' },
              { text: 'Log out anyway', style: 'destructive', onPress: async () => { await logout(); router.replace('/(tabs)'); } },
            ],
          );
          return;
        }
        await logout();
        router.replace('/(tabs)');
      } },
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
              {profile?.profilePhoto
                ? <Image source={{ uri: profile.profilePhoto }} style={S.avatarImg} accessibilityLabel="Profile photo" />
                : <Text style={[type.heading, { color: theme.tint }]}>{profile?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={1}>{profile?.name || 'User'}</Text>
              <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={1}>{profile?.email || ''}</Text>
            </View>
            <Chip size="sm" tone={sync.pending > 0 ? 'warning' : sync.lastSyncAt ? 'income' : 'neutral'} icon={sync.pending > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'} label={sync.running ? 'Backing up…' : sync.pending > 0 ? `${sync.pending} waiting` : sync.lastSyncAt ? 'Backed up' : 'Not yet'} />
          </View>
          <Touchable onPress={openDelete} haptic="none" style={S.deleteLink} accessibilityLabel="Delete account">
            <Text style={[type.label, { color: theme.secondaryText }]}>Delete account</Text>
          </Touchable>
        </Card>
      )}

      {!isGuest && (myGroups
        ? <GroupSection group={group} groups={myGroups} />
        : <>
            <SectionHeader title="Group" />
            <Skeleton.Group><Skeleton.Block height={64} round={radius.lg} /></Skeleton.Group>
          </>
      )}

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
