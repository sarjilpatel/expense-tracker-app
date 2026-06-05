import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';

interface Props {
  group: any;
  theme: any;
}

export function GroupSection({ group, theme }: Props) {
  const handleCopyCode = () => {
    if (!group?.joinCode) return;
    Clipboard.setString(group.joinCode);
    Alert.alert('Copied', 'Group code copied to clipboard');
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionLabel}>Group Settings</ThemedText>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}
        onPress={() => router.push('/manage-group')}
      >
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: `${theme.tint}15` }]}>
              <Ionicons name="people-outline" size={20} color={theme.tint} />
            </View>
            <View>
              <ThemedText type="defaultSemiBold">{group?.name}</ThemedText>
              <Text style={[styles.sub, { color: theme.secondaryText }]}>Manage Groups</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.icon} />
        </View>
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16, marginTop: 12 }]}>
        <View style={styles.row}>
          <View>
            <Text style={[styles.tinyLabel, { color: theme.secondaryText }]}>JOIN CODE</Text>
            <ThemedText type="subtitle" style={{ letterSpacing: 2 }}>{group?.joinCode || 'N/A'}</ThemedText>
          </View>
          {group?.joinCode && (
            <TouchableOpacity
              onPress={handleCopyCode}
              style={[styles.copyBtn, { backgroundColor: `${theme.tint}15` }]}
            >
              <Ionicons name="copy-outline" size={18} color={theme.tint} />
              <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 12 }}>Copy</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sub: { fontSize: 12, marginTop: 2, opacity: 0.6 },
  tinyLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
