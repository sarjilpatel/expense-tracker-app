import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/AuthContext';
import { createGroup, joinGroup } from '@/src/services/groupApi';
import { useTheme } from '@/src/context/ThemeContext';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Button, Field, Chip } from '@/components/ui';

export default function GroupSetupScreen() {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const { updateUser } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const handleCreate = async () => {
    if (!groupName.trim()) return Alert.alert('Error', 'Please enter a group name');
    setLoading(true);
    try {
      const group = await createGroup(groupName.trim());
      if (group?._id) {
        await updateUser({ groupId: group._id });
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Error', error.toString() || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return Alert.alert('Error', 'Please enter an invite code');
    setLoading(true);
    try {
      // Joining is a request now, not an instant join: the owner has to approve it, so there is no
      // group to switch into yet and nothing to write to `updateUser`. This used to check for an
      // `_id` that the endpoint has not returned since approval was introduced, so the button
      // appeared to do nothing at all — no error, no confirmation, no navigation.
      const result = await joinGroup(inviteCode.trim().toUpperCase());
      Alert.alert(
        'Request sent',
        result?.message || 'Waiting for the group owner to approve you.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert('Error', error.toString() || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Set up a group" keyboard>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={S.hero}>
        <View style={[S.logo, { backgroundColor: hexToRGBA(theme.tint, 0.12) }]}>
          <Ionicons name="people" size={iconSize.xl} color={theme.tint} />
        </View>
        <Text style={[type.title, S.center, { color: theme.text }]}>Share expenses</Text>
        <Text style={[type.label, S.center, { color: theme.secondaryText }]}>
          Track what you spend together with your family or team.
        </Text>
      </View>

      <View style={S.chips}>
        <Chip label="Create" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Chip label="Join with code" selected={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      <Card>
        {mode === 'create' ? (
          <>
            <Field
              label="Group name"
              placeholder="e.g. My Family, Home Budget"
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <Button label="Create group" onPress={handleCreate} loading={loading} style={{ marginTop: space.lg }} />
          </>
        ) : (
          <>
            <Field
              label="Invite code"
              placeholder="Enter code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              help="The owner approves your request before you can see the group."
            />
            <Button label="Send join request" onPress={handleJoin} loading={loading} style={{ marginTop: space.lg }} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const S = StyleSheet.create({
  hero:   { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  logo:   { width: 72, height: 72, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', marginBottom: space.sm },
  center: { textAlign: 'center' },
  chips:  { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
});
