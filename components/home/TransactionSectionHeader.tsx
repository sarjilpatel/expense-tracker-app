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
  const d = section.dateObj;
  const dayNum = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const monthYr = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const isToday = d.toDateString() === new Date().toDateString();

  return (
    <TouchableOpacity
      style={[styles.header, { borderBottomColor: theme.border }]}
      onPress={() => router.push({ pathname: '/(tabs)/add', params: { prefillDate: d.toISOString() } })}
      activeOpacity={0.55}
    >
      <View style={styles.left}>
        <Text style={[styles.dayNum, {
          color: isToday ? theme.tint : isWeekend ? theme.expense : theme.text,
        }]}>
          {String(dayNum).padStart(2, '0')}
        </Text>
        <View>
          <View style={[styles.badge, {
            backgroundColor: isToday
              ? `${theme.tint}18`
              : isWeekend ? `${theme.expense}15` : `${theme.tint}12`,
          }]}>
            <Text style={[styles.dayName, {
              color: isToday ? theme.tint : isWeekend ? theme.expense : theme.tint,
            }]}>{dayName}</Text>
          </View>
          <Text style={[styles.monthYr, { color: theme.secondaryText }]}>{monthYr}</Text>
        </View>
      </View>

      <View style={styles.right}>
        {section.income > 0 && (
          <Text style={[styles.amount, { color: theme.income }]}>
            +{Currency.format(section.income)}
          </Text>
        )}
        {section.expense > 0 && (
          <Text style={[styles.amount, { color: theme.expense }]}>
            -{Currency.format(section.expense)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dayNum: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
    minWidth: 36,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  dayName: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  monthYr: {
    fontSize: 9,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  amount: {
    fontSize: 11,
    fontWeight: '700',
  },
});
