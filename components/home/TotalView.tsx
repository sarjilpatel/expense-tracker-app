import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { getAllTransactions } from '@/src/services/dataService';
import { space, type } from '@/constants/tokens';
import { Sheet, Button, Card, Row, Amount, SectionHeader, type SheetHandle } from '@/components/ui';

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
  const sheet = useRef<SheetHandle>(null);
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
    sheet.current?.dismiss();
    setExporting(true);
    try {
      // Fetch the right transactions for this range
      let txList: any[];
      if (range.fetchYear === undefined) {
        txList = await getAllTransactions();
      } else {
        txList = await getAllTransactions(range.fetchMonth, range.fetchYear);
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
    <View style={S.wrap}>
      <Card padded={false}>
        <Row icon="create-outline" title="Budget" subtitle="Monthly limit and progress" onPress={() => router.push('/budget')} last />
      </Card>

      <SectionHeader title="Accounts" />
      <Text style={[type.label, { color: theme.secondaryText, marginTop: -space.xs, marginBottom: space.sm }]}>{dateRange}</Text>
      <Card padded={false}>
        <Row title="Compared to budget"        right={<Text style={[type.bodyStrong, { color: theme.text }]}>{comparedValue}</Text>} />
        <Row title="Expenses (cash, accounts)" right={<Amount value={summary.expense} kind="expense" />} />
        <Row title="Expenses (card)"           right={<Amount value={0} />} />
        <Row title="Transfers"                 right={<Amount value={0} />} last />
      </Card>

      <Button
        label="Export to Excel"
        icon="document-text-outline"
        variant="secondary"
        loading={exporting}
        disabled={exporting}
        onPress={() => sheet.current?.present()}
        style={{ marginTop: space.md }}
      />

      {/* Range picker, on the shared Sheet (W2-11). */}
      <Sheet ref={sheet} title="Export to Excel" keyboard="none">
        <Card padded={false}>
          {ranges.map((r, i) => (
            <Row
              key={r.label}
              title={r.label}
              subtitle={r.display}
              onPress={() => handleRangeSelect(r)}
              last={i === ranges.length - 1}
            />
          ))}
        </Card>
      </Sheet>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.md },
});
