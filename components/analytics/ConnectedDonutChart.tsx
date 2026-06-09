import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

type DonutSlice = {
  value: number;
  color: string;
  category: string;
  text: string;
};

type LabelItem = DonutSlice & {
  midAngle: number;
  side: 'left' | 'right';
  rimY: number;
  chipX: number;
  chipY: number;
};

interface Props {
  slices: DonutSlice[];
  centerTitle: string;
  centerValue: string;
  theme: any;
}

const LABEL_W   = 84;
const LABEL_H   = 36;
const SIDE_PAD  = 4;
const DONUT_GAP = 14;  // px between outer donut rim and nearest label edge
const LABEL_GAP = 5;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function donutSegmentPath(
  cx: number, cy: number,
  ro: number, ri: number,
  a0: number, a1: number,
) {
  const os = polar(cx, cy, ro, a1);
  const oe = polar(cx, cy, ro, a0);
  const is = polar(cx, cy, ri, a0);
  const ie = polar(cx, cy, ri, a1);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return [
    `M ${os.x} ${os.y}`,
    `A ${ro} ${ro} 0 ${large} 0 ${oe.x} ${oe.y}`,
    `L ${is.x} ${is.y}`,
    `A ${ri} ${ri} 0 ${large} 1 ${ie.x} ${ie.y}`,
    'Z',
  ].join(' ');
}

function resolvePositions(items: LabelItem[], lo: number, hi: number) {
  const sorted = [...items].sort((a, b) => a.rimY - b.rimY);
  let cursor = lo;

  sorted.forEach(item => {
    const natural = item.rimY - LABEL_H / 2;
    item.chipY = Math.max(natural, cursor);
    cursor = item.chipY + LABEL_H + LABEL_GAP;
  });

  const last = sorted[sorted.length - 1];
  if (last && last.chipY + LABEL_H > hi) {
    const overflow = last.chipY + LABEL_H - hi;
    sorted.forEach(item => { item.chipY -= overflow; });
  }

  const first = sorted[0];
  if (first && first.chipY < lo) {
    const shift = lo - first.chipY;
    sorted.forEach(item => { item.chipY += shift; });
  }

  return sorted;
}

export function ConnectedDonutChart({ slices, centerTitle, centerValue, theme }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const W = Math.min(windowWidth - 16, 420);
  const H = 340;

  const chart = useMemo(() => {
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total <= 0) return null;

    const cx = W / 2;
    const cy = H / 2;
    const ro = 84;
    const ri = 64;

    // Labels are placed a fixed DONUT_GAP from the rim on each side
    const chipX_right = Math.min(cx + ro + DONUT_GAP, W - SIDE_PAD - LABEL_W);
    const chipX_left  = Math.max(cx - ro - DONUT_GAP - LABEL_W, SIDE_PAD);

    let angle = -90;
    const labels: LabelItem[] = [];

    const segments = slices.map(slice => {
      const span = (slice.value / total) * 360;
      const a0 = angle;
      const a1 = angle + span;
      const mid = a0 + span / 2;
      const rim = polar(cx, cy, ro + 2, mid);
      const side: 'left' | 'right' = rim.x <= cx ? 'left' : 'right';

      labels.push({
        ...slice,
        midAngle: mid,
        side,
        rimY: Math.max(LABEL_H / 2 + 8, Math.min(H - LABEL_H / 2 - 8, rim.y)),
        chipX: side === 'left' ? chipX_left : chipX_right,
        chipY: 0,
      });

      angle = a1;
      return { path: donutSegmentPath(cx, cy, ro, ri, a0, a1), color: slice.color };
    });

    const left  = resolvePositions(labels.filter(l => l.side === 'left'),  8, H - 8);
    const right = resolvePositions(labels.filter(l => l.side === 'right'), 8, H - 8);

    return { cx, cy, ro, ri, segments, arranged: [...left, ...right] };
  }, [H, W, slices]);

  if (!chart) return null;

  const { cx, cy, ro, ri, segments, arranged } = chart;

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>

        {segments.map((seg, i) => (
          <Path
            key={i}
            d={seg.path}
            fill={seg.color}
            stroke={theme.background}
            strokeWidth={2.5}
          />
        ))}

        <Circle cx={cx} cy={cy} r={ri - 1} fill={theme.card} />

        {arranged.map((item, i) => {
          const lcy    = item.chipY + LABEL_H / 2;
          const rimPt  = polar(cx, cy, ro, item.midAngle);
          const isLeft = item.side === 'left';
          const edgeX  = isLeft ? item.chipX + LABEL_W : item.chipX;

          // Radial unit vector for this segment
          const ang = ((item.midAngle - 90) * Math.PI) / 180;
          const ux  = Math.cos(ang);
          const uy  = Math.sin(ang);

          // cp1: radially outward from the rim.
          // For right labels, clamp so cp1 never overshoots past the label's left edge —
          // this prevents the visible rightward loop that was the original bug.
          const EXT      = 22;
          const cp1xRaw  = rimPt.x + ux * EXT;
          const cp1y     = rimPt.y + uy * EXT;
          const cp1x     = isLeft
            ? cp1xRaw                            // left side: natural radial exit
            : Math.min(cp1xRaw, edgeX + 5);     // right side: cap 5px past label edge

          // cp2: horizontal approach into the label
          const cp2x = isLeft ? edgeX + 20 : edgeX - 20;

          const curvePath = `M ${rimPt.x} ${rimPt.y} C ${cp1x} ${cp1y} ${cp2x} ${lcy} ${edgeX} ${lcy}`;

          return (
            <React.Fragment key={`conn-${i}`}>
              <Path
                d={curvePath}
                fill="none"
                stroke={item.color}
                strokeWidth={1.4}
                opacity={0.75}
              />
              {/* Halo ring + solid dot at the rim connection point */}
              <Circle cx={rimPt.x} cy={rimPt.y} r={5} fill={item.color} opacity={0.18} />
              <Circle cx={rimPt.x} cy={rimPt.y} r={2.8} fill={item.color} opacity={0.95} />
            </React.Fragment>
          );
        })}
      </Svg>

      <View pointerEvents="none" style={[styles.centerBlock, { top: cy - 26 }]}>
        <Text style={[styles.centerTitle, { color: theme.secondaryText }]}>
          {centerTitle}
        </Text>
        <Text style={[styles.centerValue, { color: theme.tint }]}>
          {centerValue}
        </Text>
      </View>

      {arranged.map((item, i) => (
        // Outer wrapper carries the shadow so it isn't clipped by overflow:hidden below
        <View
          key={`lbl-${i}`}
          style={[
            styles.chipShadow,
            {
              left: item.chipX,
              top: item.chipY,
              shadowColor: item.color,
            },
          ]}
        >
          {/* Inner shell: clips the tinted background to rounded corners */}
          <View style={[styles.chipInner, { borderColor: item.color, backgroundColor: theme.card }]}>
            {/* Tinted glass fill — slice color at low opacity */}
            <View style={[StyleSheet.absoluteFillObject, styles.chipTint, { backgroundColor: item.color }]} />

            {/* Halo dot */}
            <View style={styles.dotWrap}>
              <View style={[styles.dotRing, { backgroundColor: item.color }]} />
              <View style={[styles.dotCore, { backgroundColor: item.color }]} />
            </View>

            {/* Text */}
            <View style={styles.chipText}>
              <Text style={[styles.cat, { color: theme.secondaryText }]} numberOfLines={1}>
                {item.category}
              </Text>
              <Text style={[styles.pct, { color: item.color }]} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'visible',
  },
  centerBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  centerTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centerValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: -0.5,
  },
  chipShadow: {
    position: 'absolute',
    width: LABEL_W,
    height: LABEL_H,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  chipInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    gap: 6,
    overflow: 'hidden',
  },
  chipTint: {
    opacity: 0.1,
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.22,
  },
  dotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipText: {
    flex: 1,
    overflow: 'hidden',
  },
  cat: {
    fontSize: 9.5,
    fontWeight: '600',
    lineHeight: 13,
  },
  pct: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    letterSpacing: -0.2,
  },
});
