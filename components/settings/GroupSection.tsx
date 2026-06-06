import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  group: any;
}

export function GroupSection({ group }: Props) {
  const { theme } = useTheme();

  if (!group) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Group</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.tint }]}>
              <Ionicons name="people-outline" size={28} color="#FFF" />
            </View>
            <ThemedText type="defaultSemiBold" style={styles.emptyTitle}>No Group Yet</ThemedText>
            <Text style={[styles.emptySub, { color: theme.secondaryText }]}>
              Create a shared group to split expenses with family or team
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: theme.tint }]}
              onPress={() => router.push('/group-setup')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.createBtnText}>Create or Join Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionLabel}>Group</ThemedText>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push('/manage-group')}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
            <Ionicons name="people" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
            <Text style={[styles.groupMeta, { color: theme.secondaryText }]}>
              {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''} · Tap to manage
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.icon} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMeta: { fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: 'center', padding: 28, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  createBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
