import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Currency } from '@/constants/theme';
import { DAY_NAMES } from '@/constants/maps';

interface Section {
  dateObj: Date;
  income: number;
  expense: number;
}

interface Props {
  section: Section;
  theme: any;
}

export function TransactionSectionHeader({ section, theme }: Props) {
  const d       = section.dateObj;
  const dayNum  = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  const monthYr = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const isSun = d.getDay() === 0;
  const isSat = d.getDay() === 6;

  const dayColor  = isSun ? '#E05757' : isSat ? '#5B9CF6' : theme.text;
  const badgeBg   = isSun ? '#E05757' : isSat ? '#5B9CF6' : theme.tint;
  const badgeText = isSun || isSat ? '#FFF' : theme.tintText;

  return (
    <TouchableOpacity
      style={[
        styles.header,
        {
          backgroundColor: theme.cardAlt,
          borderColor: theme.border,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
          marginHorizontal: 12,
        }
      ]}
      onPress={() =>
        router.push({ pathname: '/add-transaction', params: { prefillDate: d.toISOString() } })
      }
      activeOpacity={0.55}
    >
      <View style={styles.left}>
        <Text style={[styles.dayNum, { color: dayColor }]}>
          {String(dayNum).padStart(2, '0')}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeText }]}>{dayName}</Text>
        </View>
        <Text style={[styles.dateLabel, { color: theme.secondaryText }]}>{monthYr}</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amt, { color: theme.income }]}>
          {Currency.format(section.income || 0)}
        </Text>
        <Text style={[styles.amt, { color: theme.expense }]}>
          {Currency.format(section.expense || 0)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dayNum: { fontSize: 20, fontWeight: '700', lineHeight: 24, width: 28 },
  badge: {
    paddingHorizontal: 5, paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  dateLabel: { fontSize: 11, fontWeight: '400' },
  right:  { flexDirection: 'row', alignItems: 'center', gap: 18 },
  amt: {
    fontSize: 13, fontWeight: '600',
    letterSpacing: 0.2, minWidth: 66, textAlign: 'right',
  },
});
