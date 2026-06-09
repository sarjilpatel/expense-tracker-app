import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Currency } from '@/constants/theme';
import { MONTHS, DAY_NAMES, CATEGORY_EMOJIS } from '@/constants/maps';

interface DayData { income: number; expense: number; items: any[] }

interface Props {
  transactions: any[];
  month: number;
  year: number;
  theme: any;
  t: (key: string) => string;
  onTransactionPress: (item: any) => void;
}

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Format like the reference: "1,200.00", "-803.00"
const fmtAmt = (val: number): string => {
  const abs = Math.abs(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val < 0 ? `-${abs}` : abs;
};

export function CalendarView({ transactions, month, year, theme, t, onTransactionPress }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const dailyMap = useMemo(() => {
    const m: Record<string, DayData> = {};
    for (const tx of transactions) {
      const d   = new Date(tx.date || tx.createdAt);
      const key = toKey(d);
      if (!m[key]) m[key] = { income: 0, expense: 0, items: [] };
      if (tx.type === 'income') m[key].income += tx.amount;
      else                      m[key].expense += tx.amount;
      m[key].items.push(tx);
    }
    return m;
  }, [transactions]);

  const firstDOW    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells  = Math.ceil((firstDOW + daysInMonth) / 7) * 7;
  const todayKey    = toKey(new Date());
  const selectedData = selectedKey ? dailyMap[selectedKey] : null;

  // Build explicit week rows so flex:1 distributes width correctly
  const weeks: number[][] = [];
  for (let i = 0; i < totalCells; i += 7) {
    weeks.push([0, 1, 2, 3, 4, 5, 6].map(j => i + j));
  }

  const div = theme.border;

  return (
    <View style={styles.wrap}>
      {/* ── Day-of-week header ── */}
      <View style={[styles.headerRow, { borderBottomColor: div, borderTopColor: div }]}>
        {DAY_NAMES.map((name, i) => (
          <View
            key={i}
            style={[
              styles.headerCell,
              i < 6 && { borderRightColor: div, borderRightWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={[
              styles.headerLabel,
              {
                color: i === 0
                  ? theme.expense
                  : i === 6
                  ? theme.primary
                  : theme.secondaryText,
              },
            ]}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Week rows ── */}
      {weeks.map((week, wi) => (
        <View key={wi} style={[styles.weekRow, { borderBottomColor: div }]}>
          {week.map((idx, colIdx) => {
            const cellDate = new Date(year, month - 1, idx - firstDOW + 1);
            const key      = toKey(cellDate);
            const isCurMon = cellDate.getMonth() + 1 === month;
            const data     = dailyMap[key];         // show transactions even for adjacent month
            const isSel    = selectedKey === key;
            const isToday  = key === todayKey;
            const isSun    = colIdx === 0;
            const isSat    = colIdx === 6;

            const balance = (data?.income ?? 0) - (data?.expense ?? 0);
            const hasInc  = (data?.income  ?? 0) > 0;
            const hasExp  = (data?.expense ?? 0) > 0;
            const hasBal  = hasInc || hasExp;

            // Date label — show "day.month" for first day of adjacent months
            const showSuffix  = !isCurMon && cellDate.getDate() === 1;
            const dateLabel   = cellDate.getDate() + (showSuffix ? `.${cellDate.getMonth() + 1}` : '');

            // Backgrounds
            const cellBg = isSel
              ? theme.surface
              : isToday
              ? theme.border
              : theme.card;

            // Date number color
            const numColor = isSel
              ? theme.tint
              : !isCurMon
              ? theme.secondaryText
              : isSun
              ? theme.expense
              : isSat
              ? theme.primary
              : theme.text;

            // Amount colors
            const incC = theme.income;
            const expC = theme.expense;
            const balC = theme.secondaryText;

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedKey(key === selectedKey ? null : key)}
                activeOpacity={0.7}
                style={[
                  styles.cell,
                  {
                    backgroundColor: cellBg,
                    borderRightColor: div,
                    borderRightWidth: colIdx < 6 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                {/* Date at top-left */}
                <Text style={[
                  styles.dateNum,
                  {
                    color: numColor,
                    fontWeight: isToday || isSel ? '800' : '400',
                  },
                ]}>
                  {dateLabel}
                </Text>

                {/* Income / Expense / Balance at bottom-right */}
                <View style={styles.amtBlock}>
                  {hasInc && (
                    <Text numberOfLines={1} style={[styles.amt, { color: incC }]}>
                      {fmtAmt(data!.income)}
                    </Text>
                  )}
                  {hasExp && (
                    <Text numberOfLines={1} style={[styles.amt, { color: expC }]}>
                      {fmtAmt(data!.expense)}
                    </Text>
                  )}
                  {hasBal && (
                    <Text numberOfLines={1} style={[styles.amt, { color: balC }]}>
                      {fmtAmt(balance)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* ── Selected day detail panel ── */}
      {selectedKey && (
        <Animated.View
          entering={FadeInDown.duration(200).springify().damping(18)}
          style={[styles.panel, { borderTopColor: div }]}
        >
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={[styles.panelDate, { color: theme.text }]}>
              {(() => {
                const d = new Date(selectedKey + 'T00:00:00');
                return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
              })()}
            </Text>
            <View style={styles.panelTotals}>
              {(selectedData?.income  ?? 0) > 0 && (
                <Text style={[styles.panelTotal, { color: theme.income }]}>
                  +{Currency.format(selectedData!.income)}
                </Text>
              )}
              {(selectedData?.expense ?? 0) > 0 && (
                <Text style={[styles.panelTotal, { color: theme.expense }]}>
                  -{Currency.format(selectedData!.expense)}
                </Text>
              )}
            </View>
          </View>

          {/* Transaction rows */}
          {selectedData && selectedData.items.length > 0 ? (
            selectedData.items.map((tx: any, i: number) => (
              <TouchableOpacity
                key={tx._id || i}
                onPress={() => onTransactionPress(tx)}
                activeOpacity={0.65}
                style={[
                  styles.txRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: div },
                ]}
              >
                <View style={[styles.txIcon, {
                  backgroundColor: theme.tint,
                }]}>
                  <Text style={{ fontSize: 16 }}>
                    {CATEGORY_EMOJIS[tx.category] || '🏷️'}
                  </Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>
                    {tx.note || t(tx.category)}
                  </Text>
                  <Text style={[styles.txSub, { color: theme.secondaryText }]}>
                    {t(tx.category)}
                  </Text>
                </View>
                <Text style={[styles.txAmt, {
                  color: tx.type === 'expense' ? theme.expense : theme.income,
                }]}>
                  {tx.type === 'expense' ? '-' : '+'}{Currency.format(tx.amount)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.noTx, { color: theme.secondaryText }]}>
              No transactions on this day
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  // Day-of-week header
  headerRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Week rows
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,         // ← fills 1/7 of available width, no overflow
    height: 84,
    padding: 5,
    justifyContent: 'space-between',
  },
  dateNum: {
    fontSize: 11,
  },
  amtBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  amt: {
    fontSize: 8.5,
    fontWeight: '600',
  },

  // Detail panel
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelDate: {
    fontSize: 14,
    fontWeight: '800',
  },
  panelTotals: {
    flexDirection: 'row',
    gap: 12,
  },
  panelTotal: {
    fontSize: 12,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  txSub: {
    fontSize: 11,
    marginTop: 1,
  },
  txAmt: {
    fontSize: 13,
    fontWeight: '700',
  },
  noTx: {
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
