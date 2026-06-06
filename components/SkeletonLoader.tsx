import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/context/ThemeContext';

interface SkeletonBarProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  shimmerX: Animated.SharedValue<number>;
}

function SkeletonBar({ width = '100%', height = 16, borderRadius = 8, style, shimmerX }: SkeletonBarProps) {
  const { theme } = useTheme();
  const baseColor    = theme.cardAlt;
  const shimmerColor = theme.card === '#FFFFFF' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.07)';

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={[
        { width: width as any, height, borderRadius, overflow: 'hidden', backgroundColor: baseColor },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: 200, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

interface SkeletonLoaderProps {
  rows?: number;
  type?: 'list' | 'card' | 'chart';
}

export function SkeletonLoader({ rows = 4, type = 'list' }: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const shimmerX = useSharedValue(-200);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(420, { duration: 1400, easing: Easing.linear }),
      -1
    );
  }, []);

  if (type === 'card') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <SkeletonBar shimmerX={shimmerX} height={12} width="42%" borderRadius={6} style={{ marginBottom: 10 }} />
        <SkeletonBar shimmerX={shimmerX} height={34} width="68%" borderRadius={10} style={{ marginBottom: 24 }} />
        <View style={styles.row}>
          <View style={styles.halfRow}>
            <SkeletonBar shimmerX={shimmerX} width={32} height={32} borderRadius={16} style={{ marginRight: 10 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBar shimmerX={shimmerX} height={10} width="55%" borderRadius={5} />
              <SkeletonBar shimmerX={shimmerX} height={13} width="75%" borderRadius={6} />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.halfRow}>
            <SkeletonBar shimmerX={shimmerX} width={32} height={32} borderRadius={16} style={{ marginRight: 10 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBar shimmerX={shimmerX} height={10} width="55%" borderRadius={5} />
              <SkeletonBar shimmerX={shimmerX} height={13} width="75%" borderRadius={6} />
            </View>
          </View>
        </View>
        <SkeletonBar shimmerX={shimmerX} height={6} borderRadius={3} style={{ marginTop: 22 }} />
      </View>
    );
  }

  if (type === 'chart') {
    return (
      <View style={styles.chartContainer}>
        <SkeletonBar shimmerX={shimmerX} height={200} borderRadius={16} style={{ marginBottom: 24 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.row, { marginBottom: 14 }]}>
            <SkeletonBar shimmerX={shimmerX} height={14} width={14} borderRadius={7} style={{ marginRight: 12 }} />
            <SkeletonBar shimmerX={shimmerX} height={14} width="50%" borderRadius={7} />
            <View style={{ flex: 1 }} />
            <SkeletonBar shimmerX={shimmerX} height={14} width="18%" borderRadius={7} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <SkeletonBar shimmerX={shimmerX} width={50} height={50} borderRadius={18} style={{ marginRight: 14 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBar shimmerX={shimmerX} height={14} width="52%" borderRadius={7} />
            <SkeletonBar shimmerX={shimmerX} height={11} width="33%" borderRadius={6} />
          </View>
          <SkeletonBar shimmerX={shimmerX} height={15} width={58} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  card: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 28,
    marginBottom: 20,
    minHeight: 158,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  halfRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
  },
  chartContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
});
