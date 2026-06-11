import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { CURRENCY_META } from '@/src/services/preferencesService';
import { CATEGORY_EMOJIS } from '@/constants/maps';

interface Props {
  item: any;
  index: number;
  theme: any;
  t: (key: string) => string;
  onPress: (item: any) => void;
  onLongPress: (id: string) => void;
  accountName?: string | null;
  hasReceipt?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  marginHorizontal?: number;
}

export const TransactionRow = memo(function TransactionRow({ item, index, theme, t, onPress, onLongPress, accountName, hasReceipt, isFirst, isLast, marginHorizontal = 8 }: Props) {
  const isExpense   = item.type === 'expense';
  const amountColor = isExpense ? theme.expense : theme.income;

  const txCurrencyMeta = item.currency && item.currency !== 'INR' ? CURRENCY_META[item.currency as keyof typeof CURRENCY_META] : null;
  const formattedAmount = txCurrencyMeta
    ? `${txCurrencyMeta.symbol}${item.amount.toLocaleString(txCurrencyMeta.locale)}`
    : Currency.format(item.amount);

  const timeLabel = new Date(item.date || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const rowBg = theme.card;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 25, 150)).duration(200)}>
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: rowBg,
            borderColor: theme.border,
            borderLeftWidth: StyleSheet.hairlineWidth,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: isLast ? theme.border : theme.separator,
            marginHorizontal: marginHorizontal,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: isLast ? 10 : 0,
            borderBottomRightRadius: isLast ? 10 : 0,
            marginTop: 0,
          }
        ]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item._id)}
        delayLongPress={500}
        activeOpacity={0.6}
      >
        {/* LEFT: Category Emoji */}
        <View style={styles.iconChip}>
          <Text style={styles.emoji}>{CATEGORY_EMOJIS[item.category] || '🏷️'}</Text>
        </View>

        {/* MIDDLE: Notes/Name + Category */}
        <View style={styles.middle}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {item.note || t(item.category)}
          </Text>
          <Text style={[styles.catText, { color: theme.secondaryText }]} numberOfLines={1}>
            {t(item.category)} {accountName ? `· ${accountName}` : ''}
          </Text>
        </View>

        {/* RIGHT: Amount + Time */}
        <View style={styles.right}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {formattedAmount}
          </Text>
          <View style={styles.timeRow}>
            {hasReceipt && (
              <Ionicons name="receipt-outline" size={12} color={theme.secondaryText} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.timeLabel, { color: theme.secondaryText }]}>
              {timeLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    minHeight:         54,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emoji: {
    fontSize: 15,
    lineHeight: 28,
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  catText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 8,
    justifyContent: 'center',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
