import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import {
  getCurrentGroup, getMyGroups, switchGroup, createGroup, joinGroup, leaveGroup, deleteGroup,
  getPendingRequests, approveJoinRequest, rejectJoinRequest, type PendingRequest,
} from '@/src/services/groupApi';
import { getAllTransactions } from '@/src/services/dataService';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { reportError } from '@/src/utils/log';
import {
  Screen, Card, Row, Button, Field, Amount, EmptyState, SectionHeader, Chip, Skeleton,
} from '@/components/ui';

export default function ManageGroupScreen() {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [monthlyExpense, setMonthlyExpense] = useState(0);

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addMode, setAddMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const isOwner = group && (group.createdBy === user?._id || group.owner === user?._id);
  // The active group can be the user's personal one — they land here from settings to reach the
  // switcher. Nothing about sharing applies to it: there is no join code, no one to invite, and
  // leaving or deleting your own space is not a thing to offer.
  const isPersonal = !!group?.isPersonal;

  const loadData = useCallback(async () => {
    try {
      const [grpDetail, grpList] = await Promise.all([getCurrentGroup(), getMyGroups()]);
      setGroup(grpDetail);
      setMyGroups(grpList);
      const now = new Date();
      const txs = (await getAllTransactions(now.getMonth() + 1, now.getFullYear())) as any[];
      const total = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      setMonthlyExpense(total);

      // Only the owner can see or answer requests; anyone else gets an empty list without a call.
      const owner = grpDetail && !grpDetail.isPersonal &&
        (grpDetail.createdBy === user?._id || grpDetail.owner === user?._id);
      setPending(owner ? await getPendingRequests(grpDetail._id).catch(() => []) : []);
    } catch (e) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCopyCode = async () => {
    if (!group?.joinCode) return;
    await Clipboard.setStringAsync(group.joinCode);
    Alert.alert('Copied!', 'Join code copied to clipboard.');
  };

  const handleShare = async () => {
    if (!group?.joinCode) return;
    await Share.share({
      message: `Join my expense group "${group.name}" on Expense Tracker!\nCode: ${group.joinCode}`,
    });
  };

  const handleSwitch = async (groupId: string) => {
    if (groupId === user?.groupId || actionLoading) return;
    setActionLoading(true);
    try {
      await switchGroup(groupId);
      await updateUser({ groupId });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.toString());
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return Alert.alert('Error', 'Enter a group name');
    setActionLoading(true);
    try {
      const g = await createGroup(groupName.trim());
      await updateUser({ groupId: g._id });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.toString());
      setActionLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return Alert.alert('Error', 'Enter an invite code');
    setActionLoading(true);
    try {
      // Joining is a request the owner has to approve, so there is no group to switch into yet.
      const result = await joinGroup(inviteCode.trim().toUpperCase());
      setShowAddGroup(false);
      setInviteCode('');
      Alert.alert('Request sent', result?.message || 'Waiting for the group owner to approve you.');
    } catch (err: any) {
      Alert.alert('Error', err.toString());
    } finally {
      setActionLoading(false);
    }
  };

  const answerRequest = async (req: PendingRequest, approve: boolean) => {
    if (!group) return;
    setActionLoading(true);
    try {
      if (approve) await approveJoinRequest(group._id, req.userId._id);
      else         await rejectJoinRequest(group._id, req.userId._id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.toString());
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Group',
      `Leave "${group?.name}"? You'll lose access to shared expenses but your own transactions stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await leaveGroup();
              await updateUser({ groupId: null });
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.toString());
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Group',
      `Permanently delete "${group?.name}"? All members will lose access. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await deleteGroup();
              await updateUser({ groupId: null });
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.toString());
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const initial = (name?: string) => name?.charAt(0)?.toUpperCase() ?? '?';

  if (loading) {
    return (
      <Screen title="Group">
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton.Group style={{ paddingTop: space.sm }}>
          <Skeleton.Block height={120} round={radius.lg} />
          <Skeleton.Row /><Skeleton.Row />
        </Skeleton.Group>
      </Screen>
    );
  }

  const members: any[] = group?.members || [];

  return (
    <Screen title={group?.name || 'Group'} keyboard>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Group ── */}
      <Card style={{ marginTop: space.sm }}>
        <View style={S.groupHead}>
          <View style={[S.groupAvatar, { backgroundColor: hexToRGBA(theme.tint, 0.15) }]}>
            <Text style={[type.title, { color: theme.tint }]}>{initial(group?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: theme.text }]} numberOfLines={1}>{group?.name}</Text>
            <Text style={[type.label, { color: theme.secondaryText }]}>
              {isPersonal ? 'Your own space' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
              {group?.createdAt ? `  ·  Since ${formatDate(group.createdAt)}` : ''}
            </Text>
          </View>
        </View>
        <View style={[S.stats, { borderTopColor: theme.separator }]}>
          <View style={S.stat}>
            <Amount value={monthlyExpense} kind="expense" unsigned role="heading" />
            <Text style={[type.label, { color: theme.secondaryText }]}>{isPersonal ? 'Spent this month' : 'Shared this month'}</Text>
          </View>
          {!isPersonal && (
            <View style={S.stat}>
              <Text style={[type.heading, { color: theme.text }]}>{members.length}</Text>
              <Text style={[type.label, { color: theme.secondaryText }]}>Total members</Text>
            </View>
          )}
        </View>
      </Card>

      {/* ── Join requests (owner only) ── */}
      {pending.length > 0 && (
        <>
          <SectionHeader title="Join requests" count={pending.length} />
          <Card padded={false}>
            {pending.map((req, i) => (
              <Row
                key={req.userId._id}
                title={req.userId.name}
                subtitle={req.userId.email || 'wants to join'}
                icon="person-add-outline"
                last={i === pending.length - 1}
                right={(
                  <View style={S.reqActions}>
                    <Button size="sm" variant="secondary" label="Decline" onPress={() => answerRequest(req, false)} disabled={actionLoading} />
                    <Button size="sm" label="Approve" onPress={() => answerRequest(req, true)} disabled={actionLoading} />
                  </View>
                )}
              />
            ))}
          </Card>
        </>
      )}

      {/* ── Members ── */}
      <SectionHeader title="Members" />
      {members.length === 0 ? (
        <Card><EmptyState compact icon="people-outline" title="No member data" /></Card>
      ) : (
        <Card padded={false}>
          {members.map((member: any, index: number) => {
            const memberId    = member._id ?? member.userId ?? member;
            const memberName  = member.name ?? member.username ?? `Member ${index + 1}`;
            const isGroupOwner = group.createdBy === memberId || group.owner === memberId;
            const isMe = memberId === user?._id;
            return (
              <Row
                key={String(memberId)}
                title={isMe ? `${memberName} (You)` : memberName}
                subtitle={member.email ?? undefined}
                leading={(
                  <View style={[S.memberAvatar, { backgroundColor: hexToRGBA(isGroupOwner ? theme.tint : theme.text, 0.12) }]}>
                    <Text style={[type.bodyStrong, { color: isGroupOwner ? theme.tint : theme.secondaryText }]}>{initial(memberName)}</Text>
                  </View>
                )}
                right={<Chip size="sm" label={isGroupOwner ? 'Owner' : 'Member'} selected={isGroupOwner} />}
                last={index === members.length - 1}
              />
            );
          })}
        </Card>
      )}

      {/* ── Invite: a personal group has no join code and no one to invite ── */}
      {!isPersonal && (
        <>
          <SectionHeader title="Invite members" />
          <Card>
            <Text style={[type.overline, { color: theme.secondaryText }]}>Join code</Text>
            <Text style={[type.display, { color: theme.text, marginTop: space.xs }]} selectable accessibilityLabel={`Join code ${group?.joinCode ?? ''}`}>
              {group?.joinCode ?? '—'}
            </Text>
            <View style={S.inviteBtns}>
              <Button size="sm" variant="secondary" icon="copy-outline" label="Copy" onPress={handleCopyCode} />
              <Button size="sm" variant="secondary" icon="share-outline" label="Share" onPress={handleShare} />
            </View>
          </Card>
        </>
      )}

      {/* ── My groups (switch) ── */}
      <SectionHeader title="My groups" />
      <Card padded={false}>
        {myGroups.map((g: any, index: number) => {
          const isActive = g._id === user?.groupId;
          const n = g.members?.length || 0;
          return (
            <Row
              key={g._id}
              icon={g.isPersonal ? 'person' : 'people'}
              title={g.name}
              // Everyone has a personal group — "1 member" would read as a group that never
              // filled up rather than as your own space.
              subtitle={g.isPersonal ? 'Just you' : `${n} member${n !== 1 ? 's' : ''}`}
              right={isActive ? <Chip size="sm" selected icon="checkmark" label="Active" /> : undefined}
              chevron={!isActive}
              onPress={isActive ? undefined : () => handleSwitch(g._id)}
              disabled={actionLoading}
              last={false}
            />
          );
        })}
        <Row
          icon={showAddGroup ? 'remove' : 'add'}
          title="Add another group"
          onPress={() => setShowAddGroup(v => !v)}
          chevron={false}
          right={<Ionicons name={showAddGroup ? 'chevron-up' : 'chevron-down'} size={iconSize.sm} color={theme.secondaryText} />}
          last
        />
        {showAddGroup && (
          <View style={[S.addPanel, { borderTopColor: theme.separator }]}>
            <View style={S.chips}>
              <Chip label="Create new" selected={addMode === 'create'} onPress={() => setAddMode('create')} />
              <Chip label="Join with code" selected={addMode === 'join'} onPress={() => setAddMode('join')} />
            </View>
            <Field
              placeholder={addMode === 'create' ? 'Group name (e.g. My Family)' : 'Invite code'}
              value={addMode === 'create' ? groupName : inviteCode}
              onChangeText={addMode === 'create' ? setGroupName : setInviteCode}
              autoCapitalize={addMode === 'join' ? 'characters' : 'words'}
              style={{ marginTop: space.md }}
            />
            <Button
              label={addMode === 'create' ? 'Create group' : 'Send join request'}
              onPress={addMode === 'create' ? handleCreate : handleJoin}
              loading={actionLoading}
              style={{ marginTop: space.md }}
            />
          </View>
        )}
      </Card>

      {/* ── Danger zone: nothing here applies to your own space ── */}
      {!isPersonal && (
        <>
          <SectionHeader title="Danger zone" />
          <Card padded={false}>
            {isOwner ? (
              <Row danger icon="trash-outline" title="Delete group" subtitle="Permanently removes the group for all members" onPress={handleDelete} last />
            ) : (
              <Row danger icon="exit-outline" title="Leave group" subtitle="You'll lose access to shared expenses" onPress={handleLeave} last />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  groupHead:    { flexDirection: 'row', alignItems: 'center', gap: space.md },
  groupAvatar:  { width: 56, height: 56, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  stats:        { flexDirection: 'row', marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.lg },
  stat:         { flex: 1, gap: 2 },
  reqActions:   { flexDirection: 'row', gap: space.xs },
  memberAvatar: { width: 38, height: 38, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  inviteBtns:   { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  addPanel:     { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  chips:        { flexDirection: 'row', gap: space.sm },
});
