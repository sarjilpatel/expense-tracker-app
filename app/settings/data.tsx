import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { getTransactions, getCurrentGroup as getCategoryData } from '@/src/services/dataService';
import { getLastSyncTime } from '@/src/services/syncService';
import apiClient from '@/src/services/apiClient';
import { generateMonthlyPDF } from '@/src/services/reportService';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';

function Row({
  icon, iconBg, iconColor, title, sub, right, onPress, danger,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const { theme } = useTheme();
  const content = (
    <View style={S.row}>
      <View style={[S.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={S.rowMid}>
        <Text style={[S.rowTitle, { color: danger ? (theme.danger ?? '#F55345') : theme.text }]}>{title}</Text>
        {sub ? <Text style={[S.rowSub, { color: theme.secondaryText }]}>{sub}</Text> : null}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          : null}
    </View>
  );
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>;
}

function Sep() {
  const { theme } = useTheme();
  return <View style={[S.sep, { backgroundColor: theme.separator }]} />;
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (hrs < 48)  return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function DataScreen() {
  const { theme }               = useTheme();
  const { isGuest, logout }     = useAuth();
  const { prefs }               = usePreferences();
  const { top }                 = useSafeAreaInsets();

  const [lastSync,          setLastSync]          = useState<string | null>(null);
  const [working,           setWorking]           = useState(false);
  const [exporting,         setExporting]         = useState(false);
  const [exportSheetType,   setExportSheetType]   = useState<'csv' | 'xlsx' | 'pdf' | null>(null);
  const [exportCustomFrom,  setExportCustomFrom]  = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [exportCustomTo,    setExportCustomTo]    = useState(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [exportShowCustom,  setExportShowCustom]  = useState(false);
  const [exportDateTarget,  setExportDateTarget]  = useState<'from' | 'to' | null>(null);

  const currencyMeta = CURRENCY_META[prefs.currency as CurrencyCode];

  useFocusEffect(useCallback(() => {
    if (!isGuest) {
      getLastSyncTime().then(setLastSync).catch(() => {});
    }
  }, [isGuest]));

  // ── Export helpers ──────────────────────────────────────────────
  function fmtExportDate(d: Date): string {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function rangeThisWeek() {
    const now = new Date();
    const from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0);
    const to   = new Date(now); to.setHours(23,59,59,999);
    return { from, to, label: 'this_week' };
  }
  function rangeThisMonth() {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now); to.setHours(23,59,59,999);
    return { from, to, label: `${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}` };
  }
  function rangeThisYear() {
    const now  = new Date();
    const from = new Date(now.getFullYear(), 0, 1);
    const to   = new Date(now); to.setHours(23,59,59,999);
    return { from, to, label: `${now.getFullYear()}` };
  }
  function rangeAllTime() {
    return { from: new Date(0), to: new Date(), label: 'all_time' };
  }

  async function fetchRangeTxs(from: Date, to: Date): Promise<any[]> {
    const allTxs = await getTransactions(undefined, undefined) as any[];
    return (allTxs || []).filter((tx: any) => {
      const d = new Date(tx.date || tx.createdAt);
      return d >= from && d <= to;
    });
  }

  const openExportDatePicker = (target: 'from' | 'to') => {
    const current = target === 'from' ? exportCustomFrom : exportCustomTo;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current, mode: 'date', maximumDate: new Date(),
        onChange: (_, d) => { if (d) { target === 'from' ? setExportCustomFrom(d) : setExportCustomTo(d); } },
      });
    } else {
      setExportDateTarget(target);
    }
  };

  const runExport = async (range: { from: Date; to: Date; label: string }) => {
    const type = exportSheetType;
    if (!type) return;
    setExportSheetType(null);
    setExportShowCustom(false);
    setExporting(true);
    try {
      const txs = await fetchRangeTxs(range.from, range.to);
      const safeName = range.label.replace(/[^a-z0-9_-]/gi, '_');

      if (type === 'csv') {
        const rows = [
          ['Date','Type','Category','Amount','Currency','Note','Recurring','Private','Member'],
          ...txs.map(tx => [
            new Date(tx.date || tx.createdAt).toLocaleDateString(),
            tx.type, tx.category, tx.amount.toString(),
            tx.currency || 'INR',
            tx.note ? `"${(tx.note as string).replace(/"/g, '""')}"` : '',
            tx.isRecurring ? 'Yes' : 'No',
            tx.isPrivate   ? 'Yes' : 'No',
            tx.userId?.name || '',
          ]),
        ];
        const csv  = rows.map(r => r.join(',')).join('\n');
        const path = `${FileSystem.documentDirectory}transactions_${safeName}.csv`;
        await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
        } else {
          Alert.alert('Exported', `Saved to: ${path}`);
        }
      } else if (type === 'xlsx') {
        const rows = txs.map(tx => ({
          Date:      new Date(tx.date || tx.createdAt).toLocaleDateString(),
          Type:      tx.type,
          Category:  tx.category,
          Amount:    tx.amount,
          Currency:  tx.currency || 'INR',
          Note:      tx.note || '',
          Recurring: tx.isRecurring ? 'Yes' : 'No',
          Private:   tx.isPrivate   ? 'Yes' : 'No',
          Member:    tx.userId?.name || '',
        }));
        if (rows.length === 0) rows.push({ Date:'', Type:'', Category:'', Amount:0, Currency:'', Note:'', Recurring:'', Private:'', Member:'' });
        const ws     = XLSX.utils.json_to_sheet(rows);
        const wb     = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const path   = `${FileSystem.documentDirectory}transactions_${safeName}.xlsx`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Export XLSX' });
        } else {
          Alert.alert('Exported', `Saved to: ${path}`);
        }
      } else {
        const totalIncome  = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
        const totalExpense = txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
        const catMap: Record<string, number> = {};
        txs.filter(tx => tx.type === 'expense').forEach(tx => {
          catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
        });
        const categoryBreakdown = Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => ({
            category, amount,
            percentage: totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0',
          }));
        const analytics = { totalIncome, totalExpense, categoryBreakdown };
        const groupData  = await getCategoryData().catch(() => null);
        const now        = new Date();
        await generateMonthlyPDF(txs, analytics, now.getMonth() + 1, now.getFullYear(), (groupData as any)?.name, range.label);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  // ── Backup / Restore ────────────────────────────────────────────
  const backupToDevice = async () => {
    try {
      setWorking(true);
      const txs = await getTransactions(undefined, undefined) as any[];
      const payload = { version: '1.0', exportedAt: new Date().toISOString(), transactions: txs };
      const json = JSON.stringify(payload, null, 2);
      const path = `${FileSystem.documentDirectory}expense_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Save Backup' });
      }
    } catch (e: any) { Alert.alert('Backup failed', e?.message); }
    finally { setWorking(false); }
  };

  const sendBackupViaEmail = async () => {
    try {
      setWorking(true);
      const txs = await getTransactions(undefined, undefined) as any[];
      const payload = { version: '1.0', exportedAt: new Date().toISOString(), transactions: txs };
      const json = JSON.stringify(payload, null, 2);
      const path = `${FileSystem.documentDirectory}expense_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Send Backup via Email' });
      }
    } catch (e: any) { Alert.alert('Backup failed', e?.message); }
    finally { setWorking(false); }
  };

  const restoreFromBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed = JSON.parse(content);
      if (!parsed.transactions) { Alert.alert('Invalid file', 'Not a valid backup file.'); return; }
      Alert.alert('Restore Backup', `Import ${parsed.transactions.length} transactions? This will ADD them to existing data.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: async () => {
          setWorking(true);
          try {
            await apiClient.post('/transactions/import-json', { transactions: parsed.transactions });
            Alert.alert('Done', 'Backup restored successfully.');
          } catch (e: any) { Alert.alert('Import failed', e?.message); }
          finally { setWorking(false); }
        }},
      ]);
    } catch (e: any) { Alert.alert('Error', e?.message); }
  };

  // ── Import Excel ─────────────────────────────────────────────────
  const importExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setWorking(true);
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(content, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const transactions = rows.map(row => ({
        date:     row['Date']     || row['date']     || new Date().toISOString(),
        type:     (row['Type']    || row['type']     || 'expense').toLowerCase(),
        category: row['Category'] || row['category'] || 'Other',
        amount:   parseFloat(row['Amount'] || row['amount'] || 0),
        note:     row['Note']     || row['note']     || '',
        currency: row['Currency'] || row['currency'] || 'INR',
      })).filter(tx => tx.amount > 0);
      Alert.alert('Import Excel', `Found ${transactions.length} transactions. Import them?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: async () => {
          try {
            await apiClient.post('/transactions/import-json', { transactions });
            Alert.alert('Done', `${transactions.length} transactions imported.`);
          } catch (e: any) { Alert.alert('Import failed', e?.message); }
          finally { setWorking(false); }
        }},
      ]);
    } catch (e: any) { Alert.alert('Error', e?.message); setWorking(false); }
  };

  // ── Reset ────────────────────────────────────────────────────────
  const resetContents = () => Alert.alert(
    'Reset Contents Only',
    'This will delete all your transactions. Accounts, categories and settings will remain. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        setWorking(true);
        try {
          await apiClient.delete('/transactions/all');
          Alert.alert('Done', 'All transactions deleted.');
        } catch (e: any) { Alert.alert('Error', e?.message); }
        finally { setWorking(false); }
      }},
    ]
  );

  const fullReset = () => Alert.alert(
    'Full Reset',
    'This will permanently delete ALL your data including transactions, accounts, categories, and settings. You will be logged out. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
        setWorking(true);
        try {
          await apiClient.delete('/user/all-data');
          await logout();
          router.replace('/(tabs)');
        } catch (e: any) { Alert.alert('Error', e?.message); setWorking(false); }
      }},
    ]
  );

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={16}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: theme.text }]}>Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Cloud Backup (logged-in only) ── */}
        {!isGuest && (
          <>
            <Text style={[S.groupLabel, { color: theme.secondaryText }]}>CLOUD BACKUP</Text>
            <Card>
              <View style={S.row}>
                <View style={[S.iconBox, { backgroundColor: '#0F766E' }]}>
                  <Ionicons name="cloud-done-outline" size={18} color="#FFF" />
                </View>
                <View style={S.rowMid}>
                  <Text style={[S.rowTitle, { color: theme.text }]}>Cloud Backup</Text>
                  <Text style={[S.rowSub, { color: theme.secondaryText }]}>{formatSyncTime(lastSync)}</Text>
                </View>
                <View style={[S.syncDot, { backgroundColor: lastSync ? '#10B981' : theme.secondaryText }]} />
              </View>
            </Card>
          </>
        )}

        {/* ── Export ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>EXPORT</Text>
        <Card>
          <Row
            icon="download-outline" iconBg="#0F766E" iconColor="#FFF"
            title="Export CSV" sub="Choose date range"
            onPress={() => { setExportShowCustom(false); setExportSheetType('csv'); }}
            right={exporting ? <ActivityIndicator size="small" color="#0F766E" /> : undefined}
          />
          <Sep />
          <Row
            icon="document-outline" iconBg="#0F766E" iconColor="#FFF"
            title="Export XLSX" sub="Excel — choose date range"
            onPress={() => { setExportShowCustom(false); setExportSheetType('xlsx'); }}
          />
          <Sep />
          <Row
            icon="document-text-outline" iconBg="#0F766E" iconColor="#FFF"
            title="Export PDF Report" sub="Summary — choose date range"
            onPress={() => { setExportShowCustom(false); setExportSheetType('pdf'); }}
          />
        </Card>

        {/* ── Backup ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>BACKUP</Text>
        <Card>
          <Row
            icon="save-outline" iconBg="#3B82F6" iconColor="#FFF"
            title="Backup to Device" sub="Export all transactions as JSON"
            onPress={backupToDevice}
            right={working ? <ActivityIndicator size="small" color="#3B82F6" /> : undefined}
          />
          <Sep />
          <Row
            icon="mail-outline" iconBg="#3B82F618" iconColor="#3B82F6"
            title="Send Backup via Email" sub="Share JSON backup via email"
            onPress={sendBackupViaEmail}
          />
          <Sep />
          <Row
            icon="cloud-upload-outline" iconBg="#3B82F618" iconColor="#3B82F6"
            title="Restore from Backup" sub="Import transactions from a JSON file"
            onPress={restoreFromBackup}
          />
        </Card>

        {/* ── Import ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>IMPORT</Text>
        <Card>
          <Row
            icon="cloud-download-outline" iconBg="#6366F1" iconColor="#FFF"
            title="Import Excel / CSV" sub="Import .xlsx or .csv transactions"
            onPress={importExcel}
          />
        </Card>

        {/* ── Reset ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>RESET</Text>
        <Card>
          <Row
            icon="refresh-outline" iconBg={(theme.danger ?? '#F55345') + '18'} iconColor={theme.danger ?? '#F55345'}
            title="Reset Contents Only" sub="Delete all transactions, keep settings"
            onPress={resetContents} danger
          />
          <Sep />
          <Row
            icon="nuclear-outline" iconBg={(theme.danger ?? '#F55345') + '18'} iconColor={theme.danger ?? '#F55345'}
            title="Full Reset" sub="Delete everything and log out"
            onPress={fullReset} danger
          />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Export Range Sheet ── */}
      <Modal visible={exportSheetType !== null} transparent animationType="slide" onRequestClose={() => setExportSheetType(null)}>
        <View style={S.exportOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setExportSheetType(null)} />
          <View style={[S.exportSheet, { backgroundColor: theme.card }]}>
            <View style={S.exportHandle} />
            <Text style={[S.exportTitle, { color: theme.text }]}>
              Export {exportSheetType?.toUpperCase()}
            </Text>
            <Text style={[S.exportSub, { color: theme.secondaryText }]}>Select a date range</Text>

            <View style={S.exportGrid}>
              {[
                { label: 'This Week',  icon: 'calendar-outline',       fn: rangeThisWeek  },
                { label: 'This Month', icon: 'calendar-number-outline', fn: rangeThisMonth },
                { label: 'This Year',  icon: 'stats-chart-outline',     fn: rangeThisYear  },
                { label: 'All Time',   icon: 'infinite-outline',        fn: rangeAllTime   },
              ].map(({ label, icon, fn }) => (
                <TouchableOpacity
                  key={label}
                  style={[S.exportRangeBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => runExport(fn())}
                  disabled={exporting}
                  activeOpacity={0.8}
                >
                  <Ionicons name={icon as any} size={22} color={theme.tint} />
                  <Text style={[S.exportRangeBtnText, { color: theme.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[S.exportCustomToggle, { borderColor: theme.border }]}
              onPress={() => setExportShowCustom(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={17} color={theme.tint} />
              <Text style={[S.exportCustomToggleText, { color: theme.tint }]}>Custom Range</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name={exportShowCustom ? 'chevron-up' : 'chevron-down'} size={16} color={theme.secondaryText} />
            </TouchableOpacity>

            {exportShowCustom && (
              <View style={S.exportCustomSection}>
                <View style={S.exportDateRow}>
                  <TouchableOpacity
                    style={[S.exportDateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => openExportDatePicker('from')}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.exportDateLabel, { color: theme.secondaryText }]}>FROM</Text>
                    <Text style={[S.exportDateValue, { color: theme.text }]}>{fmtExportDate(exportCustomFrom)}</Text>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={16} color={theme.secondaryText} />
                  <TouchableOpacity
                    style={[S.exportDateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => openExportDatePicker('to')}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.exportDateLabel, { color: theme.secondaryText }]}>TO</Text>
                    <Text style={[S.exportDateValue, { color: theme.text }]}>{fmtExportDate(exportCustomTo)}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[S.exportGoBtn, { backgroundColor: theme.tint }]}
                  onPress={() => runExport({ from: exportCustomFrom, to: exportCustomTo, label: 'custom' })}
                  disabled={exporting}
                  activeOpacity={0.85}
                >
                  {exporting
                    ? <ActivityIndicator size="small" color={theme.tintText} />
                    : <Text style={[S.exportGoBtnText, { color: theme.tintText }]}>Export Selected Range</Text>
                  }
                </TouchableOpacity>

                {Platform.OS === 'ios' && exportDateTarget && (
                  <View style={[S.iosPickerWrap, { borderTopColor: theme.border }]}>
                    <View style={[S.iosPickerHeader, { borderBottomColor: theme.border }]}>
                      <Text style={[S.iosPickerTitle, { color: theme.text }]}>
                        {exportDateTarget === 'from' ? 'Select Start Date' : 'Select End Date'}
                      </Text>
                      <TouchableOpacity onPress={() => setExportDateTarget(null)}>
                        <Text style={[S.iosPickerDone, { color: theme.tint }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={exportDateTarget === 'from' ? exportCustomFrom : exportCustomTo}
                      mode="date"
                      display="spinner"
                      maximumDate={new Date()}
                      onChange={(_, d) => {
                        if (d) { exportDateTarget === 'from' ? setExportCustomFrom(d) : setExportCustomTo(d); }
                      }}
                      style={{ width: '100%' }}
                    />
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Modal>

      {/* Global loading overlay */}
      {(working || exporting) && (
        <View style={S.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[S.loadingText, { color: theme.text }]}>
            {exporting ? 'Exporting…' : 'Working…'}
          </Text>
        </View>
      )}
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, height: 44,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll:      { paddingHorizontal: 12, paddingBottom: 40 },

  groupLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 20, paddingLeft: 4,
  },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep:  { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowMid:  { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },

  syncDot: { width: 8, height: 8, borderRadius: 4 },

  // Export sheet
  exportOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  exportSheet:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  exportHandle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#8E8E93', alignSelf: 'center', marginBottom: 16 },
  exportTitle:     { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  exportSub:       { fontSize: 13, marginBottom: 16 },
  exportGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  exportRangeBtn:  { width: '47.5%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  exportRangeBtnText: { fontSize: 14, fontWeight: '700' },
  exportCustomToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 4,
  },
  exportCustomToggleText: { fontSize: 14, fontWeight: '700' },
  exportCustomSection: { marginTop: 12, gap: 12 },
  exportDateRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportDateBtn:   { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  exportDateLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  exportDateValue: { fontSize: 13, fontWeight: '700' },
  exportGoBtn:     { height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  exportGoBtnText: { fontSize: 15, fontWeight: '700' },
  iosPickerWrap:   { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  iosPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosPickerTitle:  { fontSize: 15, fontWeight: '600' },
  iosPickerDone:   { fontSize: 15, fontWeight: '600' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', gap: 12 },
  loadingText:    { fontSize: 14, fontWeight: '600' },
});
