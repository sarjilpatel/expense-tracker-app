import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { getTransactions } from '@/src/services/dataService';
import { discardLocalData, getLastSyncTime } from '@/src/services/syncService';
import { router } from 'expo-router';

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function DataSection() {
  const { theme } = useTheme();
  const { isGuest } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [wiping,    setWiping]    = useState(false);
  const [lastSync,  setLastSync]  = useState<string | null>(null);

  useEffect(() => {
    if (!isGuest) {
      getLastSyncTime().then(setLastSync).catch(() => {});
    }
  }, [isGuest]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const transactions = await getTransactions(now.getMonth() + 1, now.getFullYear());
      const rows = [
        ['Date', 'Type', 'Category', 'Amount', 'Note'],
        ...(transactions as any[]).map((tx: any) => [
          new Date(tx.date || tx.createdAt).toLocaleDateString(),
          tx.type,
          tx.category,
          tx.amount.toString(),
          tx.note ? `"${tx.note.replace(/"/g, '""')}"` : '',
        ]),
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const fileName = `transactions_${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}.csv`;
      const filePath = `${(FileSystem as any).documentDirectory}${fileName}`;
      await (FileSystem as any).writeAsStringAsync(filePath, csv, { encoding: 'utf8' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export Transactions' });
      } else {
        Alert.alert('Exported', `File saved to: ${filePath}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  const handleWipeLocalData = () => {
    Alert.alert(
      'Wipe All Local Data',
      'This will permanently delete all locally stored transactions, categories, and budgets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe', style: 'destructive',
          onPress: async () => {
            setWiping(true);
            try {
              await discardLocalData();
              Alert.alert('Done', 'All local data has been wiped.');
            } catch {
              Alert.alert('Error', 'Failed to wipe local data.');
            } finally {
              setWiping(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.label}>Data</ThemedText>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

        {/* Cloud backup status — logged-in users only */}
        {!isGuest && (
          <>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
                  <Ionicons name="cloud-done-outline" size={20} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Cloud Backup</Text>
                  <Text style={[styles.rowSub, { color: theme.secondaryText }]}>
                    Last synced: {formatSyncTime(lastSync)}
                  </Text>
                </View>
              </View>
              <View style={[styles.syncDot, { backgroundColor: lastSync ? theme.tint : theme.secondaryText }]} />
            </View>
            <View style={[styles.sep, { backgroundColor: theme.separator }]} />
          </>
        )}

        <TouchableOpacity style={styles.row} onPress={() => router.push('/manage-categories')} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
              <Ionicons name="grid-outline" size={20} color="#FFF" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Category Management</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.icon} />
        </TouchableOpacity>

        <View style={[styles.sep, { backgroundColor: theme.separator }]} />

        <TouchableOpacity style={styles.row} onPress={handleExport} disabled={exporting} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
              <Ionicons name="download-outline" size={20} color="#FFF" />
            </View>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Export This Month (CSV)</Text>
          </View>
          {exporting
            ? <ActivityIndicator size="small" color={theme.tint} />
            : <Ionicons name="chevron-forward" size={18} color={theme.icon} />
          }
        </TouchableOpacity>

        {isGuest && (
          <>
            <View style={[styles.sep, { backgroundColor: theme.separator }]} />
            <TouchableOpacity style={styles.row} onPress={handleWipeLocalData} disabled={wiping} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.danger }]}>
                  <Ionicons name="trash-outline" size={20} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: theme.danger }]}>Wipe All Local Data</Text>
                  <Text style={[styles.rowSub, { color: theme.secondaryText }]}>Permanently delete offline data</Text>
                </View>
              </View>
              {wiping
                ? <ActivityIndicator size="small" color={theme.danger} />
                : <Ionicons name="chevron-forward" size={18} color={theme.danger} />
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  label: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },
  card:     { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox:  { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub:   { fontSize: 12, marginTop: 1 },
  sep:      { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  syncDot:  { width: 8, height: 8, borderRadius: 4 },
});
