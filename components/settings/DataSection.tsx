import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { getTransactions } from '@/src/services/transactionApi';
import { router } from 'expo-router';

interface Props {
  theme: any;
}

export function DataSection({ theme }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const transactions = await getTransactions(now.getMonth() + 1, now.getFullYear());
      const rows = [
        ['Date', 'Type', 'Category', 'Amount', 'Note'],
        ...transactions.map((tx: any) => [
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

  return (
    <View style={styles.section}>
      <ThemedText style={styles.label}>Data</ThemedText>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}
        onPress={() => router.push('/manage-categories')}
      >
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: `${theme.tint}15` }]}>
              <Ionicons name="grid-outline" size={20} color={theme.tint} />
            </View>
            <ThemedText style={{ fontWeight: '600' }}>Category Management</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.icon} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16, marginTop: 12 }]}
        onPress={handleExport}
        disabled={exporting}
      >
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: `${theme.income}15` }]}>
              <Ionicons name="download-outline" size={20} color={theme.income} />
            </View>
            <ThemedText style={{ fontWeight: '600' }}>Export This Month (CSV)</ThemedText>
          </View>
          {exporting ? (
            <ActivityIndicator size="small" color={theme.income} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card:    { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
