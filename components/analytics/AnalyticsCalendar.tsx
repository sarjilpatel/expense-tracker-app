import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { MONTHS, CAL_DAY_LABELS } from '@/constants/maps';

const { width: SCREEN_W } = Dimensions.get('window');

interface DailyEntry { day: number; income: number; expense: number; }

interface Props {
  month: number;
  year: number;
  dailyBreakdown: DailyEntry[];
  theme: any;
}

export function AnalyticsCalendar({ month, year, dailyBreakdown, theme }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dailyMap = useMemo(() => {
    const m: Record<number, { income: number; expense: number }> = {};
    dailyBreakdown.forEach((d: DailyEntry) => {
      if (!m[d.day]) m[d.day] = { income: 0, expense: 0 };
      m[d.day].income  = d.income  || 0;
      m[d.day].expense = d.expense || 0;
    });
    return m;
  }, [dailyBreakdown]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth    = new Date(year, month, 0).getDate();
  const totalCells     = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const cellSize       = Math.floor((SCREEN_W - 40 - 12) / 7);
  const selectedData   = selectedDay ? dailyMap[selectedDay] : null;

  return (
    <View>
      {/* Day labels */}
      <View style={styles.labelRow}>
        {CAL_DAY_LABELS.map((d, i) => (
          <View key={i} style={[styles.labelCell, { width: cellSize }]}>
            <Text style={[styles.dayLabel, { color: theme.secondaryText }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDayOfWeek + 1;
          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
          const data = isValid ? dailyMap[dayNum] : null;
          const hasIncome  = data && data.income  > 0;
          const hasExpense = data && data.expense > 0;
          const isSelected = isValid && selectedDay === dayNum;
          const isToday =
            isValid &&
            new Date().getDate()      === dayNum &&
            new Date().getMonth() + 1 === month  &&
            new Date().getFullYear()  === year;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => isValid && setSelectedDay(dayNum === selectedDay ? null : dayNum)}
              activeOpacity={0.7}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize + 10 },
                isSelected && { backgroundColor: theme.card, borderRadius: 12 },
              ]}
            >
              {isValid && (
                <>
                  <View style={[
                    styles.dayNumWrap,
                    isToday && { backgroundColor: theme.tint, borderRadius: 14 },
                  ]}>
                    <Text style={[styles.dayNum, { color: isToday ? theme.tintText : theme.text }]}>
                      {dayNum}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {hasIncome  && <View style={[styles.dot, { backgroundColor: theme.income  }]} />}
                    {hasExpense && <View style={[styles.dot, { backgroundColor: theme.expense }]} />}
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

      {/* Selected day detail */}
      {selectedDay !== null && (
        <Animated.View entering={FadeInDown.duration(250)} style={[styles.detail, { backgroundColor: theme.card }]}>
          <Text style={[styles.detailTitle, { color: theme.text }]}>
            {MONTHS[month - 1]} {selectedDay}
          </Text>
          <View style={styles.detailRow}>
            {(selectedData?.income ?? 0) > 0 && (
              <View style={styles.detailItem}>
                <Ionicons name="arrow-down-circle" size={16} color={theme.income} />
                <Text style={[styles.detailAmt, { color: theme.income }]}>
                  +{Currency.format(selectedData!.income)}
                </Text>
              </View>
            )}
            {(selectedData?.expense ?? 0) > 0 && (
              <View style={styles.detailItem}>
                <Ionicons name="arrow-up-circle" size={16} color={theme.expense} />
                <Text style={[styles.detailAmt, { color: theme.expense }]}>
                  -{Currency.format(selectedData!.expense)}
                </Text>
              </View>
            )}
            {!selectedData && (
              <Text style={{ fontSize: 13, color: theme.text }}>No transactions this day</Text>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow:   { flexDirection: 'row', marginBottom: 4 },
  labelCell:  { alignItems: 'center', paddingBottom: 6 },
  dayLabel:   { fontSize: 11, fontWeight: '700' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:       { alignItems: 'center', paddingVertical: 4 },
  dayNumWrap: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  dayNum:     { fontSize: 13, fontWeight: '600' },
  dots:       { flexDirection: 'row', gap: 2, marginTop: 2, height: 5 },
  dot:        { width: 5, height: 5, borderRadius: 3 },
  legend:     { flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, fontWeight: '600' },
  detail:     { marginTop: 12, borderRadius: 16, padding: 14 },
  detailTitle:{ fontSize: 14, fontWeight: '800', marginBottom: 8 },
  detailRow:  { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailAmt:  { fontSize: 14, fontWeight: '800' },
});
