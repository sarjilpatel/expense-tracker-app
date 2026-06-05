import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { CATEGORY_ICONS } from '@/constants/maps';

interface Props {
  item: any;
  index: number;
  theme: any;
  t: (key: string) => string;
  onPress: (item: any) => void;
  onLongPress: (id: string) => void;
}

export function TransactionRow({ item, index, theme, t, onPress, onLongPress }: Props) {
  const isExpense = item.type === 'expense';
  const iconName = CATEGORY_ICONS[item.category] || 'receipt-outline';
  const iconColor = isExpense ? theme.expense : theme.income;
  const iconBg = isExpense ? `${theme.expense}14` : `${theme.income}14`;
  const time = new Date(item.date || item.createdAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 25, 150)).duration(200)}
      layout={LinearTransition.springify().damping(20)}
    >
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.border }]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item._id)}
        delayLongPress={500}
        activeOpacity={0.65}
      >
        <View style={styles.left}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName as any} size={18} color={iconColor} />
          </View>
          <Text style={[styles.catLabel, { color: theme.secondaryText }]} numberOfLines={1}>
            {t(item.category)}
          </Text>
        </View>

        <View style={styles.middle}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {item.note || t(item.category)}
          </Text>
          <View style={styles.metaRow}>
            {item.userId?.profilePhoto ? (
              <Image source={{ uri: item.userId.profilePhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.initials, { backgroundColor: `${theme.tint}28` }]}>
                <Text style={[styles.initialsText, { color: theme.tint }]}>
                  {(item.userId?.name || 'U').charAt(0)}
                </Text>
              </View>
            )}
            <Text style={[styles.meta, { color: theme.secondaryText }]} numberOfLines={1}>
              {item.userId?.name || 'Me'} · {time}
            </Text>
            {item.isRecurring && (
              <Ionicons name="repeat-outline" size={10} color={theme.tint} style={{ opacity: 0.7 }} />
            )}
          </View>
        </View>

        <Text style={[styles.amount, { color: isExpense ? theme.expense : theme.income }]}>
          {isExpense ? '-' : '+'}{Currency.format(item.amount)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    alignItems: 'center',
    width: 52,
    marginRight: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  catLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photo: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  initials: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 7,
    fontWeight: '800',
  },
  meta: {
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    minWidth: 64,
  },
});
