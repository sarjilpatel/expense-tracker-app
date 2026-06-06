import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Currency } from '@/constants/theme';
import { getTransactions } from '@/src/services/transactionApi';

interface Props {
  transactions: any[];
  summary: { income: number; expense: number; balance: number };
  budget: any;
  month: number;
  year: number;
  theme: any;
  t: (key: string) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtShort = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

function buildRanges(month: number, year: number) {
  const now     = new Date();
  const thisM1  = new Date(year, month - 1, 1);
  const thisM2  = new Date(year, month, 0);
  const lastM1  = new Date(year, month - 2, 1);
  const lastM2  = new Date(year, month - 1, 0);
  const annY1   = new Date(year, 0, 1);
  const annY2   = new Date(year, 11, 31);
  const lastY1  = new Date(year - 1, 0, 1);
  const lastY2  = new Date(year - 1, 11, 31);

  return [
    { label: 'Monthly',  display: `${fmtDate(thisM1)} ~ ${fmtShort(thisM2)}`, fetchMonth: month,     fetchYear: year,     from: thisM1, to: thisM2 },
    { label: 'Last M',   display: `${fmtDate(lastM1)} ~ ${fmtShort(lastM2)}`, fetchMonth: month - 1 <= 0 ? 12 : month - 1, fetchYear: month - 1 <= 0 ? year - 1 : year, from: lastM1, to: lastM2 },
    { label: 'Annually', display: `${fmtDate(annY1)} ~ ${fmtShort(annY2)}`,  fetchMonth: undefined,  fetchYear: year,     from: annY1,  to: annY2  },
    { label: 'Last Y',   display: `${fmtDate(lastY1)} ~ ${fmtShort(lastY2)}`,fetchMonth: undefined,  fetchYear: year - 1, from: lastY1, to: lastY2 },
    { label: 'Total',    display: 'All time',                                  fetchMonth: undefined,  fetchYear: undefined,from: null,   to: null   },
  ];
}

function buildWorkbook(txList: any[], sheetName: string): string {
  const rows = txList.map(tx => {
    const d = new Date(tx.date || tx.createdAt);
    return {
      Date:     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      Time:     `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      Category: tx.category ?? '',
      Note:     tx.note ?? '',
      Type:     tx.type ?? '',
      Amount:   tx.amount ?? 0,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 8  }, // Time
    { wch: 14 }, // Category
    { wch: 24 }, // Note
    { wch: 8  }, // Type
    { wch: 12 }, // Amount
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function TotalView({ transactions, summary, budget, month, year, theme }: Props) {
  const [showSheet,   setShowSheet]   = useState(false);
  const [exporting,   setExporting]   = useState(false);

  const dates    = transactions.map(tx => new Date(tx.date || tx.createdAt).getTime()).filter(Boolean);
  const minDate  = dates.length ? new Date(Math.min(...dates)) : new Date(year, month - 1, 1);
  const maxDate  = dates.length ? new Date(Math.max(...dates)) : new Date(year, month, 0);
  const dateRange = `${fmtDate(minDate)} ~ ${fmtShort(maxDate)}`;

  const comparedValue = budget?.amount && summary.expense
    ? `${Math.round((summary.expense / budget.amount) * 100)}%`
    : '—';

  const ranges = buildRanges(month, year);

  const handleRangeSelect = async (range: typeof ranges[0]) => {
    setShowSheet(false);
    setExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Fetch the right transactions for this range
      let txList: any[];
      if (range.fetchYear === undefined) {
        txList = await getTransactions(undefined, undefined);
      } else {
        txList = await getTransactions(range.fetchMonth, range.fetchYear);
      }

      // Filter by exact date range if needed
      if (range.from && range.to) {
        const from = range.from.getTime();
        const to   = new Date(range.to).setHours(23, 59, 59, 999);
        txList = txList.filter(tx => {
          const t = new Date(tx.date || tx.createdAt).getTime();
          return t >= from && t <= to;
        });
      }

      if (txList.length === 0) {
        setExporting(false);
        return;
      }

      // Sort by date
      txList.sort((a, b) =>
        new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()
      );

      const sheetName = range.label.replace(/\s/g, '_');
      const base64    = buildWorkbook(txList, sheetName);
      const fileName  = `expenses_${sheetName.toLowerCase()}_${year}.xlsx`;
      const filePath  = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save or share your expense data',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View>
      {/* ── Budget row ── */}
      <View style={[styles.budgetRow, { borderBottomColor: theme.border }]}>
        <View style={styles.rowLeft}>
          <Ionicons name="create-outline" size={22} color={theme.text} />
          <Text style={[styles.budgetTitle, { color: theme.text }]}>Budget</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/budget')}
          activeOpacity={0.75}
          style={[styles.budgetBtn, { backgroundColor: theme.cardAlt }]}
        >
          <Text style={[styles.budgetBtnText, { color: theme.secondaryText }]}>Budget Setting</Text>
          <Ionicons name="chevron-forward" size={13} color={theme.secondaryText} />
        </TouchableOpacity>
      </View>

      {/* ── Accounts header ── */}
      <View style={styles.sectionHeader}>
        <View style={styles.rowLeft}>
          <Ionicons name="server-outline" size={20} color={theme.text} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Accounts</Text>
        </View>
        <Text style={[styles.dateRange, { color: theme.secondaryText }]}>{dateRange}</Text>
      </View>

      {/* ── Stats card ── */}
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <StatRow label="Compared Expenses (Last month)" value={comparedValue}                    valueColor={theme.text}    theme={theme} />
        <StatRow label="Expenses (Cash, Accounts)"      value={Currency.format(summary.expense)} valueColor={theme.text}    theme={theme} />
        <StatRow label="Expenses (Card)"                value={Currency.format(0)}               valueColor={theme.text}    theme={theme} />
        <StatRow label="Transfer (Cash, Accounts→ )"    value={Currency.format(0)}               valueColor={theme.text}    theme={theme} last />
      </View>

      {/* ── Export button ── */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSheet(true); }}
        activeOpacity={0.75}
        disabled={exporting}
        style={[styles.exportBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
      >
        {exporting ? (
          <ActivityIndicator size="small" color="#2ECC71" />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={18} color="#2ECC71" />
            <Text style={[styles.exportText, { color: theme.text }]}>Export data to Excel</Text>
          </>
        )}
      </TouchableOpacity>

      {/* ── Range picker sheet ── */}
      <Modal visible={showSheet} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSheet(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            {/* Sheet header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Money Manager - Excel</Text>
              <TouchableOpacity onPress={() => setShowSheet(false)}>
                <Ionicons name="close" size={22} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            {/* Options */}
            <FlatList
              data={ranges}
              keyExtractor={r => r.label}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => handleRangeSelect(item)}
                  activeOpacity={0.65}
                  style={[
                    styles.rangeRow,
                    { borderBottomColor: theme.border },
                    index === ranges.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.rangeLabel, { color: theme.text }]}>
                    {item.label}
                    {item.display !== 'All time' ? (
                      <Text style={[styles.rangeSub, { color: theme.secondaryText }]}>
                        {'  '}({item.display})
                      </Text>
                    ) : (
                      <Text style={[styles.rangeSub, { color: theme.secondaryText }]}> </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatRow({ label, value, valueColor, theme, last = false }: {
  label: string; value: string; valueColor: string; theme: any; last?: boolean;
}) {
  return (
    <View style={[
      styles.statRow,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    ]}>
      <Text style={[styles.statLabel, { color: theme.secondaryText }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetTitle:  { fontSize: 16, fontWeight: '700' },
  budgetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  budgetBtnText: { fontSize: 12, fontWeight: '500' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    marginTop: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  dateRange:    { fontSize: 12 },

  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  statLabel: { fontSize: 14, flex: 1, marginRight: 12 },
  statValue: { fontSize: 14, fontWeight: '500' },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 20, paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
  },
  exportText: { fontSize: 14, fontWeight: '500' },

  // Sheet
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  rangeRow: {
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeLabel: { fontSize: 15, fontWeight: '400' },
  rangeSub:   { fontSize: 13, fontWeight: '400' },
});
