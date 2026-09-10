import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Currency } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY_EMOJIS } from '@/constants/maps';

interface Props {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  rank: number;
  onPress?: () => void;
}

export function CategoryBar({ category, amount, percentage, color, rank, onPress }: Props) {
  const scheme = useColorScheme() || 'light';
  const theme = Colors[scheme];
  const pct = Math.min(Number(percentage) || 0, 100);
  const barW = useSharedValue(0);

  useEffect(() => {
    barW.value = withTiming(pct / 100, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barW.value * 100}%` as any,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(rank * 60).duration(300)}>
      <TouchableOpacity
        style={styles.item}
        onPress={onPress}
        activeOpacity={onPress ? 0.6 : 1}
        disabled={!onPress}
      >
        <View style={styles.top}>
          <View style={styles.left}>
            <View style={styles.iconChip}>
              <Text style={styles.emoji}>{CATEGORY_EMOJIS[category] || '🏷️'}</Text>
            </View>
            <ThemedText style={styles.name}>{category}</ThemedText>
          </View>
          <View style={styles.right}>
            <Text style={[styles.pct, { color }]}>{Math.round(pct)}%</Text>
            <ThemedText style={styles.amt}>{Currency.format(amount)}</ThemedText>
            {onPress && <Text style={[styles.chevron, { color: theme.tabIconDefault }]}>›</Text>}
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: `${color}20` }]}>
          <Animated.View style={[styles.fill, { backgroundColor: color }, barStyle]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  iconChip: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 16, lineHeight: 20, textAlign: 'center' },
  name: { fontSize: 14, fontWeight: '600', flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pct: { fontSize: 12, fontWeight: '800' },
  amt: { fontSize: 13, fontWeight: '700', minWidth: 72, textAlign: 'right' },
  chevron: { fontSize: 20, fontWeight: '300', lineHeight: 22 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
