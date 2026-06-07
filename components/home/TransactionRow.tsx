import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Currency } from '@/constants/theme';
import { CATEGORY_EMOJIS } from '@/constants/maps';
import { CURRENCY_META } from '@/src/services/preferencesService';

interface Props {
  item: any;
  index: number;
  theme: any;
  t: (key: string) => string;
  onPress: (item: any) => void;
  onLongPress: (id: string) => void;
  accountName?: string | null;
  hasReceipt?: boolean;
}

export const TransactionRow = memo(function TransactionRow({ item, index, theme, t, onPress, onLongPress, accountName, hasReceipt }: Props) {
  const isExpense   = item.type === 'expense';
  const emoji       = CATEGORY_EMOJIS[item.category] || '🏷️';
  const amountColor = isExpense ? theme.expense : theme.income;

  const txCurrencyMeta = item.currency && item.currency !== 'INR' ? CURRENCY_META[item.currency as keyof typeof CURRENCY_META] : null;
  const formattedAmount = txCurrencyMeta
    ? `${txCurrencyMeta.symbol}${item.amount.toLocaleString(txCurrencyMeta.locale)}`
    : Currency.format(item.amount);

  const addedBy = typeof item.userId === 'object' && item.userId?.name
    ? (item.userId.name as string)
    : null;

  const accountPart = accountName ?? 'Accounts';
  const subLabel    = addedBy ? `${accountPart} · ${addedBy}` : accountPart;

  const rowBg = theme.card;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 25, 150)).duration(200)}>
      <TouchableOpacity
        style={[styles.row, { backgroundColor: rowBg, borderBottomColor: theme.separator }]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item._id)}
        delayLongPress={500}
        activeOpacity={0.6}
      >
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: amountColor }]} />

        {/* Emoji + category */}
        <View style={styles.left}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[styles.catText, { color: theme.secondaryText }]} numberOfLines={1}>
            {t(item.category)}
          </Text>
        </View>

        {/* Note + subtext */}
        <View style={styles.middle}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {item.note || t(item.category)}
          </Text>
          <Text style={[styles.subtext, { color: theme.secondaryText }]} numberOfLines={1}>
            {subLabel}
          </Text>
        </View>

        {/* Amount + receipt indicator */}
        <View style={styles.right}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {formattedAmount}
          </Text>
          {hasReceipt && (
            <Ionicons name="receipt-outline" size={11} color={theme.secondaryText} style={styles.receiptIcon} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accentBar: {
    width: 3, height: 36, borderRadius: 2,
    marginRight: 10, flexShrink: 0,
  },
  left: {
    width: 82, flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingRight: 4, flexShrink: 0,
  },
  emoji:   { fontSize: 17 },
  catText: { fontSize: 11, fontWeight: '400', flexShrink: 1 },
  middle:  { flex: 1, gap: 4 },
  title:   { fontSize: 15, fontWeight: '500', lineHeight: 19, letterSpacing: 0.1 },
  subtext: { fontSize: 12, fontWeight: '400', lineHeight: 15 },
  right:       { alignItems: 'flex-end', marginLeft: 8, gap: 2 },
  amount:      { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  receiptIcon: { opacity: 0.6 },
});
