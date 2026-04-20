import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, View, KeyboardAvoidingView, Platform, ScrollView, FlatList } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/src/context/AuthContext';
import { createGroup, joinGroup, getMyGroups, switchGroup } from '@/src/services/groupApi';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

export default function ManageGroupScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState<'switch' | 'add'>('switch');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await getMyGroups();
      setMyGroups(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleSwitch = async (groupId: string) => {
    if (groupId === user?.groupId) return;
    setLoading(true);
    try {
      await switchGroup(groupId);
      await updateUser({ groupId });
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return Alert.alert('Error', 'Enter a name');
    setLoading(true);
    try {
      const g = await createGroup(groupName);
      await updateUser({ groupId: g._id });
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return Alert.alert('Error', 'Enter code');
    setLoading(true);
    try {
      const g = await joinGroup(inviteCode.toUpperCase().trim());
      await updateUser({ groupId: g._id });
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.toString());
    } finally {
      setLoading(false);
    }
  };

  const renderGroupItem = ({ item }: { item: any }) => {
    const isActive = item._id === user?.groupId;
    return (
      <TouchableOpacity
        style={[styles.groupItem, { backgroundColor: theme.card, borderColor: isActive ? theme.tint : theme.border }]}
        onPress={() => handleSwitch(item._id)}
        disabled={isActive || loading}
      >
        <View style={[styles.groupIcon, { backgroundColor: isActive ? theme.tint : `${theme.tint}10` }]}>
          <Ionicons name="people" size={20} color={isActive ? '#FFF' : theme.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold" style={[styles.groupTitle, isActive && { color: theme.tint }]}>
            {item.name}
          </ThemedText>
          <ThemedText style={styles.groupMeta}>{item.members?.length || 0} members</ThemedText>
        </View>
        {isActive ? (
          <Ionicons name="checkmark-circle" size={24} color={theme.tint} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.icon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Groups', presentation: 'modal', headerShown: true }} />

      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tab, mode === 'switch' && { borderBottomColor: theme.tint }]}
          onPress={() => setMode('switch')}
        >
          <ThemedText style={[styles.tabText, mode === 'switch' && { color: theme.tint }]}>Your Groups</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'add' && { borderBottomColor: theme.tint }]}
          onPress={() => setMode('add')}
        >
          <ThemedText style={[styles.tabText, mode === 'add' && { color: theme.tint }]}>Add New</ThemedText>
        </TouchableOpacity>
      </View>

      {mode === 'switch' ? (
        <View style={{ flex: 1 }}>
          {fetching ? (
            <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={myGroups}
              renderItem={renderGroupItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>You are not in any groups yet.</ThemedText>
              }
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Join a Group</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Invite Code"
              placeholderTextColor="#A0A0A0"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={handleJoin} disabled={loading}>
              <ThemedText style={styles.buttonText}>Join Group</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={[styles.card, { marginTop: 24 }]}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Create a Group</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Group Name"
              placeholderTextColor="#A0A0A0"
              value={groupName}
              onChangeText={setGroupName}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={handleCreate} disabled={loading}>
              <ThemedText style={styles.buttonText}>Create Group</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      )}

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '700', fontSize: 15, color: '#8E8E93' },
  list: { padding: 20 },
  groupItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  groupIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  groupTitle: { fontSize: 16 },
  groupMeta: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  card: { padding: 20, borderRadius: 24, backgroundColor: 'rgba(150,150,150,0.05)' },
  cardTitle: { marginBottom: 16 },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, marginBottom: 16, fontSize: 16 },
  button: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: '800' },
  emptyText: { textAlign: 'center', marginTop: 100, opacity: 0.5 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});
