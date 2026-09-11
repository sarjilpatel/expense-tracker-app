import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, Share, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import {
  getCurrentGroup,
  getMyGroups,
  switchGroup,
  createGroup,
  joinGroup,
  leaveGroup,
  deleteGroup,
} from '@/src/services/groupApi';
import { getAllTransactions } from '@/src/services/dataService';

export default function ManageGroupScreen() {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [monthlyExpense, setMonthlyExpense] = useState(0);

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addMode, setAddMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [grpDetail, grpList] = await Promise.all([getCurrentGroup(), getMyGroups()]);
      setGroup(grpDetail);
      setMyGroups(grpList);
      const now = new Date();
      const txs = (await getAllTransactions(now.getMonth() + 1, now.getFullYear())) as any[];
      const total = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      setMonthlyExpense(total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

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
      // This used to write `groupId: g._id` from a response that carries no `_id` — putting
      // `undefined` into the auth context rather than leaving the user where they were.
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

  const isOwner = group && (group.createdBy === user?._id || group.owner === user?._id);
  // The active group can be the user's personal one — they land here from settings to reach the
  // switcher. Nothing about sharing applies to it: there is no join code, no one to invite, and
  // leaving or deleting your own space is not a thing to offer.
  const isPersonal = !!group?.isPersonal;

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  const getInitials = (name?: string) => name?.charAt(0)?.toUpperCase() ?? '?';

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom header with back button */}
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>{group?.name || 'Group'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Group Info Card ── */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupAvatar, { backgroundColor: theme.tint }]}>
                <Text style={[styles.groupAvatarText, { color: theme.tintText }]}>{getInitials(group?.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupName, { color: theme.text }]}>{group?.name}</Text>
                <Text style={[styles.groupSubtitle, { color: theme.secondaryText }]}>
                  {isPersonal
                    ? 'Your own space'
                    : `${group?.members?.length || 0} member${(group?.members?.length || 0) !== 1 ? 's' : ''}`}
                  {group?.createdAt ? `  ·  Since ${formatDate(group.createdAt)}` : ''}
                </Text>
              </View>
            </View>

            <View style={[styles.statsRow, { borderTopColor: theme.separator }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.expense }]}>
                  ₹{monthlyExpense.toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.statLabel, { color: theme.secondaryText }]}>
                  {isPersonal ? 'Spent this month' : 'Shared this month'}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.tint }]}>
                  {group?.members?.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.secondaryText }]}>Total members</Text>
              </View>
            </View>
          </View>

          {/* ── Members ── */}
          <ThemedText style={styles.sectionLabel}>Members</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {(group?.members || []).length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyRowText, { color: theme.secondaryText }]}>No member data available</Text>
              </View>
            ) : (
              (group.members as any[]).map((member: any, index: number) => {
                const memberId   = member._id ?? member.userId ?? member;
                const memberName = member.name ?? member.username ?? `Member ${index + 1}`;
                const memberEmail = member.email ?? '';
                const isGroupOwner = group.createdBy === memberId || group.owner === memberId;
                const isMe = memberId === user?._id;
                return (
                  <React.Fragment key={String(memberId)}>
                    {index > 0 && <View style={[styles.sep, { backgroundColor: theme.separator }]} />}
                    <View style={styles.memberRow}>
                      <View style={[
                        styles.memberAvatar,
                        { backgroundColor: isGroupOwner ? theme.tint : theme.card },
                      ]}>
                        <Text style={[
                          styles.memberAvatarText,
                          { color: isGroupOwner ? theme.tintText : theme.secondaryText },
                        ]}>
                          {getInitials(memberName)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: theme.text }]}>
                          {memberName}{isMe ? ' (You)' : ''}
                        </Text>
                        {memberEmail ? (
                          <Text style={[styles.memberEmail, { color: theme.secondaryText }]}>{memberEmail}</Text>
                        ) : null}
                      </View>
                      <View style={[
                        styles.roleBadge,
                        { backgroundColor: isGroupOwner ? theme.tint : theme.card },
                      ]}>
                        <Text style={[
                          styles.roleText,
                          { color: isGroupOwner ? theme.tintText : theme.secondaryText },
                        ]}>
                          {isGroupOwner ? 'Owner' : 'Member'}
                        </Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })
            )}
          </View>

          {/* ── Invite: a personal group has no join code and no one to invite ── */}
          {!isPersonal && <>
          <ThemedText style={styles.sectionLabel}>Invite Members</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.inviteContent}>
              <Text style={[styles.codeCaption, { color: theme.secondaryText }]}>JOIN CODE</Text>
              <Text style={[styles.codeValue, { color: theme.text }]}>{group?.joinCode ?? '—'}</Text>
              <View style={styles.inviteButtons}>
                <TouchableOpacity
                  style={[styles.inviteBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={17} color={theme.tint} />
                  <Text style={[styles.inviteBtnText, { color: theme.tint }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={17} color={theme.tint} />
                  <Text style={[styles.inviteBtnText, { color: theme.tint }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </>}

          {/* ── My Groups (switch) ── */}
          <ThemedText style={styles.sectionLabel}>My Groups</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {myGroups.map((g: any, index: number) => {
              const isActive = g._id === user?.groupId;
              return (
                <React.Fragment key={g._id}>
                  {index > 0 && <View style={[styles.sep, { backgroundColor: theme.separator }]} />}
                  <TouchableOpacity
                    style={styles.groupRow}
                    onPress={() => handleSwitch(g._id)}
                    disabled={isActive || actionLoading}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.groupRowIcon,
                      { backgroundColor: isActive ? theme.tint : theme.card },
                    ]}>
                      <Ionicons
                        name={g.isPersonal ? 'person' : 'people'}
                        size={17}
                        color={isActive ? theme.tintText : theme.tint}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.groupRowName, { color: isActive ? theme.tint : theme.text }]}>
                        {g.name}
                      </Text>
                      <Text style={[styles.groupRowMeta, { color: theme.secondaryText }]}>
                        {/* Everyone has a personal group — "1 member" would read as a group that
                            never filled up rather than as your own space. */}
                        {g.isPersonal
                          ? 'Just you'
                          : `${g.members?.length || 0} member${(g.members?.length || 0) !== 1 ? 's' : ''}`}
                      </Text>
                    </View>
                    {isActive
                      ? (
                        <View style={[styles.activeCheck, { backgroundColor: theme.tint }]}>
                          <Ionicons name="checkmark" size={13} color={theme.tintText} />
                        </View>
                      )
                      : <Ionicons name="chevron-forward" size={16} color={theme.icon} />
                    }
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}

            <View style={[styles.sep, { backgroundColor: theme.separator }]} />
            <TouchableOpacity
              style={styles.groupRow}
              onPress={() => setShowAddGroup(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.groupRowIcon, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                <Ionicons name={showAddGroup ? 'remove' : 'add'} size={17} color={theme.tint} />
              </View>
              <Text style={[styles.groupRowName, { color: theme.tint }]}>Add Another Group</Text>
              <Ionicons name={showAddGroup ? 'chevron-up' : 'chevron-down'} size={16} color={theme.tint} />
            </TouchableOpacity>

            {showAddGroup && (
              <View style={[styles.addGroupPanel, { borderTopColor: theme.separator }]}>
                <View style={[styles.addModeTabs, { backgroundColor: theme.cardAlt ?? theme.border }]}>
                  {(['create', 'join'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.addModeTab, addMode === m && { backgroundColor: theme.tint }]}
                      onPress={() => setAddMode(m)}
                    >
                      <Text style={[styles.addModeTabText, { color: addMode === m ? theme.tintText : theme.secondaryText }]}>
                        {m === 'create' ? 'Create New' : 'Join with Code'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.addInput, { color: theme.text, borderColor: theme.border }]}
                  placeholder={addMode === 'create' ? 'Group name (e.g. My Family)' : 'Invite code'}
                  placeholderTextColor={theme.secondaryText}
                  value={addMode === 'create' ? groupName : inviteCode}
                  onChangeText={addMode === 'create' ? setGroupName : setInviteCode}
                  autoCapitalize={addMode === 'join' ? 'characters' : 'words'}
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.tint }, actionLoading && { opacity: 0.6 }]}
                  onPress={addMode === 'create' ? handleCreate : handleJoin}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  {actionLoading
                    ? <ActivityIndicator color={theme.tintText} size="small" />
                    : <Text style={[styles.addBtnText, { color: theme.tintText }]}>{addMode === 'create' ? 'Create Group' : 'Join Group'}</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Danger Zone: nothing here applies to your own space ── */}
          {!isPersonal && <>
          <ThemedText style={styles.sectionLabel}>Danger Zone</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {isOwner ? (
              <TouchableOpacity style={styles.dangerRow} onPress={handleDelete} activeOpacity={0.7}>
                <View style={[styles.dangerIcon, { backgroundColor: theme.danger }]}>
                  <Ionicons name="trash-outline" size={20} color={theme.expenseText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dangerTitle, { color: theme.danger }]}>Delete Group</Text>
                  <Text style={[styles.dangerSub, { color: theme.secondaryText }]}>
                    Permanently removes group for all members
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.danger} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.dangerRow} onPress={handleLeave} activeOpacity={0.7}>
                <View style={[styles.dangerIcon, { backgroundColor: theme.danger }]}>
                  <Ionicons name="exit-outline" size={20} color={theme.expenseText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dangerTitle, { color: theme.danger }]}>Leave Group</Text>
                  <Text style={[styles.dangerSub, { color: theme.secondaryText }]}>
                    {"You'll lose access to shared expenses"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.danger} />
              </TouchableOpacity>
            )}
          </View>
          </>}

        </ScrollView>
      </KeyboardAvoidingView>

      {actionLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { fontSize: 17, fontWeight: '700' },
  backBtn:     { width: 36, alignItems: 'center' },
  content:     { padding: 20, paddingBottom: 60 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 10, paddingLeft: 4, marginTop: 8,
  },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  sep:  { height: StyleSheet.hairlineWidth, marginLeft: 64 },

  // Group header
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  groupAvatar: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  groupAvatarText: { fontSize: 22, fontWeight: '800' },
  groupName:     { fontSize: 18, fontWeight: '800' },
  groupSubtitle: { fontSize: 12, marginTop: 3 },

  statsRow: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '800' },
  statLabel:   { fontSize: 11, marginTop: 3 },
  statDivider: { width: StyleSheet.hairlineWidth },

  // Members
  emptyRow:     { padding: 16, alignItems: 'center' },
  emptyRowText: { fontSize: 14 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '800' },
  memberName:       { fontSize: 14, fontWeight: '600' },
  memberEmail:      { fontSize: 12, marginTop: 1 },
  roleBadge:        { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  roleText:         { fontSize: 11, fontWeight: '800' },

  // Invite
  inviteContent: { padding: 20, alignItems: 'center', gap: 6 },
  codeCaption:   { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  codeValue:     { fontSize: 32, fontWeight: '900', letterSpacing: 6 },
  inviteButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12,
  },
  inviteBtnText: { fontSize: 14, fontWeight: '700' },

  // My Groups rows
  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  groupRowIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  groupRowName: { fontSize: 14, fontWeight: '600' },
  groupRowMeta: { fontSize: 12, marginTop: 1 },
  activeCheck:  {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },

  // Add group panel
  addGroupPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16, gap: 12,
  },
  addModeTabs: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  addModeTab:  { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  addModeTabText: { fontSize: 13, fontWeight: '700' },
  addInput: {
    height: 50, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 14,
    backgroundColor: 'transparent',
  },
  addBtn: {
    height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { fontWeight: '800', fontSize: 15 },

  // Danger zone
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dangerIcon: {
    width: 40, height: 40, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  dangerTitle: { fontSize: 14, fontWeight: '700' },
  dangerSub:   { fontSize: 12, marginTop: 2 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', zIndex: 99,
  },
});
