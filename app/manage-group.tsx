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
        style={[
          styles.groupItem, 
          { backgroundColor: theme.card, borderColor: isActive ? theme.tint : theme.border },
          isActive && styles.activeItem
        ]}
        onPress={() => handleSwitch(item._id)}
        disabled={isActive || loading}
      >
        <View style={[styles.groupIcon, { backgroundColor: isActive ? theme.tint : `${theme.tint}15` }]}>
          <Ionicons name="people" size={20} color={isActive ? '#FFF' : theme.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold" style={[styles.groupTitle, isActive && { color: theme.tint }]}>
            {item.name}
          </ThemedText>
          <ThemedText style={styles.groupMeta}>{item.members?.length || 0} members</ThemedText>
        </View>
        {isActive ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark" size={16} color="#FFF" />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.icon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ 
          title: 'Group Management', 
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
      }} />

      <View style={[styles.tabHeader, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.tab, mode === 'switch' && { borderBottomColor: theme.tint }]}
          onPress={() => setMode('switch')}
        >
          <ThemedText style={[styles.tabText, mode === 'switch' && { color: theme.tint }]}>Groups</ThemedText>
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
                <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={64} color={theme.icon} style={{ opacity: 0.1 }} />
                    <ThemedText style={styles.emptyText}>You are not in any groups yet.</ThemedText>
                </View>
              }
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Ionicons name="enter-outline" size={24} color={theme.tint} />
                <ThemedText type="subtitle" style={styles.cardTitle}>Join a Group</ThemedText>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'rgba(150,150,150,0.05)' }]}
              placeholder="Enter Invite Code"
              placeholderTextColor="#A0A0A0"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={handleJoin} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Join Group</ThemedText>}
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { marginTop: 24, backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Ionicons name="add-circle-outline" size={24} color={theme.tint} />
                <ThemedText type="subtitle" style={styles.cardTitle}>Create a Group</ThemedText>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'rgba(150,150,150,0.05)' }]}
              placeholder="Group Name (e.g., Wedding 2024)"
              placeholderTextColor="#A0A0A0"
              value={groupName}
              onChangeText={setGroupName}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Create Group</ThemedText>}
            </TouchableOpacity>
          </View>
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
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '800', fontSize: 16, color: '#8E8E93' },
  list: { padding: 20 },
  groupItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 16, 
      borderRadius: 24, 
      marginBottom: 16, 
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
  },
  activeItem: {
      shadowColor: '#5856D6',
      shadowOpacity: 0.1,
  },
  groupIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  groupTitle: { fontSize: 17 },
  groupMeta: { fontSize: 13, opacity: 0.5, marginTop: 4 },
  activeBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#34C759',
      justifyContent: 'center',
      alignItems: 'center',
  },
  card: { padding: 24, borderRadius: 32, borderWidth: 1, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardTitle: { marginBottom: 0 },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, marginBottom: 20, fontSize: 16, fontWeight: '600' },
  button: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', marginTop: 16, opacity: 0.5, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});
