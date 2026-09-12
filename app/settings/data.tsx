import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { getAllTransactions, getCurrentGroup as getCategoryData } from '@/src/services/dataService';
import { getLastSyncTime } from '@/src/services/syncService';
import apiClient from '@/src/services/apiClient';
import { generateMonthlyPDF } from '@/src/services/reportService';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { space, type, icon as iconSize } from '@/constants/tokens';
import {
  Screen, Card, Row, Touchable, Button, Sheet, SectionHeader, Chip,
  type SheetHandle,
} from '@/components/ui';

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

const RANGES = [
  { key: 'week',  label: 'This week',  icon: 'calendar-outline'        },
  { key: 'month', label: 'This month', icon: 'calendar-number-outline' },
  { key: 'year',  label: 'This year',  icon: 'stats-chart-outline'     },
  { key: 'all',   label: 'All time',   icon: 'infinite-outline'        },
] as const;

export default function DataScreen() {
  const { theme }               = useTheme();
  const { isGuest, logout }     = useAuth();
  const { prefs }               = usePreferences();

  const [lastSync,          setLastSync]          = useState<string | null>(null);
  const [working,           setWorking]           = useState(false);
  const [exporting,         setExporting]         = useState(false);
  const [exportSheetType,   setExportSheetType]   = useState<'csv' | 'xlsx' | 'pdf' | null>(null);
  const [exportCustomFrom,  setExportCustomFrom]  = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [exportCustomTo,    setExportCustomTo]    = useState(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [exportShowCustom,  setExportShowCustom]  = useState(false);
  const [exportDateTarget,  setExportDateTarget]  = useState<'from' | 'to' | null>(null);
  const exportSheet = useRef<SheetHandle>(null);

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
    const allTxs = await getAllTransactions() as any[];
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
    exportSheet.current?.dismiss();
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
      const txs = await getAllTransactions() as any[];
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
      const txs = await getAllTransactions() as any[];
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

  const openExport = (kind: 'csv' | 'xlsx' | 'pdf') => {
    setExportShowCustom(false);
    setExportSheetType(kind);
    exportSheet.current?.present();
  };

  const rangeFor = (key: typeof RANGES[number]['key']) =>
    key === 'week' ? rangeThisWeek() : key === 'month' ? rangeThisMonth() : key === 'year' ? rangeThisYear() : rangeAllTime();

  const busy = working || exporting;

  return (
    <Screen title="Data">
      {!isGuest && (
        <>
          <SectionHeader title="Cloud backup" />
          <Card padded={false}>
            <Row
              icon="cloud-done-outline"
              title="Cloud backup"
              subtitle={formatSyncTime(lastSync)}
              right={<Chip size="sm" tone={lastSync ? 'income' : 'neutral'} label={lastSync ? 'Synced' : 'Not yet'} />}
              last
            />
          </Card>
        </>
      )}

      <SectionHeader title="Export" />
      <Card padded={false}>
        <Row icon="download-outline"      title="Export CSV"        subtitle="Choose a date range"           onPress={() => openExport('csv')}  disabled={busy} />
        <Row icon="document-outline"      title="Export XLSX"       subtitle="Excel — choose a date range"   onPress={() => openExport('xlsx')} disabled={busy} />
        <Row icon="document-text-outline" title="Export PDF report" subtitle="Summary — choose a date range" onPress={() => openExport('pdf')}  disabled={busy} last />
      </Card>

      <SectionHeader title="Backup" />
      <Card padded={false}>
        <Row icon="save-outline"         title="Backup to device"      subtitle="Export all transactions as JSON"      onPress={backupToDevice}     disabled={busy} right={working ? <ActivityIndicator size="small" color={theme.tint} /> : undefined} />
        <Row icon="mail-outline"         title="Send backup via email" subtitle="Share a JSON backup"                  onPress={sendBackupViaEmail} disabled={busy} />
        <Row icon="cloud-upload-outline" title="Restore from backup"   subtitle="Import transactions from a JSON file" onPress={restoreFromBackup}  disabled={busy} last />
      </Card>

      <SectionHeader title="Import" />
      <Card padded={false}>
        <Row icon="cloud-download-outline" title="Import Excel / CSV" subtitle="Import .xlsx or .csv transactions" onPress={importExcel} disabled={busy} last />
      </Card>

      <SectionHeader title="Reset" />
      <Card padded={false}>
        <Row danger icon="refresh-outline" title="Reset contents only" subtitle="Delete all transactions, keep settings" onPress={resetContents} disabled={busy} />
        <Row danger icon="nuclear-outline" title="Full reset"          subtitle="Delete everything and log out"         onPress={fullReset}     disabled={busy} last />
      </Card>

      {/* ── Export range ── */}
      <Sheet
        ref={exportSheet}
        title={`Export ${exportSheetType?.toUpperCase() ?? ''}`}
        onDismiss={() => { setExportSheetType(null); setExportDateTarget(null); }}
        keyboard="none"
      >
        <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.md }]}>Select a date range</Text>
        <View style={S.rangeGrid}>
          {RANGES.map(r => (
            <Card key={r.key} tone="alt" onPress={() => runExport(rangeFor(r.key))} accessibilityLabel={r.label} style={S.rangeTile}>
              <Ionicons name={r.icon} size={iconSize.lg} color={theme.tint} />
              <Text style={[type.label, { color: theme.text }]}>{r.label}</Text>
            </Card>
          ))}
        </View>

        <Touchable onPress={() => setExportShowCustom(v => !v)} haptic="selection" style={S.customToggle} accessibilityLabel="Custom range">
          <Ionicons name="options-outline" size={iconSize.sm} color={theme.tint} />
          <Text style={[type.label, { color: theme.tint, flex: 1 }]}>Custom range</Text>
          <Ionicons name={exportShowCustom ? 'chevron-up' : 'chevron-down'} size={iconSize.sm} color={theme.secondaryText} />
        </Touchable>

        {exportShowCustom && (
          <View style={{ gap: space.md }}>
            <View style={S.dateRow}>
              <Card tone="alt" onPress={() => openExportDatePicker('from')} accessibilityLabel={`From ${fmtExportDate(exportCustomFrom)}`} style={S.dateTile}>
                <Text style={[type.overline, { color: theme.secondaryText }]}>From</Text>
                <Text style={[type.bodyStrong, { color: theme.text }]}>{fmtExportDate(exportCustomFrom)}</Text>
              </Card>
              <Ionicons name="arrow-forward" size={iconSize.sm} color={theme.secondaryText} />
              <Card tone="alt" onPress={() => openExportDatePicker('to')} accessibilityLabel={`To ${fmtExportDate(exportCustomTo)}`} style={S.dateTile}>
                <Text style={[type.overline, { color: theme.secondaryText }]}>To</Text>
                <Text style={[type.bodyStrong, { color: theme.text }]}>{fmtExportDate(exportCustomTo)}</Text>
              </Card>
            </View>
            <Button label="Export selected range" onPress={() => runExport({ from: exportCustomFrom, to: exportCustomTo, label: 'custom' })} loading={exporting} />

            {Platform.OS === 'ios' && exportDateTarget && (
              <View style={[S.iosPicker, { borderTopColor: theme.separator }]}>
                <View style={S.iosPickerHead}>
                  <Text style={[type.bodyStrong, { color: theme.text }]}>{exportDateTarget === 'from' ? 'Start date' : 'End date'}</Text>
                  <Button size="sm" variant="ghost" label="Done" onPress={() => setExportDateTarget(null)} />
                </View>
                <DateTimePicker
                  value={exportDateTarget === 'from' ? exportCustomFrom : exportCustomTo}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, d) => { if (d) { exportDateTarget === 'from' ? setExportCustomFrom(d) : setExportCustomTo(d); } }}
                  style={{ width: '100%' }}
                />
              </View>
            )}
          </View>
        )}
      </Sheet>

      {busy && (
        <View style={S.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[type.label, { color: theme.text }]}>{exporting ? 'Exporting…' : 'Working…'}</Text>
        </View>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  rangeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rangeTile:     { width: '47%', flexGrow: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.md },
  customToggle:  { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, marginTop: space.sm },
  dateRow:       { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateTile:      { flex: 1, gap: 2, padding: space.md },
  iosPicker:     { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  iosPickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay:       { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(0,0,0,0.35)' },
});
