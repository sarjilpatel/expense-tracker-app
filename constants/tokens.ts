/**
 * Design tokens — the values decided in work plan v2 (W2-21 type, W2-22 spacing/radius/targets).
 *
 * These exist so the primitives in `components/ui/` have one place to read from. Nothing in a
 * screen should reach for a raw number that one of these covers: the whole reason the app ended up
 * with 20 font sizes and 14 radii is that `TYPE_SCALE` and `BORDER_RADIUS` in `theme.ts` were
 * optional, and optional tokens get skipped. W2-23 makes them mandatory with a lint rule; until
 * then, the primitives are the enforcement.
 *
 * Colour is deliberately *not* here — it comes from `useTheme()`, which derives every foreground
 * from the surface it sits on.
 */

import { Platform, type TextStyle } from 'react-native';

/** 4-point grid. Nothing off-grid: the 13s and 14s scattered through the app were drift. */
export const space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

/** Four steps. The 14/12/16/20 cluster collapses into md and lg. */
export const radius = {
  sm:   8,    // chips, badges
  md:   12,   // inputs, buttons
  lg:   16,   // cards, sheets
  full: 999,  // pills, avatars
} as const;

export { MIN_TARGET } from '@/src/utils/layout';

/** Where numbers must line up — every money value, every axis. */
export const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

/**
 * Seven roles replacing twenty sizes (W2-21). Regular is the default weight; 600 is the only
 * emphasis; 700 is reserved for `display` and `title`. Line height rides with each role so a
 * screen never has to set it — the app set `lineHeight` 42 times against 626 font sizes.
 */
export const type = {
  display:    { fontSize: 40, lineHeight: 44, fontWeight: '700', letterSpacing: -0.5, ...tabular },
  title:      { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading:    { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body:       { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600', ...tabular },
  label:      { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline:   { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof type;

/**
 * For the rare text that needs a weight without a role — an emphasised word inside a `body` run.
 * Three steps, matching the roles: regular is the default, semibold the only emphasis, bold only
 * where `display`/`title` already use it.
 */
export const weight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Icon sizes that pair with the type roles above. */
export const icon = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Hairline borders read as edges in light mode; in dark mode surfaces separate by tone instead
 * (W2-20), so a border there is a fallback, not the mechanism.
 */
export const hairline = Platform.select({ ios: 0.5, default: 1 }) as number;
