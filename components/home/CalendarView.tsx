import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { MONTHS, CAL_DAY_LABELS, CATEGORY_ICONS } from '@/constants/maps';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  transactions: any[];
  month: number;
  year: number;
  theme: any;
  t: (key: string) => string;
  onTransactionPress: (item: any) => void;
}

export function CalendarView({ transactions, month, year, theme, t, onTransactionPress }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dailyMap = useMemo(() => {
    const m: Record<number, { income: number; expense: number; items: any[] }> = {};
    transactions.forEach((tx: any) => {
      const d = new Date(tx.date || tx.createdAt);
      if (d.getMonth() + 1 !== month || d.getFullYear() !== year) return;
      const day = d.getDate();
      if (!m[day]) m[day] = { income: 0, expense: 0, items: [] };
      if (tx.type === 'income') m[day].income += tx.amount;
      else m[day].expense += tx.amount;
      m[day].items.push(tx);
    });
    return m;
  }, [transactions, month, year]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const cellSize = Math.floor((SCREEN_W - 56) / 7);
  const today = new Date();
  const selectedData = selectedDay ? dailyMap[selectedDay] : null;

  return (
    <View>
      {/* Day-of-week labels */}
      <View style={styles.labelRow}>
        {CAL_DAY_LABELS.map((d, i) => (
          <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={[styles.dayLabel, {
              color: i === 0 || i === 6 ? `${theme.expense}BB` : theme.secondaryText,
            }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDayOfWeek + 1;
          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
          const data = isValid ? dailyMap[dayNum] : null;
          const isSelected = isValid && selectedDay === dayNum;
          const isToday = isValid &&
            today.getDate() === dayNum &&
            today.getMonth() + 1 === month &&
            today.getFullYear() === year;
          const isWeekend = idx % 7 === 0 || idx % 7 === 6;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => isValid && setSelectedDay(dayNum === selectedDay ? null : dayNum)}
              activeOpacity={0.65}
              style={{
                width: cellSize, height: cellSize + 10,
                alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3,
                backgroundColor: isSelected ? `${theme.tint}18` : 'transparent',
                borderRadius: 10,
              }}
            >
              {isValid && (
                <>
                  <View style={{
                    width: 26, height: 26,
                    justifyContent: 'center', alignItems: 'center', borderRadius: 13,
                    backgroundColor: isToday ? theme.tint : 'transparent',
                  }}>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: isToday ? '800' : data ? '600' : '400',
                      color: isToday ? '#FFF' : isWeekend ? `${theme.expense}CC` : theme.text,
                    }}>{dayNum}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                    {(data?.income ?? 0) > 0 && <View style={[styles.dot, { backgroundColor: theme.income }]} />}
                    {(data?.expense ?? 0) > 0 && <View style={[styles.dot, { backgroundColor: theme.expense }]} />}
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: theme.border }]}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.income }]} />
          <Text style={[styles.legendText, { color: theme.secondaryText }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.expense }]} />
          <Text style={[styles.legendText, { color: theme.secondaryText }]}>Expense</Text>
        </View>
      </View>

      {/* Selected day panel */}
      {selectedDay !== null && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.dayPanel, { backgroundColor: theme.card }]}
        >
          <View style={styles.dayPanelHeader}>
            <Text style={[styles.dayPanelTitle, { color: theme.text }]}>
              {MONTHS[month - 1]} {selectedDay}
            </Text>
            {selectedData && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {selectedData.income > 0 && (
                  <Text style={{ color: theme.income, fontSize: 12, fontWeight: '700' }}>
                    +{Currency.format(selectedData.income)}
                  </Text>
                )}
                {selectedData.expense > 0 && (
                  <Text style={{ color: theme.expense, fontSize: 12, fontWeight: '700' }}>
                    -{Currency.format(selectedData.expense)}
                  </Text>
                )}
              </View>
            )}
          </View>

          {selectedData?.items && selectedData.items.length > 0 ? (
            selectedData.items.map((tx: any, i: number) => (
              <TouchableOpacity
                key={i}
                onPress={() => onTransactionPress(tx)}
                style={[styles.txItem, { borderTopColor: theme.border, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 30, height: 30, borderRadius: 9,
                    backgroundColor: tx.type === 'expense' ? `${theme.expense}15` : `${theme.income}15`,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons
                      name={(CATEGORY_ICONS[tx.category] || 'receipt-outline') as any}
                      size={14}
                      color={tx.type === 'expense' ? theme.expense : theme.income}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>
                      {tx.note || t(tx.category)}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.secondaryText }}>{t(tx.category)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tx.type === 'expense' ? theme.expense : theme.income }}>
                  {tx.type === 'expense' ? '-' : '+'}{Currency.format(tx.amount)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: theme.secondaryText, fontSize: 12, opacity: 0.5 }}>No transactions this day</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayPanel: {
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
  },
  dayPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayPanelTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
});
