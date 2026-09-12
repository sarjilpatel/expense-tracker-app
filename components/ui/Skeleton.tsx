import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { SkeletonBar, useShimmer, SkeletonLoader } from '@/components/SkeletonLoader';
import { space, radius } from '@/constants/tokens';

/**
 * Loading placeholders. Two ways in:
 *
 *   <SkeletonLoader rows={6} />          — the existing full-screen presets (list/card/chart)
 *   <Skeleton.Group>                      — compose your own from blocks that shimmer in step
 *     <Skeleton.Block height={20} width="40%" />
 *     <Skeleton.Row />
 *   </Skeleton.Group>
 *
 * The rule these exist to serve (W2-13): never blank a screen to a spinner over data you already
 * have. A skeleton is for the first load only; a refetch on focus is silent.
 */
const ShimmerContext = React.createContext<ReturnType<typeof useShimmer> | null>(null);

function Group({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const shimmer = useShimmer();
  return (
    <ShimmerContext.Provider value={shimmer}>
      <View style={[{ gap: space.md }, style]}>{children}</View>
    </ShimmerContext.Provider>
  );
}

function useSharedShimmer() {
  const shared = React.useContext(ShimmerContext);
  const own = useShimmer();
  return shared ?? own;
}

function Block({ width = '100%', height = 16, round = radius.sm, style }: {
  width?: number | string; height?: number; round?: number; style?: ViewStyle;
}) {
  const shimmer = useSharedShimmer();
  return <SkeletonBar shimmerX={shimmer} width={width} height={height} borderRadius={round} style={style} />;
}

/** A list-row placeholder: leading circle, two lines, trailing amount. */
function RowPlaceholder() {
  const shimmer = useSharedShimmer();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
      <SkeletonBar shimmerX={shimmer} width={38} height={38} borderRadius={radius.md} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBar shimmerX={shimmer} height={14} width="60%" borderRadius={7} />
        <SkeletonBar shimmerX={shimmer} height={11} width="35%" borderRadius={6} />
      </View>
      <SkeletonBar shimmerX={shimmer} height={16} width={72} borderRadius={8} />
    </View>
  );
}

export const Skeleton = { Group, Block, Row: RowPlaceholder };
export { SkeletonLoader };
